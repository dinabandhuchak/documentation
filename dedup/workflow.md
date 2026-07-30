# Deduplication Service — Workflows & Architecture

## Overview

A NestJS Kafka microservice that sits between upstream content-matching services and downstream consumers. It receives raw matched articles, runs them through a multi-stage optimization pipeline (deduplication, syndication removal, grouping, autoclip merging, scoring, quality gating), and emits the final optimized articles to Kafka.

---

## Kafka Events

### Consumed

| Event | Topic | Trigger |
|-------|-------|---------|
| `onclusive.delivery.event.content.matched` | `{APP_ENV}.delivery.content` | Upstream service matched an article to a brief |
| `onclusive.delivery.event.content.missing.added` | `{APP_ENV}.delivery.content` | Article with missing content was added |
| `onclusive.delivery.event.content.optimization.triggered` | `{APP_ENV}.delivery.content` | Upstream scheduler signals a brief is ready to process |
| `onclusive.delivery.event.content.quality.control.triggered` | `{APP_ENV}.delivery.content` | Manual quality check re-trigger |

### Produced

| Event | When |
|-------|------|
| `onclusive.delivery.event.content.optimized` | Once per article that passes all pipeline stages |
| `onclusive.delivery.event.content.optimization.completed` | After all batches for an account are published |
| `onclusive.delivery.event.press_review.created` | After optimization, when `pressReview=true` and `pressReviewStructure` is set |
| `onclusive.delivery.event.content.suggested_press_review.completed` | After a suggested press review run |
| `onclusive.delivery.event.content.optimization.progress_sent` | Informational progress messages throughout the pipeline |
| `onclusive.delivery.event.content.optimization.error` | On DB or processing errors |

---

## Workflow 1 — Article Ingestion (`content.matched` / `content.missing.added`)

```
Kafka: content.matched or content.missing.added
    │
    ▼
MessageService.create(message)
    │
    ├─ Parse article fields, timestamps, autoclip, domain_details
    ├─ Filter to allowed DB fields (allowedArticleFields)
    ├─ Extract matched keywords (intersection with client.keywords_in_query)
    ├─ Extract mediatopic IDs
    ├─ Determine mediaType: 'missing_content' if missing_content_config present, else article.media_type
    │
    └─ ArticleCache.upsert (key: id + account_id + section_id)
           ├─ CREATE: full article + client metadata
           └─ UPDATE: data, includes, media_type only
```

**Result:** Article is stored in `ArticleCache` awaiting optimization. Nothing is emitted.

---

## Workflow 2 — Optimization Pipeline (`optimization.triggered`)

Triggered by an upstream scheduler service. The event payload carries the complete brief configuration.

### Stage 0 — Guards (early exit, no `content.optimized` emitted)

| Check | Exit condition |
|-------|---------------|
| Article count | `articlesCountForAccount() > PROCESS_LIMIT` (default 10,000) |
| Quality control | `pressReview=true` AND deviation from 7-day average > `DEVIATION_THRESHOLD` (default 50%) AND `last7DaysMetrics >= 2` AND `averageVolume >= 15` |

### Stage 1 — Pre-processing

```
cleanDuplicateArticles(accountId)
    └─ Removes cross-section duplicate articles by section priority
       (skipped if isSuggestedPressReview=true)
```

### Stage 2 — Optimization (skipped if `sendToEditorialTool=true` AND `isSuggestedPressReview=false`)

#### 2a. Deduplication (regional/national print only)
```
For each section where deduplicatePreferences[sectionId] = true:
    1. Fetch regional/national print articles for section
    2. Group by SHA-256(publication_group_id | date | title)
       └─ Single-article groups → already unique
       └─ Multi-article groups → compare content via Dice's coefficient
    3. Articles with similarity >= SIMILARITY_RATIO (default 1.0) → deleted from ArticleCache
       └─ Main editions (group_id present, no parents) are prioritised (placed first)
```

#### 2b. Syndication Removal (web / print / broadcast)
```
For each active section per media type:

Phase 1 — No cluster_id articles:
    1. Fetch articles without cluster_id
    2. Run Jaccard similarity against each other
    3. Articles below {MEDIA_TYPE}_MATCH_THRESHOLD → unique; above → syndicate (deleted)
       └─ WEB_MATCH_THRESHOLD default: 0.7

Phase 2 — cluster_id articles:
    1. Fetch articles with cluster_id
    2. Keep first article per unique cluster_id
    3. Subsequent articles with same cluster_id → deleted

Broadcast (TV + Radio) processed separately per section.
```

#### 2c. Article Grouping (web + print)
```
For each section where groupingPreferences[sectionId] = true:
    1. Fetch web + print articles for section
    2. Run Jaccard similarity between all pairs
    3. Articles with similarity >= GROUP_MATCH_THRESHOLD (default 0.5) → assigned shared group_id
       └─ Highest-scoring article in group becomes the primary (group_id = its id)
    4. group_id written to ArticleCache and article.data.group_id
```

#### 2d. Custom Scoring
```
For each section in sortScorePreferences (isSuggestedPressReview only):
    score = media_type_score (max 600)
          + category_score   (max 300)
          + publication_score (max 100)
    sequence_number updated in ArticleCache accordingly
```

### Stage 3 — Autoclip Merging (TV/Radio, skipped for suggested press review or email-service destination)
```
1. Fetch all broadcast articles for account
2. Group by SHA-256(publication | media_type | section_id)
3. Single-article groups → unique, no merge needed
4. Multi-article groups → compare broadcast start times
   └─ Articles within THRESHOLD minutes (default 5) of the first → merge autoclip metadata
   └─ Merged duplicates deleted from ArticleCache
```

### Stage 4 — Emission

