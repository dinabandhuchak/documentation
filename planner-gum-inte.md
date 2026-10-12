# GUM events to Planner: response for Planner owners

**For:** the owners of GUM and the Onclusive Auth0 middleware  
**From:** GUM owners (draft for review)  
**Raised:** 2026-10-08  
**Status:** This is a code- and documentation-based response, not a production enablement confirmation. Planner is not currently configured as an active GUM webhook receiver. No secret has been exchanged. Owner confirmation is needed before implementation.

## Important before building

The GUM repository contains `WEBHOOK_FORWARD_PLANNER_URL` and `WEBHOOK_FORWARD_PLANNER_SECRET` configuration fields, and recognizes the grant key `forward-planner`. However, the legacy webhook sender does not currently register that grant key as a webhook connection. Its `forward-planner` connection entry is commented out. As a result, setting those environment variables alone would not cause Planner events to be delivered. GUM owners must add and test the connection before Planner can subscribe.

Answers below describe the current implementation unless explicitly marked as needing owner confirmation. They should not be treated as a commitment to a delivery date or as confirmation of the proposed Planner endpoints.

## A. The token and the signature

### 1. Authorization header

The current sender puts a JWT in `Authorization: Bearer <token>`. It signs that JWT with HS256 using the shared webhook secret. The JWT payload includes `sig` and the standard `iat` and `exp` claims; its expiration is five minutes after issue. The `sig` claim is the HMAC signature described below. The JWT's own signature authenticates the claims; it is separate from the HMAC of the event payload.

### 2. Signed bytes and encoding

GUM computes HMAC-SHA256 over the event JSON string produced by `JSON.stringify(event)`. Node.js hashes the UTF-8 bytes of that string. The resulting digest is encoded using standard Base64, including padding. GUM signs the event string, not the outer HTTP request body.

### 3. Request body and content type

The current sender posts an outer JSON object whose `event` property is a **string** containing the serialized event, approximately:

```json
{
  "event": "{\"event\":\"create.grant\",\"application\":\"forward-planner\",\"data\":{\"name\":\"Example User\",\"email\":\"user@example.com\"}}"
}
```

The request uses `Content-Type: application/json`. This differs from a body in which `event`, `application`, and `data` are top-level JSON properties. Planner should not build against the latter without an agreed sender change.

### 4. Real staging request and firewall

GUM cannot provide a real Planner staging request yet: Planner is not registered as a webhook connection, and no Planner endpoint or secret is configured for delivery. The shape above and the JWT details are code-backed, but they are not a substitute for a captured request from staging. The firewall behavior and its JSON inspection rules are owned by Planner. Before enabling delivery, the teams should exchange a captured staging request and test it with representative names, including apostrophes, through the actual edge path. Do not use a fabricated token or request as a production contract.

### 5. Secret exchange and rotation

The integration guide says to contact Chris to establish a shared secret and provide the webhook endpoint. GUM uses a separately configured secret per webhook connection/environment. The current sender reads one secret per connection; it has no built-in dual-secret rotation window. Owners must agree on a secure exchange process and rotation overlap procedure. Planner can accept old and new secrets during a transition if its receiver supports that, but GUM will send with only the currently configured secret.

## B. Delivery

### 6. Non-2xx responses, timeouts, retries, and operator visibility

Axios treats non-2xx responses and request failures as errors, and GUM throws those errors so BullMQ retries the job. The queue uses exponential backoff, with `QUEUE_BACKOFF_DELAY` as its base delay. The defaults in the application are 1,000 ms and 50 attempts, but deployment configuration can override them. A successful 2xx response completes the job; the response body does not change the event processing decision.

Failures are written to the worker logs and can be inspected in the admin Bull Board queue at `/queues`; completed and failed job retention is configured separately. The GUM user editing request does not wait for delivery, and the current code does not notify the operator who made the change when a later webhook delivery fails. The deployed retry values and alerting/monitoring behavior need confirmation from the GUM operators.

### 7. Ordering and duplicate delivery

Yes. A retry may deliver an event again if Planner processed it but GUM did not receive the response. Events are separate queue jobs, and the contract has no event ID or per-user ordering guarantee. Planner should make processing idempotent and must not rely on arrival order. The current payload does not provide an event ID with which to deduplicate reliably.

### 8. Event ID, change time, and GUM operator

Not today. The legacy event payloads contain event type, application, and the fields shown in the integration guide; they do not include a stable event ID, mutation timestamp, or the GUM operator. Adding these fields requires a GUM implementation change and owner agreement on their definitions and privacy/retention. Until then, Planner can record GUM as the source, but cannot reliably attribute an event to a particular operator or exact change time.

### 9. Planner UAT downtime

GUM can retry 5xx responses, but retries are finite and use exponential backoff. Whether they span the full Planner UAT shutdown window depends on the deployed attempt count, base delay, queue/Redis availability, and when the event was first sent. GUM cannot confirm that the proposed 03:00–21:00 UTC window is covered without checking the deployed configuration and observing a staging test. The teams should test an event sent before and during the window and agree on alerting and recovery for an exhausted job before relying on this behavior.

## C. The events

### 10. Planner application value and targeting

The grant key used for Forward Planner is `forward-planner`. `create.grant` and `delete.grant` are generated as application-targeted events for the grant that was added or removed. `update.user_email` is generated as `broadcast` and delivered to configured applications that currently hold a grant. `update.user_name` is also defined as a broadcast event in the documentation, but its generation is currently commented out.

