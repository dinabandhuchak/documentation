# Auth0 Overview

Auth0 is an **Identity-as-a-Service (IDaaS)** platform—a cloud service that manages user authentication and identity verification for software applications.

Instead of building login systems, password management, multi-factor authentication, and single sign-on logic from scratch, Onclusive integrates Auth0 to securely handle identity verification across customer-facing services.

## Key Points

* **Password Outsourcing:** Individual Onclusive applications do not store user passwords in their local databases. Password storage and password-reset flows are managed entirely by Auth0.

* **Application Access Grants:** Application access is tracked centrally in Auth0 user metadata.

* **Local Roles vs. Central Identity:** Auth0 determines **who the user is** and **which applications they have access to**. Internal roles, workspace permissions, and business-specific data remain stored in each application's local database.

### Combined Metadata Structure

The following metadata structure is returned by `/user/metadata`:

```json
{
  "lang": "en",
  "applications": [
    { "application": "gum" },
    { "application": "analyst" },
    { "application": "prmanager" },
    { "application": "rep" }
  ]
}
```

---

# Auth0 API Middleware

To centralize user authentication and application access grants across products without creating duplicate accounts or unintentionally deleting existing accounts, Onclusive built a custom **API Middleware**.

The middleware acts as a stateless wrapper around the Auth0 Management API. It provides simple endpoints for individual applications to use while applying Onclusive-specific business rules.

## 1. POST `/token` — Server Authorization

**Purpose:** Called **backend-to-backend** by an individual application's server using the OAuth 2.0 Client Credentials Grant to obtain a short-lived `access_token`. This token must be included in subsequent middleware API calls to authorize the request.

### Example Request

```json
{
  "client_id": "<CLIENT_ID>",
  "client_secret": "<CLIENT_SECRET>",
  "audience": "https://<AUTH0_DOMAIN>/api/v2/",
  "grant_type": "client_credentials",
  "application_api": "https://<AUTH0_DOMAIN>"
}
```

### Example Response

```json
{
  "statusCode": 200,
  "message": "Management API Access Token",
  "access_token": "<ACCESS_TOKEN>"
}
```

## 2. POST `/user` — User Provisioning and Access Granting

**Purpose:** Called by an application backend to provision a new user or grant application access to an existing user.

### Middleware Logic

1. **New User:** If the user does not exist in Auth0, the middleware provisions a new Auth0 identity using `email`, `name`, `temp_password`, and `lang`. It sets the default metadata and adds the target application to `app_metadata.applications`. Auth0 then sends a localized email containing a password setup link.

2. **Existing User:** If the email already exists in Auth0 because the user has access to another Onclusive application, the middleware **does not create a duplicate user or reset the user's password**. Instead, it adds the requesting application to the user's `app_metadata.applications` array and returns the existing canonical `user_id`.

### Example Request

```json
{
  "user_id": "<USER_ID>",
  "email": "user@example.com",
  "name": "Example User",
  "temp_password": "<TEMP_PASSWORD>",
  "email_verified": true,
  "lang": "es",
  "client_id": "<CLIENT_ID>",
  "connection": "<AUTH0_CONNECTION>",
  "application_api": "https://<AUTH0_DOMAIN>",
  "access_token": "<ACCESS_TOKEN>"
}
```

### Example Response — Granting Access to an Existing User

```json
{
  "statusCode": 200,
  "user_id": "<USER_ID>",
  "message": "Granted access to existing user.",
  "action": "updated"
}
```

## 3. PATCH `/user` — Updating User Details and Metadata

**Purpose:** Called by an application backend to update existing user attributes in Auth0, such as the primary email address, display name, password, or language preference (`lang`).

### Middleware Logic

* Locates the user using `current_email` and updates the specified user attributes.
* **Language Handling (`lang`):** Supported language codes are `en` (default), `es`, `fr-FR`, `de`, `it`, and `zh-CN`.
* If `lang` is omitted or passed as an empty string, the existing language preference in Auth0 remains unchanged.

### Example Request

```json
{
  "current_email": "user@example.com",
  "email": "user+newemail@example.com",
  "name": "Example User",
  "password": "<PASSWORD>",
  "lang": "es",
  "client_id": "<CLIENT_ID>",
  "application_api": "https://<AUTH0_DOMAIN>",
  "access_token": "<ACCESS_TOKEN>"
}
```

## 4. DELETE `/user` — Revoking Application Access

**Purpose:** Called by an application backend to revoke a user's access to that specific application.

### Middleware Logic

1. **Multi-App User — Conditional Access Revocation:** The middleware checks `app_metadata.applications`. If the user has access to other Onclusive applications, the delete operation is converted into an update that removes only the requesting application's grant while preserving the user's central Auth0 account.

2. **Single-App User — Hard Delete:** If no other active application grants remain in `app_metadata`, the middleware performs a full hard delete of the user record from Auth0.

### Example Request

```json
{
  "current_email": "user@example.com",
  "client_id": "<CLIENT_ID>",
  "application_api": "https://<AUTH0_DOMAIN>",
  "access_token": "<ACCESS_TOKEN>"
}
```

### Example Response

```json
{
  "statusCode": 200,
  "message": "Removed application access for this user."
}
```

---

# Global User Management (GUM)

**Global User Management (GUM)** is a centralized hub for managing user accounts and application access across Onclusive applications.

GUM uses the same **Auth0 API Middleware** to perform actions on Auth0 user records.

It provides a single interface for user management and notifies individual applications about changes made to user records through webhooks. This allows applications to update their local records accordingly.

## Webhook Events

GUM sends webhook events to applications for the following types of changes:

* `update.user_email` — The user's email address was changed.
* `update.user_name` — The user's name was changed.
* `create.grant` — The user was granted access to an application.
* `delete.grant` — The user's access to an application was revoked.

## Auth0 as the Source of Truth

Individual applications can still call the Middleware APIs to update user records directly, as **Auth0 is the single source of truth for central user identity and application access**.

Therefore, when a user navigates to GUM, they will see the latest user and access information stored in Auth0.
