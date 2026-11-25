# Send to Review: Porter setup for production

Porter app: `o360-prod-server`. Do these steps after the velocity branch is merged into the deployment branch and deployed.

The same setup was done and verified on staging (`onclusive-360-rails`).

## 1. Run the migration

There's no pre-deploy migration job, so run it right after the deploy. The admin organisation page returns 500 until the new tables exist.

```bash
porter app run o360-prod-server -- bundle exec rails db:migrate
```

It only creates `review_account_mappings`, `review_send_jobs` and `review_sent_mentions`.

## 2. Environment variables (app level)

- `EDITORIAL_TOOL_BASE_URL`: the production URL, **without `/api`** at the end
- `EDITORIAL_TOOL_AZURE_TENANT_ID`
- `EDITORIAL_TOOL_AZURE_CLIENT_ID`
- `EDITORIAL_TOOL_AZURE_CLIENT_SECRET`: mark it as a **secret** (lock icon)
- `EDITORIAL_TOOL_AZURE_SCOPE`
- Check that `APP_STACK` is already set. Without it, sends stay queued.

Optional, only to change the defaults:
- `REVIEW_DELIVERY_BATCH_SIZE` (default 500; keep 500 in production until PP-6246 is released)
- `REVIEW_DELIVERY_BATCH_INTERVAL_SECONDS` (default 60)

## 3. Worker: `send-to-review-queue`

- Command: `bundle exec sidekiq -t 25 -c 2 -q send_to_review`
- 0.5 CPU, 1130 MB, grace period 30 s
- After it deploys, check the logs: it should boot and connect to Redis.

## 4. Create the features

Preview first, then create them:

```bash
porter app run o360-prod-server --interactive -- bundle exec rake features:dry_run
porter app run o360-prod-server --interactive -- bundle exec rake features:manage
```

In `features:manage`, answer **n** to renames, **n** to deprecated, **y** to Continue.

Expected: `Send-to-reviews` and `Send-to-reviews-unlock-all` created, `Features updated: 0`, nothing removed. If the dry run shows anything else, stop and check first.

## 5. Check a send

After the organisation's mapping and feature overrides are set up in Admin and a test send is made:

```bash
porter app logs o360-prod-server --service send-to-review-queue --since 15m --search SendToReview
```

Expected: `outcome=published http=201`.
- `http=501`: the production default section isn't chosen yet (PP-6247)
- `http=400`: the Review account isn't enabled for `publish-by-ids`
- `unauthorized`: the Azure values or Editorial Tool access

## Rollback

- Scale the `send-to-review-queue` worker to 0 to stop deliveries. Queued sends wait in Sidekiq.
- The migration only adds tables, so it can stay in place.
