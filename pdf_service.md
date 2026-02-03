# PDF Service API

Generate PDFs for print, broadcast, and web articles.

---

## POST `/create`

Generate a PDF from request payload or a fetched article.

---

### Request

**Content-Type:** `application/json`

---

### Body Parameters

| Name                 | Type     | Required | Description                   |
| -------------------- | -------- | -------- | ----------------------------- |
| `id`                 | string   | ❌        | Article ID to fetch           |
| `title`              | string   | ❌        | Article title                 |
| `content`            | string   | ❌        | Article body                  |
| `publication`        | string   | ❌        | Publication name              |
| `published_on`       | string   | ❌        | Publish date (ISO)            |
| `locale`             | string   | ✅        | Locale (e.g. `en_gb`)         |
| `author`             | string   | ❌        | Author / presenter            |
| `url`                | string   | ❌        | Media URL (mp3/mp4)           |
| `country`            | string   | ❌        | Country                       |
| `domain`             | string   | ❌        | Domain                        |
| `media_type`         | string   | ❌        | Media type                    |
| `licenses`           | string[] | ❌        | License list                  |
| `truncate_amount`    | number   | ❌        | Truncate content length       |
| `truncate_phrases`   | string   | ❌        | Stop phrases                  |
| `header_format`      | string   | ❌        | Header layout                 |
| `annotation_style`   | string   | ❌        | `highlight`, `underline`, etc |
| `annotation_phrases` | string   | ❌        | Pipe-separated keywords       |
| `is_reach_hidden`    | boolean  | ❌        | Hide reach value              |
| `ave_type`           | string   | ❌        | `legacy` or `new`             |
| `uploaded_pdf_url`   | string   | ❌        | External PDF source           |
| `is_transcript`      | boolean  | ❌        | Enable transcript mode        |
| `start_time`         | string   | ❌        | Transcript start time         |
| `end_time`           | string   | ❌        | Transcript end time           |
| `program_name`       | string   | ❌        | Program name                  |

---

### Required Fields

#### Transcript PDF (`is_transcript = true`)

| Field          |
| -------------- |
| `title`        |
| `publication`  |
| `published_on` |
| `content`      |
| `locale`       |

**Additional rules:**

* `id` **must not** be provided
* `start_time` and `end_time` must both be provided to calculate duration
* `author` maps to **Presenter** in the PDF header
* `program_name` appears in the header
* `url` is used as the media (audio/video) link

---

#### Non-Transcript PDF (`is_transcript = false` or omitted)

**One of the following must be provided:**

* `id`
  **OR**
* `title`, `content`, `publication`, `published_on`

`locale` is always required.

---

### Behavior

* If `id` is provided → article is fetched and request fields override fetched data
* If `uploaded_pdf_url` is provided → headers are modified on the uploaded PDF
* Otherwise → PDF is generated from article data
* Transcript-specific headers are rendered when `is_transcript = true`
* Annotations are applied if `annotation_phrases` is present

---

### Example (Transcript PDF)

```json
{
  "title": "U.S. Policy on Venezuela under Trump",
  "author": "Matt Barbet",
  "publication": "BBC One London",
  "published_on": "2026-02-02T11:33:18.000Z",
  "media_type": "tv",
  "content": "13:35:00 Policy of the United States Government...",
  "locale": "en-us",
  "is_transcript": true,
  "program_name": "BBC London",
  "start_time": "2026-01-06T13:35:00+00:00",
  "end_time": "2026-01-06T13:36:00+00:00",
  "url": "https://example.com/media.mp4"
}
```

---

## GET `/`

Generate a PDF for **print / broadcast articles**.

---

### Query Parameters

| Name                 | Type    | Required | Description                    |
| -------------------- | ------- | -------- | ------------------------------ |
| `article_id`         | string  | ✅        | Article ID                     |
| `application_id`     | string  | ✅        | Application identifier         |
| `hash`               | string  | ✅        | Request hash                   |
| `locale`             | string  | ✅        | Locale                         |
| `pdf_type`           | string  | ❌        | `any`, `full`, `clip`, `front` |
| `pages`              | string  | ❌        | Page ranges (`1-3,6`)          |
| `pdf_headers`        | boolean | ❌        | Inject headers                 |
| `header_format`      | string  | ❌        | Header layout                  |
| `page_size`          | string  | ❌        | `a4`, etc                      |
| `resize_pdf`         | boolean | ❌        | Resize PDF                     |
| `annotation_style`   | string  | ❌        | Annotation style               |
| `annotation_phrases` | string  | ❌        | Pipe-separated keywords        |
| `is_reach_hidden`    | boolean | ❌        | Hide reach                     |
| `full_page_link`     | boolean | ❌        | Inject full-page link          |
| `media_type`         | string  | ❌        | Media source                   |

**Supported `media_type`:**
`print`, `web`, `tv`, `radio`, `podcast`, `youtube`, `twitter`, `facebook`, `instagram`

---

### Example

```http
GET /?article_id=98765&application_id=app1&locale=en_gb&hash=abc123
&pdf_type=full&pages=1-2&annotation_phrases=climate|policy
```

---

## GET `/web`

Generate a PDF for **online / web articles**.

---

### Query Parameters

| Name                   | Type    | Required | Description             |
| ---------------------- | ------- | -------- | ----------------------- |
| `article_id`           | string  | ✅        | Article ID              |
| `locale`               | string  | ✅        | Locale                  |
| `truncate_amount`      | number  | ❌        | Truncate content        |
| `truncate_phrases`     | string  | ❌        | Stop phrases            |
| `header_format`        | string  | ❌        | Header layout           |
| `annotation_style`     | string  | ❌        | Annotation style        |
| `annotation_phrases`   | string  | ❌        | Pipe-separated keywords |
| `ave`                  | string  | ❌        | AVE value               |
| `is_reach_hidden`      | boolean | ❌        | Hide reach              |
| `is_url_header_hidden` | boolean | ❌        | Hide URL header         |
| `media_type`           | string  | ❌        | Defaults to `web`       |

**Supported `media_type`:**
`print`, `web`, `tv`, `radio`, `podcast`, `youtube`, `twitter`, `facebook`, `instagram`

---

### Example

```http
GET /web?article_id=abc123&locale=en_gb
&truncate_amount=500
&annotation_phrases=election|economy
&is_url_header_hidden=true
```

---

## Common Responses (All Routes)

### `200 OK`

* **Content-Type:** `application/pdf`
* **Content-Disposition:** `inline; filename=<id>.pdf`

### `400 Bad Request`

```json
{ "message": "Missing required fields" }
```

### `404 Not Found`

```json
{ "message": "Article with ID <id> not found." }
```

### `408 Request Timeout`

```json
{ "message": "Media API Query timed out" }
```

### `503 Service Unavailable`

```json
{ "message": "Service temporarily overloaded" }
```

### `500 Internal Server Error`

```json
{ "message": "Failed to generate PDF" }
```
