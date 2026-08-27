# Epic 7 Migration Understanding

## Story 3.8: Import Users from Auth0

Story 3.8 provides a batch import from Auth0 into the local CLAIM database.

- It finds Auth0 users that are not yet linked to CLAIM.
- It upserts the local CLAIM `users` record:
  - Creates the record if it does not exist.
  - Updates the record if it already exists.
- It stores the local CLAIM user ID in Auth0 `user_metadata`:

```json
{
  "user_metadata": {
    "gum_user_id": 123
  }
}
```

This import handles the User identity record only. It does not automatically assign the User to an Account or Client.

## Reusing the Existing Worker

The new migration work should reuse the existing Story 3.8 per-user import worker and logic where possible.

Technical Story 8 should add the large-scale discovery process around that worker:

1. Start an Auth0 Bulk User Export job.
2. Poll Auth0 until the export is complete.
3. Stream and parse the exported users.
4. Skip users that already have `gum_user_id`.
5. Queue the existing `import-user` job for each remaining user.

## Story 7.1: Bulk Import from an Application

Story 7.1 is about importing existing data from an integrated application into the CLAIM database. This is broader than importing users from Auth0.

The application migration may need to include:

- Existing application user IDs.
- Auth0 user IDs or another user-matching strategy.
- Accounts.
- Clients.
- User-to-Client relationships.
- Existing Contracts and application grants.
- Source IDs needed for mapping the old application records to new CLAIM records.

Before implementation, clarify with the application team:

- What data will be exported?
- Which fields are required?
- How are Accounts and Clients represented?
- Can one User belong to multiple Clients?
- How are existing Contracts and grants represented?
- Which records are invalid, skipped, or rejected?
- How are duplicates handled?
- What does “lockdown” mean for the application?
- What rollback behavior is required?

The migration should validate the data before writing, verify the imported relationships afterward, and generate an ID mapping export for the application.

## Story 7.2: Incremental User Import

Story 7.2 supports a gradual migration instead of one large cutover.

CLAIM would provide an API that an integrated application can call to submit Users in batches. During the transition, some Users may be managed by GUM while others remain managed by the original application.

This requires:

- A batch migration API.
- Per-user migration status.
- Progress tracking.
- Retry handling for failed records.
- Lockdown only for Users that have migrated.
- Clear handling of already-migrated Users and duplicate records.

## Technical Story 8: Auth0 Bulk User Migration

Technical Story 8 is for migrating a large number of existing Auth0 users, currently estimated at more than 30,000, into CLAIM.

The normal Auth0 user-search endpoint is not suitable for a full-tenant migration because of its result limit. The proposed implementation uses Auth0’s Bulk User Export API and then reuses the existing per-user import worker.

This is intended to be an engineer-run cutover tool, not a regular Admin UI feature. It should be resumable after a restart, idempotent when rerun, rate-limited, and observable through logs or a status command/endpoint.

## Overall Distinction

```text
Story 3.8:
Auth0 users -> CLAIM User records

Technical Story 8:
Large Auth0 tenant -> Bulk Export -> existing Story 3.8 worker -> CLAIM Users

Story 7.1:
Integrated application data -> validation -> CLAIM Users, Accounts, Clients, and relationships

Story 7.2:
Integrated application -> batch migration API -> gradual per-user migration and lockdown
```
