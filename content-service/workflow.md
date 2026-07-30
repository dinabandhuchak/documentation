# Content Service — In-Depth Reference

## Purpose

The Content Service bridges a scheduling system and a downstream delivery pipeline. When a customer's brief is due, a schedule fires a Kafka event. This service picks it up, runs the customer's search queries against the media API to find matching articles, publishes those articles to Kafka, and then emits a trigger so the downstream service can build and deliver the brief.

The service handles two distinct account types — standard and press-review — which differ in when and how the optimization trigger is sent. It also handles a quality control gate for press-review accounts where article volume and relevance need to be verified before delivery.

---

## Infrastructure

| Component | Technology | Why |
|---|---|---|
| Message broker | Apache Kafka (`@nestjs/microservices`) | Decouples this service from schedulers and downstream consumers |
| Job queue | BullMQ + Redis | Allows controlled concurrency and automatic retries if matching fails |
| Framework | NestJS | Dependency injection, Kafka microservice support |

---

## Kafka Topics

| Topic | Direction | Purpose |
|---|---|---|
| `{APP_ENV}.delivery.content` | Inbound & Outbound | Receives schedule/press-review triggers; emits all outbound events |
| `{APP_ENV}.percolate.matching.output` | Outbound | Separate topic for france-internal article routing |

Both inbound event types share the same topic. `AppController` inspects `meta.message_type.name` to decide which path to take.

---

## Inbound Events (Consumed)

### `onclusive.delivery.event.content.schedule.triggered`
The primary trigger. Carries `account_id`, `start_date`, `end_date`, and `transaction_id`. The service enqueues a BullMQ job and processes it asynchronously, which allows multiple accounts to be processed concurrently with back-pressure control.

### `onclusive.delivery.event.content.press_review.triggered`
A separate trigger for press-review accounts. Unlike the schedule trigger, this does **not** start article matching — it skips straight to emitting the optimization trigger. This exists because press-review briefs are assembled on a fixed delivery schedule, and the articles were already published during an earlier matching run.

---

## Outbound Events (Emitted)

| Event name | `event_type` | Purpose |
|---|---|---|
| `content.match.progress_sent` | `info` | Observability — signals that processing has started and logs per-query progress. Consumed by monitoring, not by downstream pipelines. |
| `content.matched` | `match` | The core output — one Kafka message per matched article, batched for performance. Downstream services read these to build the brief. |
| `content.match.completed` | `complete` | Signals that all articles for this transaction have been published. Carries a summary of matched/skipped article counts. |
| `content.match.failed` | `error` | Signals that a transaction was dropped or hit an unrecoverable error. Downstream services can use this to mark a transaction as failed. |
| `content.optimization.triggered` | `optimize` | Tells the downstream optimization service to start deduplication, syndication filtering, grouping, and article-limit enforcement for this account. Carries all per-section preferences so the downstream service does not need to re-fetch the customer config. |
| `content.quality.control.triggered` | `quality` | For press-review accounts only. Tells the quality control service to check article volume/relevance thresholds before the brief is delivered. |

---

## Services

### `AppController`
The Kafka consumer entry point. Listens on `{APP_ENV}.delivery.content` and routes based on the event name in `meta.message_type.name`:
- `schedule.triggered` → delegates to `AppService` to enqueue a BullMQ job.
- `press_review.triggered` → delegates directly to `PressReviewService`.

### `AppService`
Creates a BullMQ job with the account ID and date range. Jobs are configured with 50 retry attempts and exponential backoff (starting at 2 seconds) to handle transient failures in the media API or downstream services.

### `ContentConsumer`
The BullMQ worker that runs the full article-matching pipeline. Concurrency is controlled by the `CONCURRENCY_PROCESS` environment variable (defaults to 1). See Workflow 1 for the full logic.

### `PressReviewService`
Handles the press-review optimization path. Fetches the latest account config, validates the account, builds the full deduplication payload including section hierarchy and quality control config, and emits the optimization trigger. See Workflow 2.

