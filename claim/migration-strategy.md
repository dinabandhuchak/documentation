# Story 7.1: Bulk Import Users from Application — Draft Migration Strategy

**Status:** Draft

## Purpose

One-time, per-application bulk migration of an integrated app's existing Accounts/Clients/Users into GUM's CLAIM data model, so GUM becomes the source of truth for that app going forward.

## Open Questions / Risks (resolve before implementation)

- **Service-layer functions vs. raw bulk Prisma writes.** Going through `createAccount()` / `addContractToAccount()` / `assignUserToClient()` gets audit logging and webhook fan-out (Story 5.3's `withFanOut`) for free, but `addContractToAccount()` also enqueues `enqueueContractRecompute`, which fans out to every reachable user. Going raw skips all of that (including audit logs) and needs its own compensating-rollback logic hand-rolled to match. Pick one per mutation type and say so explicitly in step 4 — don't leave it implicit.
  - **Note (verified against current code):** `createAccount()`, `addContractToAccount()`, and `assignUserToClient()` (`src/utils/accounts.ts:1`, `src/utils/user_clients.ts:1`) all call a module-level `prisma` singleton, not an injectable transaction client. There is **no way to compose them inside a single `prisma.$transaction()`** and get real automatic rollback-on-throw. This means choosing the service-layer path (for audit/webhook correctness) and choosing DB-transactional atomicity are mutually exclusive — you can't have both. Step 5's rollback is therefore **manual compensating-delete, not DB-transaction rollback**, and that should be stated as an intentional consequence of this choice, not left to be discovered later by someone who tries to wrap the sequence in `$transaction` and gets silently non-transactional behavior.

- **Auth0 Management API throughput.** There is no bulk-update endpoint (see `docs/learnings/auth0-management-api-rate-limits.md`); every `gum_user_id` patch is one PATCH call. The per-user worker that performs this patch is `src/utils/workers/user-link.ts` (Story 3.8's `user-import` queue), running at **concurrency 2, rate limit 3 jobs/second** (verified against current code — not 5 concurrent/5 jobs/s as earlier drafts of this doc assumed). If step 3's shared Contract is attached via `addContractToAccount()`, it separately enqueues `recompute-contract-users` onto the `grant-sync` queue (concurrency 1, rate limit 1 job/s — confirmed), which fans out to every reachable user across every account sharing that contract. For a migration of any real size this could take hours — recalculated estimate: **~9.3 hours for 100k users at 3 jobs/s** (not the ~5.5 hours previously cited at an assumed 5 jobs/s). Use 3 jobs/s as the basis for any wall-clock estimate given to stakeholders, and decide whether to batch or throttle further.

- **Webhook fan-out during the run — reuse Story 5.4's suppress-then-reconcile pattern, don't disable it outright.** Story 5.4 solved this exact problem for Story 3.8's bulk Auth0 import (uncontrolled `user.created`/`grant.created` floods mid-import): set the `gum:webhooks:suppress` Redis flag (`src/utils/redis.ts`) for the duration of the migration run so every `withFanOut()`-wrapped mutation still writes to the DB/audit log but skips webhook emission, then clear the flag on completion/cancel and run a controlled reconciliation fan-out so consuming apps still learn about the new data, just not as an uncontrolled flood mid-run.
  - **Scoping does not exist yet — this is new work, not reuse.** `POST /admin/webhooks/sync/start` (`src/routes/admin/webhook-sync.ts`) currently enqueues a single `'fanout-all-users'` job that walks **every non-deleted user in the entire tenant**, in chunks of 1,000 (`src/utils/workers/webhook-sync.ts`, `src/utils/queues/webhook-sync-queue.ts`) — there is no account-scoping parameter anywhere in the route, the job payload, or the worker's chunking query. Before relying on a "scoped to the newly-migrated accounts" reconciliation step, this needs to be built: a scoping parameter threaded through the route → BullMQ job payload → worker's chunk query.
  - **Decision point until that's built:** either (a) build the scoped fan-out first, or (b) fall back to the existing unscoped tenant-wide fan-out after the migration, accepting that it re-syncs every user in the tenant — not just the migrated accounts — which is slower and pushes needless webhook volume at consuming apps. Pick one explicitly rather than assuming scoping is a small tweak.
  - Note this only matters for apps in `MANAGED_GRANT_CODES` (`cm`, `unified`, `pro`, `prmanager`, `rep` — see `docs/learnings/managed-vs-non-managed-grant-split.md`); migrating a non-managed-grant app has no webhook reachability concept to worry about at all.

- **Auth0 PATCH-to-null semantics are unverified — required before implementing step 5.** Step 5's rollback reverts a failed account's Auth0 links via `PATCH user_metadata: { gum_user_id: null }`, assuming Auth0's shallow merge removes the key rather than storing a literal `null`. This is **not confirmed anywhere in `docs/learnings/`** (only `auth0-management-api-rate-limits.md` exists, and it doesn't cover this). This is not cosmetic: `processSearchUnlinked`'s `has_gum_user_id` check (`src/utils/workers/user-link.ts:169`) treats any non-empty metadata key as "linked" — if the PATCH doesn't actually clear the key, a rolled-back user would be **silently and permanently excluded** from all future import attempts, local or Auth0-side, with no error surfaced anywhere. **Action required before implementing step 5's Auth0-revert logic:** run a small spike against a real Auth0 sandbox/dev tenant confirming `PATCH user_metadata: { gum_user_id: null }` actually removes the key (not just sets it to `null`). Do not proceed with step 5 until this is confirmed.

- **How `recompute-contract-users` actually fans out is unclear — confirm before finalizing throughput estimates.** It's not established whether the job processes all reachable users synchronously within that single job (so the `grant-sync` queue's 1 job/s throttle only gates job *dequeue*, with per-job duration scaling with account size), or whether it itself enqueues further per-user jobs onto the same throttled queue (compounding queue depth). Read `src/utils/workers/grant-sync.ts` and confirm which model applies before finalizing any wall-clock estimate for step 3.

