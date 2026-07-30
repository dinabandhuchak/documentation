# Content Service — Simple Overview

The Content Service sits between a scheduling system and a delivery pipeline. Its job is to figure out which articles belong to which customer at a given point in time, publish those articles, and then hand off to the next stage.

---

## Core Idea

Each customer has sections with search queries and medialists. When a schedule fires, the service runs those queries against the media API for the relevant date range, collects the matching articles, and publishes them. Once all articles are published, it tells the downstream service to go ahead and build the brief — that is the optimization trigger.

---

## Workflows

### 1. Standard Account

A schedule fires for a customer. The service:
- Validates the account is active and has valid queries (each query must have a medialist, otherwise it is dropped).
- Runs each query against the media API, splitting large date ranges into 24-hour windows to avoid timeouts.
- Collects all matched articles across all sections and publishes them in a batch to Kafka.
- Waits a short time (proportional to article count) so all matched events have time to land before the next stage reads them.
- Emits the optimization trigger, carrying per-section preferences (deduplication rules, syndication filters, article limits, grouping) so the downstream service knows how to build the brief.

### 2. Press-Review Account

Press-review accounts have a different delivery model — the brief is built on a fixed schedule rather than immediately after matching. Because of this, the optimization trigger is sent separately, not at the end of matching.

When the press-review trigger fires:
- The service fetches the latest account config (sections, preferences, quality control settings).
- It builds the optimization payload with the full section hierarchy, sort score preferences, and client config snapshot.
- It emits the optimization trigger immediately — no article fetching happens here. The articles were already published during an earlier matching run.

### 3. Press-Review — Quality Control

For press-review accounts where `qualityControl` is enabled, instead of triggering optimization directly after matching, the service emits a quality control trigger. This only happens if:
- The account's delivery start time is within the next 60 minutes (meaning the brief is about to be delivered soon).
- The repeat interval is either daily (`00:00`) or greater than 5 hours — short-interval schedules skip quality control.

The quality control step checks article volume and relevance thresholds before allowing the brief to proceed.

### 4. France-Internal Delivery

Some accounts deliver to French internal systems which use a separate Kafka topic. When an account has `france-internal` as a delivery destination:
- Matched articles are published to the france-internal topic.
- If the account also delivers elsewhere, articles are published to the standard topic too.
- If france-internal is the only destination, the press-review optimization trigger is blocked (the account is treated as invalid in that path).

---

## What Can Go Wrong

- **Account deactivated** — the job is dropped and an error event is emitted. No articles are published.
- **Query has no medialist** — a query without a medialist would return unfiltered results, so it is skipped and an error event is emitted.
- **Any unhandled error** — BullMQ retries the job up to 50 times with exponential backoff before giving up.

---

## Stack

- **NestJS** — framework
- **Kafka** — receives schedule triggers, receives press-review triggers, receives all outbound events
- **BullMQ + Redis** — queues matching jobs so they are processed with controlled concurrency and retried on failure