### `CustomersService`
Fetches the full account configuration from the customer API — sections, medialists, service preferences, contacts, feeds. This is the source of truth for all per-account settings used throughout the pipeline.

### `QueriesService`
Translates the customer's active sections into search queries for the media API. Each section becomes a query with filters for medialists, date ranges, content types, and syndication rules. A `lagTime` of 30 seconds is subtracted from the start date to catch articles that were crawled slightly after their actual publish time.

### `ArticlesService`
Executes the translated queries against the media API, scores articles using sort score preferences, deduplicates within the query, and returns the processed article list. Also tracks skipped articles with reasons for observability.

### `FeedsService`
Resolves international feed queries for customers who subscribe to curated feeds. Feed queries are combined with section queries and processed in the same loop.

### `QualityControlService`
Determines whether a quality control check is needed before delivering a press-review brief. The check is only relevant if the brief is about to be delivered soon (within the next 60 minutes) and the account has a daily or infrequent schedule (repeat of `00:00` or greater than 5 hours). Short-interval schedules skip quality control because the brief is regenerated frequently enough that minor quality issues self-correct.

### `EmitService`
The single exit point for all Kafka messages. Builds the typed headers and meta envelope for each event type and delegates to `ProducerService`. Uses `publish` for single messages and `publishBatch` for article arrays (more efficient for large article sets). See [EMIT_SERVICE.md](EMIT_SERVICE.md) for full details.

### `ProducerService` / `RedisService`
Infrastructure wrappers — Kafka producer and Redis client used internally by BullMQ.

---

## Workflows

### 1. Standard Account — Content Match & Optimization

```
Kafka: schedule.triggered
    │
    └─► AppController  ──  routes on meta.message_type.name
            │
            └─► AppService.publish()  →  BullMQ queue
                    │
                    └─► ContentConsumer.process()
                            │
                            ├─ emit info: processing started
                            │
                            ├─ fetch customer config
                            │       account inactive or not found?
                            │       └─ emit error, drop transaction
                            │
                            ├─ fetch queries (active sections) + feed queries
                            │       query missing medialist?
                            │       └─ emit error, log and skip that query
                            │
                            ├─ for each query/feed:
                            │       ├─ split date range into 24-hour windows
                            │       │       (avoids timeouts on large ranges)
                            │       ├─ emit info: query details
                            │       └─ fetch + score articles from media API
                            │
                            ├─ publish all matched articles (batched)
                            │       france-internal in destinations?
                            │       ├─ yes → publish to percolate.matching.output
                            │       └─ other destinations also exist?
                            │               └─ also publish to delivery.content
                            │
                            ├─ sleep proportional to article count
                            │       (gives matched events time to land before
                            │        the downstream service reads them)
                            │
                            ├─ is account press-review AND NOT send_to_editorial_tool?
                            │       yes → go to quality control path (Workflow 3)
                            │       no  → emit optimize (optimization.triggered)
                            │               carries: deduplicatePreferences,
                            │                        syndicatePreferences (web),
                            │                        printSyndicatePreferences,
                            │                        broadcastSyndicatePreferences,
                            │                        groupingPreferences,
                            │                        sectionsArticlesLimits,
                            │                        sectionsMinimumArticleLength,
                            │                        maxArticlesLimit,
                            │                        pressReview: false,
                            │                        deliveryDestinations
                            │
                            └─ emit complete: match.completed (summary of matched/skipped)
```

---

### 2. Press-Review Account — Schedule-Triggered Optimization

Press-review briefs are not built immediately after matching. Instead, a separate `press_review.triggered` event fires at the scheduled delivery time, and this service emits the optimization trigger at that point. This allows the brief to be assembled using all articles that were published during the matching window, not just those from a single run.

