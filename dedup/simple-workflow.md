# Deduplication Service — Simple Overview

## What does this service do?

It receives articles matched to a brief, cleans them up (removes duplicates, syndicates, etc.), and sends the final list downstream.

---

## Two main inputs

| Event | What happens |
|-------|-------------|
| `content.matched` | Article is saved to the database. Nothing else. |
| `optimization.triggered` | The full pipeline runs for that brief. |

---

## The Pipeline (when `optimization.triggered` arrives)

```
1. GUARD CHECKS
   - Too many articles (>10,000)?  → stop
   - Quality looks suspicious?     → send to manual review, stop

2. DEDUPLICATION
   - Same print article published across multiple regional editions?
   - Keep the main edition, delete the rest.

3. SYNDICATION REMOVAL
   - Same article republished on multiple websites / papers / broadcasts?
   - Keep one, delete the rest.

4. GROUPING
   - Similar (but not identical) articles?
   - Link them under a shared group_id so the consumer can display them together.

5. AUTOCLIP MERGING  (TV / Radio only)
   - Same broadcast segment appearing multiple times within 5 minutes?
   - Merge the autoclip metadata into one article.

6. EMIT
   - Send each surviving article as: content.optimized
   - Send a summary message: content.optimization.completed
   - If press review is configured: press_review.created

7. CLEANUP
   - Delete processed articles from the staging table.
```

---

## Why would `content.optimized` never arrive?

1. `optimization.triggered` was never sent by the upstream service
2. Too many articles in the DB for that brief (>10,000)
3. Article volume/relevance looks unusual — routed to manual review
4. Brief is configured with `sendToEditorialTool=true` (bypasses emission)
5. No articles in the DB at the time of processing
6. All articles were too short (below configured minimum word count)
7. Processing took longer than 4 minutes (timeout)

---

## Kafka events produced by this service

| Event | Meaning |
|-------|---------|
| `content.optimized` | One optimized article |
| `content.optimization.completed` | All articles for a brief have been sent |
| `press_review.created` | Press review is ready |
| `suggested_press_review.completed` | Suggested press review is ready |
| `content.optimization.progress_sent` | Informational progress message |
| `content.optimization.error` | Something went wrong |
