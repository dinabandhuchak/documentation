# Feature: Add Custom Social Pages to Coverage (X, Facebook, Instagram, YouTube)

This feature allows users to add custom social media sources (Twitter/X, Facebook Pages, Instagram Business/Creator Accounts, YouTube channels, and Instagram hashtags) to their monitoring system by connecting tokens and providing URLs.

---

## Supported Sources & URLs

* **X (Twitter)** — e.g., `https://x.com/elonmusk`
* **Instagram** — e.g., `https://www.instagram.com/badgalriri/`
* **Facebook Page** — e.g., `https://www.facebook.com/rihanna`
* **YouTube Channel** — e.g., `https://www.youtube.com/channel/UCcgqSM4YEo5vVQpqwN-MaNw`

Users can paste these URLs into the system to begin monitoring.

---

## Token & Authentication Requirements

* **Facebook & Instagram**

  * Require a **Facebook login flow** with user consent.
  * Tokens are linked to the user’s Facebook account.
  * Instagram monitoring specifically requires a **Business or Creator account**, connected via Facebook.
  * Tokens **expire after \~60 days**. Users can refresh them in the interface.

* **YouTube**

  * Requires Google OAuth login.
  * Tokens **do not expire**.

* **Twitter/X**

  * Does not require a token for monitoring a public profile.
  * Validation ensures the account is public and not locked.

---

## Token Expiration & Renewal

* Facebook and Instagram tokens:

  * Expire every \~60 days.
  * The interface must show how many days remain until expiration.
  * Users receive **email reminders 10 days and 1 day before expiry**.
  * Users can refresh tokens at any time (before or after expiration).

* YouTube tokens:

  * Do not expire.

---

## Quotas & Limitations

* Each type of monitored source has a **quota** (numbers configurable).

  * Example:

    * 10/30 hashtags used
    * 10/20 Twitter accounts used
    * 0/30 Instagram accounts used

* Quotas must be clearly displayed in the UI.

* For Instagram hashtags: maximum **30 hashtags per connected Business/Creator account**.

---

## Source Adding Workflow

### Twitter (X)

1. User pastes a Twitter URL.
2. System checks if the profile is **public**.

   * If private → show error.
   * If valid → save URL and close form.

### Facebook Page

* **First-time connection (user-level):**

  1. User clicks "Connect Facebook Account".
  2. New window opens → Facebook OAuth login.
  3. After successful login, window closes, and UI updates to show connected account.
  4. User pastes a **Facebook Page URL** to monitor.
  5. Validation checks:

     * Page must be **public**.
     * Page must not be **country restricted**.
     * Page must not be a **personal profile**.
     * If invalid → error message.
     * If valid → save and close form.

* **If already connected:**

  * Show connected account and URL form.
  * Apply same validation before saving.

### Instagram Business/Creator Account

* **First-time connection (platform-level):**

  1. User clicks "Connect Facebook Account".
  2. OAuth flow → must connect a **Facebook account linked to a Business/Creator Instagram account**.
  3. After login, user selects which Instagram Business/Creator account to connect.
  4. Form updates to show connected Instagram account.
  5. User pastes Instagram account URL to monitor.
  6. Validation checks if it is a Business/Creator account.

     * If not → error.
     * If yes → save and close form.

* **If already connected:**

  * Show dropdown of connected Instagram Business/Creator accounts.
  * Allow linking another account if desired.
  * Provide URL input field.
  * Validate account type before saving.

### Instagram Hashtags

1. Form allows user to paste/type a hashtag.
2. Dropdown of connected Business/Creator accounts is shown.
3. Validation checks:

   * The selected account has available quota (≤30 hashtags).
   * If quota exceeded → error.
   * If valid → save and close form.

### YouTube Channel

* **First-time connection (user-level):**

  1. User clicks "Connect Google Account".
  2. OAuth login flow opens in a new window.
  3. After success, window closes, and UI updates to show connected account.
  4. User pastes YouTube channel URL.
  5. Validation ensures the channel is **public**.

     * If not → error.
     * If yes → save and close form.

* **If already connected:**

  * Show connected account and URL form.
  * Apply same validation before saving.

---

## User Interface Requirements

* Display quotas clearly (e.g., `10/30 hashtags`).
* Show connected accounts (Facebook, Instagram, YouTube) and their linked tokens.
* Show when tokens were added and how many days since.
* Provide a **refresh button** for tokens.
* Display error messages for invalid/unsupported sources.


---

## API Quotas and Rate Limits Across Social Platforms

| Platform        | Quota Type                      | Limits                                                                                                               |
| --------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Instagram**   | Hashtag Limit                   | Max **30 unique hashtags** per Business/Creator account per 7-day rolling period                                     |
|                 | API Call Rate Limit             | \~**200 calls/hour** per user + app combo                                                                            |
| **Facebook**    | Page-Level Rate Limit           | Calls limited **per Page**, not just per app                                                                         |
|                 | API Call Limits                 | \~**200 calls/user/hour**, \~**600 calls/app/min**; monitor with `X-App-Usage` headers                               |
| **YouTube**     | Daily Quota (Units)             | **10,000 units/day** per project                                                                                     |
|                 | Unit Costs per Method           | Varies: e.g., `search.list` = 100 units, `videos.insert` = 1600 units                                                |
|                 | Rate Limits (Burst Control)     | Hidden **per-second quotas** may throttle even if daily quota remains                                                |
| **Twitter (X)** | Rate Limits (per 15-min window) | Varies by **plan** (Free, Basic, Pro, Enterprise). Example: Basic plan → **180 requests/15 min** for standard search |
|                 | Monthly Tweet Cap               | Depends on plan. Example: Basic → **500K tweets/month** (read + write combined)                                      |
|                 | Access Scope                    | Limits apply at the **app level** (all users of the app share the quota)                                             |