```
eventService.emitArticles()
    │
    ├─ Path A: sectionLimitInfo provided and all values > 0
    │     └─ Loop per sectionId
    │           ├─ maxLimit = sendToEditorialTool ? unlimited : sectionLimitInfo[sectionId]
    │           └─ [paginated batch loop — see below]
    │
    └─ Path B: no valid sectionLimitInfo
          ├─ maxLimit = sendToEditorialTool ? unlimited : maxArticlesLimit
          └─ [paginated batch loop — see below]

Paginated batch loop (DEFAULT_BATCH_SIZE = 1000):
    do:
        1. fetchArticlesBatch(accountId, processStartTime, remainingLimit, offset, sectionId?)
        2. filterArticlesByMinLength()
           └─ Skip non-social articles (not facebook/twitter/instagram/youtube/podcast)
              where (title words + content words) < sectionsMinimumArticleLength[sectionId]
        3. processAndPublishArticles()
           ├─ updateAccountConfigData() — merge latestClientConfig into article.includes.account
           │   └─ Section-level config overrides brief-level config (pressReview briefs only)
           ├─ Set article.data.press_review_id if pressReviewStructure.id present
           ├─ Collect extractedArticleInfo (id, title, score, media_type, etc.)
           └─ publishBatch() → emitService.publishBatch(..., 'optimization')
                └─ ✅ Emits: content.optimized (one message per article)
    while articles returned AND limit not reached

    After loop:
        fetchArticlesWithMissingContentOrSentBefore()
        └─ processAndPublishArticles() for manual/missing-content articles

    publishCompletionMessage()
    └─ ✅ Emits: content.optimization.completed
         (includes articlesCount + first 500 article summaries)

    if pressReview=true AND pressReviewStructure set:
    └─ publishPressReviewEvent()
       └─ ✅ Emits: press_review.created
```

### Stage 5 — Cleanup
```
if !isSuggestedPressReview:
    deleteByAccountId(accountId, processStartTime)
    └─ Removes processed articles from ArticleCache

if isSuggestedPressReview AND sortScorePreferences set:
    applySortScore(accountId, sortScorePreferences)
```

---

## Workflow 3 — Suggested Press Review

Same pipeline as Workflow 2 but with `isSuggestedPressReview=true`. Key differences:

| Behaviour | Regular | Suggested Press Review |
|-----------|---------|----------------------|
| `cleanDuplicateArticles` | ✅ runs | ❌ skipped |
| Dedup/Syndication/Grouping | runs if `!sendToEditorialTool` | always runs |
| Autoclip merging | ✅ runs | ❌ skipped |
| Emission | `content.optimized` per article | `suggested_press_review.completed` (single summary message) |
| Article limit enforcement | publish up to limit | `rejectArticlesOutsideLimit()` — marks excess as rejected |
| Cleanup | `deleteByAccountId` | ❌ skipped; `applySortScore` runs instead |

---

## Workflow 4 — Quality Control (`quality.control.triggered`)

```
Kafka: quality.control.triggered
    │
    ▼
AppController.processQualityControl(message.data)
    │
    └─ sendToQualityCheck(accountId, sectionsArticlesLimits, qualityCheckObject)
          │
          └─ BriefMetricsService.checkQualityTrigger() per section
                ├─ Fetch/create today's BriefTriggerMetrics row
                ├─ If already flagged (triggerVolume or triggerRelevance) → return true
                ├─ Fetch last 7 days of metrics
                ├─ Skip check if < 2 historical rows or averageVolume < 15
                ├─ Compare today's count/score against 7-day average
                └─ If deviation > DEVIATION_THRESHOLD (50%) → flag brief for manual review
```

---

## All Skip Conditions for `content.optimized`

| # | Reason | Config / Flag |
|---|--------|---------------|
| 1 | `optimization.triggered` never received | upstream service issue |
| 2 | Article count exceeds limit | `PROCESS_LIMIT` (default 10,000) |
| 3 | Quality deviation exceeds threshold | `DEVIATION_THRESHOLD` (default 0.5), requires ≥2 days of history and avg ≥15 |
| 4 | `sendToEditorialTool=true` and `isSuggestedPressReview=false` | brief config flag |
| 5 | No articles in `ArticleCache` at `processStartTime` | articles never arrived or already deleted |
| 6 | All articles filtered out by minimum word count | `sectionsMinimumArticleLength` |
| 7 | Processing timeout | `KAFKA_PROCESS_TIMEOUT` (default 240s) |

---

## Key Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `APP_ENV` | — | Kafka topic prefix |
| `SIMILARITY_RATIO` | `1.0` | Print dedup Dice's coefficient threshold |
| `WEB_MATCH_THRESHOLD` | `0.7` | Web syndication Jaccard threshold |
| `PRINT_MATCH_THRESHOLD` | `0.7` | Print syndication Jaccard threshold |
| `GROUP_MATCH_THRESHOLD` | `0.5` | Article grouping Jaccard threshold |
| `THRESHOLD` | `5` | Broadcast autoclip merge window (minutes) |
| `DEVIATION_THRESHOLD` | `0.5` | Quality gate variance (50%) |
| `KAFKA_PROCESS_TIMEOUT` | `240000` | Per-event max processing time (ms) |
| `KAFKA_PROCESS_LIMIT` | `10000` | Max articles before skipping processing |

---

## Database Tables

| Table | Role |
|-------|------|
| `ArticleCache` | Staging area — articles saved on `content.matched`, deleted after emission |
| `Article` | Optimized articles (post-pipeline) |
| `DeliveredArticle` | Tracks press review deliveries to prevent re-delivery |
| `BriefTriggerMetrics` | Daily volume/relevance metrics per brief/section for quality gating |