## Step-by-step strategy

### 1. Get application data

Source data (CSV or other format) must contain:

- **Accounts**: business name, Salesforce ID (optional)
- **Clients**: business name, which account it belongs to
- **Users**: email, name, Auth0 user ID, which client(s) they're assigned to

Note: for applications with no concept of sub-divisions/clients (e.g. 360/Mention), either assign a placeholder client value in the export or fall back to each account's auto-created default client.

### 2. Validate the application data (before any DB writes)

- **Structure**: every record has non-empty required fields (`businessName`, `email`, `auth0UserId`, etc.)
- **Uniqueness**: no duplicate user emails / `auth0UserId`s within the file
- **Referential integrity within the file**: every reference to another entity in the file must resolve to a real row in that same file (e.g. a Client's `account_id` must match an Account row present in the export; a User's `client_id` must match a Client row present in the export). Dangling references are rejected/flagged before import starts.

### 3. One-time setup: application Contract

Before looping over accounts, look up or create the application's real Contract:

- If a suitable Contract already exists (matching the application's feature set), reuse it.
- If not, create one with the application's relevant `contractFeatures`/`applicationGrants` enabled — **feature selection must be confirmed by the team, not guessed by the script.**
- This Contract is shared across all migrated accounts for this application via the `accountContracts` many-to-many join (supported by the schema — "most common case is 1 Contract per Account," but sharing across accounts is an intended use case).
- Note: `createAccount()` already auto-attaches a separate placeholder default Contract to every new account regardless — this real Contract is attached *in addition to* that default, not instead of it.
- **Throughput note:** attaching this Contract to many accounts via `addContractToAccount()` enqueues one `recompute-contract-users` job per account, which fans out to every reachable user under it. At the `grant-sync` queue's 1 job/s throttle, this is very likely the long pole of the whole migration — estimate the total user count up front and budget wall-clock time accordingly (see Open Questions above, including the still-open question of whether the fan-out happens within one job or via further enqueued jobs on the same queue).

### 4. Upsert into GUM (per account, treated as one atomic unit)

For each account in the source data:

1. **Match or create the Account**:
   - If the source record has a `salesforceId`, look up an existing Account by `salesforceId` first — this is the more reliable identity key.
   - Only fall back to matching by `businessName` (case-insensitive exact match) when no `salesforceId` is present, and treat a name-only match as needing manual review rather than auto-merging (names are prone to formatting mismatches and false positives).
   - If no match found, create a new Account.
2. **Attach the application's real Contract** to this Account via `accountContracts` (from step 3).
3. **Create or reuse Client(s)** under this Account (or use the account's default client, for apps with no client concept).
4. **Create/upsert Users**, link each to the appropriate Client(s) via `userClients`, and patch Auth0 `user_metadata.gum_user_id` for each (same mechanism as Story 3.8's per-user import worker, `src/utils/workers/user-link.ts`).
   - **Match key policy (required, currently missing):** apply the same rigor as step 4.1's Account matching. `users.email` and `users.auth0UserId` are hard DB-unique constraints, so a source row for a user who already exists locally (previously imported via Story 3.8, or already migrated for a different application, or an agency user already linked to clients under another account) must be matched by `auth0UserId` first, falling back to `email`, and **linked** via a new `userClients` row rather than blindly created — a raw create against an existing email/auth0UserId will throw a unique-constraint violation and needlessly fail that entire account's subtree.
   - **Conflict policy for matched users (required, currently missing):** when a matched existing user's source-CSV `name`/`email` differs from the local record, do not silently overwrite. Default to **skip-and-flag-for-review** — log the conflicting row to the same failed/flagged report used for dangling references in step 2 — and let the team decide the final policy (overwrite, prefer-local, prefer-source) before implementation. This mirrors step 4.1's manual-review treatment of ambiguous Account name matches; user identity fields deserve the same caution.

### 5. Rollback (per account)

- Treat each account (plus its Clients/Users) as one atomic migration unit.
- Rollback here is **manual compensating-delete, not a DB transaction rollback** — see the Open Questions note above on why the service-layer functions used in step 4 can't participate in a single `prisma.$transaction()`.
- If any step within an account's subtree fails, roll back only that account's subtree:
  - Delete any local rows created for this account (Account/Clients/Users/`userClients`) during this run.
  - **Also revert any Auth0 `user_metadata.gum_user_id` patches already applied to users in this subtree** — leaving a stale `gum_user_id` pointing at a deleted local row would incorrectly mark that Auth0 user as linked when they are not (`processSearchUnlinked`'s `has_gum_user_id` check would then permanently skip that user on any future import attempt). Revert via `PATCH user_metadata: { gum_user_id: null }` — **do not implement this until the Auth0 PATCH-to-null spike above is confirmed** (Auth0's shallow merge is assumed, not verified, to remove a key when it's explicitly set to `null`).
  - **Also account for in-flight async side effects, not just synchronous rows/patches.** If step 4.2 (attach Contract) succeeds and enqueues a `recompute-contract-users` job onto `grant-sync`, and a later step in the same account's subtree then fails, that job is already queued and will run against a database state for an account that's about to be rolled back/deleted. Confirm (or add as a task to confirm) that the `grant-sync` worker tolerates a since-deleted account gracefully — e.g. filters on `deletedAt` — before relying on this; if it doesn't, the rollback needs to also remove/no-op the pending job.
  - **The shared Contract from step 3 is out of scope for any single account's rollback.** It's created once, outside the per-account loop, so one account's failure must never delete or modify it.
- Leave successfully migrated accounts untouched — do not fail the whole run because one account failed.
- Keep a separate log/CSV of failed accounts (with reasons) for retry or manual follow-up.

### 6. Validate the migration result

After all accounts have been processed (successes only):

- Row counts match: number of accounts/clients/users imported equals the corresponding counts in the source export.
- Every imported user has at least one `userClients` row (nobody left unlinked).
- Every imported client has a valid `accountId` (nobody left orphaned).
- No duplicate emails or `auth0UserId`s were created.
- **Activation is not automatic and that's expected:** `checkAndUpdateAccountActivation()` never auto-activates an account, only auto-deactivates on failing criteria. Migrated accounts will need manual activation afterward (the same "Activate" button flow that runs `checkActivationRequirements()`) — call this out explicitly to whoever runs the migration rather than leaving it implicit, so it isn't mistaken for a bug.

### 7. Export CSV

Only after validation passes, generate a CSV containing the successfully migrated data:

```
original_app_id, gum_user_id, gum_client_id, gum_account_id, gum_contract_id
```

Downloadable by an Admin; used by the app team to update their local shadow-copy tables with GUM's IDs.

### 8. Post-migration lockdown (application-side, not GUM)

Once the app team has consumed the CSV and updated their local tables, the application must **block local edits** to fields now owned by GUM — e.g. `businessName`, `salesforceId`, user email/name, and Account/Client/Contract assignments. Local admin interfaces in the app should redirect users to GUM to make these changes instead. This is tracked separately under Technical Story 3 and is the app team's responsibility, not something implemented in GUM's codebase.