```
Kafka: press_review.triggered
    │
    └─► AppController
            │
            └─► PressReviewService.publishOptimizationForPressReview()
                    │
                    ├─ fetch latest account config
                    │
                    ├─ validate account:
                    │       account not found?            → emit error, return
                    │       only destination france-internal? → emit error, return
                    │         (france-internal-only accounts are not supported here
                    │          because they use a different delivery pipeline)
                    │       account endDate in the past?  → emit error, return
                    │
                    ├─ build dedup payload:
                    │       generatePreferences()
                    │         — walks section tree recursively including sub-sections
                    │         — collects per-section: dedup, syndication, article limits,
                    │           grouping, print/broadcast syndication, min article length
                    │       extractClientSectionsInfo()
                    │         — builds pressReviewStructure with section hierarchy and timing
                    │       getSortScore()
                    │         — determines which fields to use for article ranking
                    │       constructLatestClientConfig()
                    │         — snapshot of the full account config at trigger time
                    │         — downstream uses this so it doesn't need to re-fetch
                    │       createQualityCheckObject()
                    │         — quality control thresholds included in payload
                    │
                    └─ emit optimize (optimization.triggered)
                            carries everything above +
                            pressReview: true (signals a different assembly path downstream)
```

---

### 3. Press-Review Account — Quality Control Path

For press-review accounts where `qualityControl` is enabled, the service does not emit the optimization trigger directly after matching. Instead it emits a quality control trigger and lets that service decide whether the brief should proceed.

Quality control is only meaningful when the brief is about to be delivered. The check is skipped entirely if:
- The delivery start time is more than 60 minutes away — too early to be useful.
- The repeat interval is between 1 minute and 5 hours — short-interval briefs are regenerated frequently enough that quality issues self-correct without manual intervention.

```
ContentConsumer (after article matching and publish)
    │
    ├─ conditions to reach this path:
    │       brief_delivery_format === 'press-review'
    │       customer.qualityControl === true
    │       send_to_editorial_tool === false
    │
    └─ qualityControlService.qualityControlRequired()
            ├─ convert delivery startTime to UTC
            ├─ is startTime within the next 60 minutes?  → no: skip, no event emitted
            └─ is repeat '00:00' or > '05:00'?           → no: skip, no event emitted
                    │
                    yes to both:
                    └─ emit quality (quality.control.triggered)
                            carries: accountId, qualityCheckObject
                                     (volume/relevance thresholds),
                                     sectionsArticlesLimits, transactionId
```

---

### 4. France-Internal Delivery

Some accounts deliver content to French internal systems that consume from a dedicated topic (`percolate.matching.output`) rather than the standard delivery topic. The routing logic is:

- **France-internal AND other destinations** — publish to both topics so both pipelines receive the articles.
- **France-internal only** — publish only to the france-internal topic. The `PressReviewService` treats these accounts as invalid and will not emit an optimization trigger for them (they have their own pipeline).
- **No france-internal** — publish only to the standard topic.

---

## Error Handling

Every error path emits `content.match.failed` before returning or rethrowing, so downstream monitors always receive a signal when a transaction is dropped.

BullMQ retries failed jobs up to **50 times** with exponential backoff starting at 2 seconds. Failed jobs are retained for 72 hours; completed jobs for 24 hours (up to 25,000).

Specific drop conditions that do not retry (they emit error and return early):
- Account not found or deactivated (endDate in the past).
- Query with no medialist applied — running it would return unfiltered results, which is a data quality issue, not a transient failure.

---

## Event Message Structure

All events use the same envelope, built by `EmitService`:

```json
{
  "data": { },
  "includes": {
    "account": { }
  },
  "meta": {
    "message_type": {
      "name": "onclusive.delivery.event.content.<type>",
      "organization": "onclusive",
      "service": "delivery",
      "type": "event",
      "entity": "content",
      "subentity": "<match|optimization|quality>",
      "status": "<matched|triggered|completed|failed|info_sent>",
      "version": "1"
    },
    "occurred_on": "<ISO timestamp>",
    "transaction_id": "<uuid>"
  }
}
```

`publishBatch` sets the Kafka message `key` to `accountId` so all messages for the same account land in the same partition, preserving order for the downstream consumer.