The intended targeting is therefore: grant events to the matching application; email changes to granted applications. The current delivery registry does not include `forward-planner`, so Planner presently receives none of these events until GUM explicitly enables and validates that connection.

### 11. Changes made through the middleware

The GUM webhook code runs when a user is updated through GUM's own user-update flow. A change made directly by Planner through the middleware (`POST /user`, `PATCH /user`, or `DELETE /user`) does not pass through that GUM webhook flow, and GUM does not send Planner an event for it. The middleware owners should confirm whether any separate callback or synchronization mechanism exists outside this repository.

### 12. `update.user_name` and enablement

The current name event contains only `from_name` and `to_name`, so Planner cannot safely identify a user from it. It does not include the account email. More importantly, GUM currently has name-event generation commented out, so it is not being sent. There is no enablement date or committed plan in the repository. To enable it usefully for Planner, GUM would need to add a stable identifier (at minimum an email, though an immutable user ID is preferable) and agree a rollout/test date with Planner.

### 13. Account lifecycle cases

- **New account with Planner access from the start:** The current legacy webhook builder detects a newly added grant during GUM's user-update flow. The repository does not establish a separate notification path for a newly provisioned account that starts with the Planner grant already present. GUM owners must confirm whether the real onboarding path invokes the update flow or emits another event.
- **Account loses Planner access:** Removing the Planner grant through GUM's update flow generates a targeted `delete.grant` event. A hard deletion of the Auth0 account is not shown as a separate legacy webhook event in this implementation. Please clarify whether “delete an account” means revoke Planner access or delete the identity itself.
- **Email change and Planner grant in one step:** The update flow can generate both `update.user_email` (`broadcast`) and `create.grant` for the newly added application. The email event is built first, but delivery is asynchronous and there is no contractual ordering guarantee. Both currently depend on GUM enabling the `forward-planner` webhook connection.

### 14. Language and company/organisation on `create.grant`

Not today. `create.grant` contains only `name` and `email`. Although GUM stores language metadata in Auth0 in other flows, it is not included in this legacy event; company or organisation is not included either. Supporting these fields requires a payload change and agreement on field names, source of truth, and behavior when values are absent or ambiguous.

### 15. `POST /user` when Planner already has a grant

The integration guide says that when the Auth0 user already exists, `POST /user` returns HTTP 200 with the existing `user_id`, `action: "updated"`, and the message `Granted access to existing user.` The guide does not specifically define the case where that same user already has the same Planner grant. The middleware owners should confirm that repeating this request is idempotent and specify its exact response before Planner depends on it.

### 16. Auth0 token after `delete.grant`

GUM removes the application grant from the user's GUM-managed Auth0 `app_metadata` and emits `delete.grant`; Planner's stated action is to disable the local user and end the session. This repository does not establish whether an already-issued token remains valid, whether a new token for Planner can still be issued, or how quickly middleware/Auth0 enforcement takes effect. The middleware/Auth0 owners must confirm token issuance and revocation behavior. Planner should not treat webhook receipt alone as proof that existing tokens are invalidated.

## D. Before we start

### 17. Current Planner-grant account lists

GUM cannot provide verified staging and production account lists from this repository. That requires authorized reads from each Auth0 tenant and a tenant-by-tenant export of users whose `app_metadata.applications` contains `{"application":"forward-planner"}`. The GUM/Auth0 tenant owners should provide the exports through an approved secure channel and agree how to handle duplicates, disabled users, and email changes during reconciliation. Do not use development or fixture data as a production baseline.

### 18. Middleware hostnames

The integration guide documents these hosts:

- Production: `https://auth0-middleware.api.onclusive.org/`
- Staging: `https://staging-auth0-middleware.api.onclusive.org/`

It does not document the `.com` production hostname. For calls intended to use the staging tenant, the documented staging hostname is the appropriate starting point; the middleware owners must confirm DNS, routing, and tenant mapping before Planner changes its configuration. The `auth0-middleware.api.onclusive.com` hostname and the claim that UAT currently reaches the staging tenant through it are not verified by this GUM repository.

## Owner confirmations needed before build

1. GUM owners: enable and validate `forward-planner` delivery; confirm deployed retry settings, staging request capture, the onboarding event path, and the secure secret-rotation procedure.
2. GUM and middleware owners: decide whether to add event ID, timestamp, operator, stable user identifier, language, and organisation fields; confirm what happens on hard account deletion.
3. Middleware/Auth0 owners: confirm duplicate-grant behavior for `POST /user`, token issuance/revocation after grant removal, and the correct UAT/staging hostname and tenant mapping.
4. GUM/Auth0 tenant owners: provide staging and production grant inventories through an approved secure channel.

## Implementation references

- [Onclusive Auth0 integration and webhook contract](Onclusive-Auth0-Integration-and-Overview.txt)
- [Legacy webhook event generation and routing](../src/utils/webhooks.ts)
- [Webhook signing and delivery worker](../src/utils/workers/webhooks.ts)
- [JWT and HMAC implementation](../src/utils/jwts.ts)
- [Forward Planner grant mapping](../src/utils/grants.ts)
- [Forward Planner grant script](../auth0/user_management/src/add_user_grant.rb)
