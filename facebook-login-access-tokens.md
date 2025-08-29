# Facebook Login & Access Tokens — Reference

## Login Flow (Authorization Code Grant)

1. **Login Dialog**

   ```
   https://www.facebook.com/v{api-version}/dialog/oauth
     ?client_id={APP_ID}
     &redirect_uri={URL-encoded-redirect}
     &state={CSRF_token}
     &response_type=code
     &scope={space-separated-permissions}
     [&auth_type=rerequest|reauthorize]
   ```

   * **client\_id** — Facebook App ID
   * **redirect\_uri** — Callback URL registered in the app
   * **state** — Random string for CSRF protection
   * **response\_type** — Use `code` for server-side flow
   * **scope** — Space-separated permissions (e.g., `pages_show_list pages_read_engagement`)
   * **auth\_type** — Optional (`rerequest` to re-ask declined scopes, `reauthorize` to force re-login)

2. **Redirect Back**
   Facebook redirects to `redirect_uri` with parameters:

   * `code` — Authorization code (used for token exchange)
   * `state` — Must match the original CSRF token

3. **Exchange Code → Short-Lived Token**

   ```
   https://graph.facebook.com/v{api-version}/oauth/access_token
     ?client_id={APP_ID}
     &client_secret={APP_SECRET}
     &redirect_uri={redirect_uri}
     &code={authorization_code}
   ```

   Response includes:

   * `access_token` — User token
   * `token_type` — Typically `bearer`
   * `expires_in` — Time-to-live in seconds (\~2 hours)

4. **Exchange for Long-Lived Token (\~60 days)**

   ```
   https://graph.facebook.com/v{api-version}/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={short_lived_token}
   ```

---

## Access Token Types

* **User Access Token**
  Represents a person using the app. Required to access their Pages.

  * Short-lived (\~2h) or long-lived (\~60d).

* **Page Access Token**
  Represents a Facebook Page. Obtained by calling `/me/accounts` with a valid user token.

* **App Access Token**
  Represents the app itself. Used for introspection and debugging (`/debug_token`).

* **Client Token**
  Used in SDKs; not valid for Graph API calls.

---

## Permissions for Page Tracking

* `pages_show_list` — List Pages a person manages
* `pages_read_engagement` — Read posts, comments, and metadata from a Page
* `read_insights` — Access Page insights and analytics
* `pages_manage_metadata` — Manage subscriptions and metadata for Pages

---

## Token Debugging

Use `/debug_token` to inspect tokens:

```
https://graph.facebook.com/debug_token
  ?input_token={token_to_check}
  &access_token={APP_ID}|{APP_SECRET}
```

Response fields include:

* `is_valid` — Whether the token is valid
* `app_id` — App the token belongs to
* `type` — Token type (USER or PAGE)
* `user_id` — User ID (for User tokens)
* `scopes` — Granted permissions
* `expires_at` — Token expiration time
* `data_access_expires_at` — Data access expiration time (90 days)

---

## Token Expiration

* **Token Expiry**
  Defined in `expires_in` (short-lived) or `expires_at` (long-lived).

* **Data Access Expiry**
  Separate 90-day expiry requiring user re-consent, regardless of token validity.

---

## Renewing Tokens

* If only token expiry is near → Perform long-lived exchange again.
* If data access has expired or permissions are missing → Redirect user to Login Dialog with `auth_type=rerequest`.

