# GUM Webhooks — Quick Reference

## Conditions for a webhook to actually fire (V1)

All must be true, or the event is silently dropped:

1. `ENABLE_WEBHOOKS_V1=true` in `.env` (legacy events ignore this flag)
2. Redis flag `gum:webhooks:suppress` is not `'1'` (set during bulk imports)
3. The app is "reachable": `User → UserClient → Client → Account → AccountContract → Contract → ContractFeature → Feature.applicationGrants`, with no soft-deletes anywhere in the chain. Only `MANAGED_GRANT_CODES = ['cm', 'unified', 'pro', 'prmanager', 'rep']` count.
4. That app key has `WEBHOOK_<APPKEY>_URL` and `WEBHOOK_<APPKEY>_SECRET` both set (non-empty) in `.env` — see `supportedConnections()` in `src/utils/webhooks.ts`. Note: `prmanager` has no entry there at all (pre-existing gap).
5. Something actually changed reachability or a tracked field — plain edits only notify apps already reached; no cascade to unaffected users.

## Action → Event map (V1)

| Action | Event(s) |
|---|---|
| Edit Account name/Salesforce ID | `account.updated` |
| Soft-delete Account | `account.deleted` |
| Restore Account | `account.restored` |
| Add Contract to Account | `account.created` (first reach) or `account.updated` |
| Remove Contract from Account | `account.updated` or `account.deleted` |
| Manually activate/deactivate Account | `account.updated` (`isActive` change) |
| Associate Client to Account | `client.created` or `client.updated` |
| Edit Client name | `client.updated` |
| Soft-delete Client | `client.deleted` |
| Restore Client | `client.restored` |
| Remove Client from Account | `client.updated` or `client.deleted` |
| Edit/update Contract | `contract.updated` (`contract.created` never fires) |
| Soft-delete Contract | `contract.deleted` |
| Toggle Contract Features | `contract.updated` |
| Assign User to Client | `user.created` or `user.updated` |
| Remove User from Account/Client | `user.updated` or `user.deleted` |
| Edit User name/email | `user.updated` |
| Soft-delete User | `user.deleted` |
| Restore User | `user.restored` |
| Grant added via grant-sync | `grant.created` |
| Grant removed via grant-sync | `grant.deleted` |
| Admin bulk fan-out | `user.created` per reachable app, `sequence: 0` |

Cascade: Account/Client/Contract mutations also fire `user.*` for every user whose reachability changed (gained/lost an app) — never for a plain attribute edit.

## Legacy events (always on, ignore the V1 flag)

| Action | Event |
|---|---|
| User email changed | `update.user_email` |
| User name changed | `update.user_name` |
| User granted an app | `create.grant` |
| User denied/removed from an app | `delete.grant` |

## How to inspect locally

- BullBoard UI: `/queues` (Admin only) → `webhooks` queue → job `data` has `schemaVersion`/`payload` for V1, `event` string for legacy.
- Redis: `redis-cli keys 'bull:webhooks:*'` then `hgetall` on a job key.
- Quick log: add a `console.log` in `enqueueWebhookV1()` (`src/utils/webhooks-v1.ts`) to see every V1 payload before it's queued.
- Must restart `npm run dev` after changing `.env` webhook vars.
