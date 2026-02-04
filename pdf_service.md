# PDF Service API

Generate PDFs for print and web articles.

---

**Staging `BASE_URL`:**
`https://fetch-pdf-staging.platform.onclusive.org`

---

## POST `/create`

Generate a PDF from a request payload or a fetched article.

---

### Request

**Content-Type:** `application/json`

---

### Body Parameters

| Name                 | Type     | Description                    |
| -------------------- | -------- | ------------------------------ |
| `id`                 | string   | Article ID to fetch            |
| `title`              | string   | Article title                  |
| `content`            | string   | Article body                   |
| `publication`        | string   | Publication name               |
| `published_on`       | string   | Publish date (ISO)             |
| `locale`             | string   | Locale (e.g. `en_gb`)          |
| `author`             | string   | Author / presenter             |
| `url`                | string   | Media URL (mp3/mp4)            |
| `country`            | string   | Country                        |
| `domain`             | string   | Domain                         |
| `media_type`         | string   | Media type                     |
| `licenses`           | string[] | License list                   |
| `truncate_amount`    | number   | Truncate content length        |
| `truncate_phrases`   | string   | Stop phrases                   |
| `header_format`      | string   | Header layout                  |
| `annotation_style`   | string   | `highlight`, `underline`, etc. |
| `annotation_phrases` | string   | Pipe-separated keywords        |
| `is_reach_hidden`    | boolean  | Hide reach value               |
| `ave_type`           | string   | `legacy` or `new`              |
| `uploaded_pdf_url`   | string   | External PDF source            |
| `is_transcript`      | boolean  | Enable transcript mode         |
| `start_time`         | string   | Transcript start time          |
| `end_time`           | string   | Transcript end time            |
| `program_name`       | string   | Program name                   |

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
* Both `start_time` and `end_time` **must** be provided to calculate duration
* `author` is mapped to **Presenter** in the PDF header
* `program_name` appears in the PDF header
* `url` is used as the media (audio/video) link

---

#### Non-Transcript PDF (`is_transcript = false` or omitted)

**One of the following must be provided:**

| Field          |
| -------------- |
| `id`           |
| `publication`  |
| `published_on` |
| `title`        |
| `content`      |
| `locale`       |

`locale` is always required.

---

### Behavior

* If `id` is provided, the article is fetched from **GCH**. Any additional parameters provided will override the corresponding fields from GCH.
* If `uploaded_pdf_url` is provided, only header-relevant fields are used to inject headers into the uploaded PDF.
* Transcript-specific headers are rendered when `is_transcript = true`.
* Annotations are applied if `annotation_phrases` is present.

---

### Example (Transcript PDF)

**Payload:**

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

### Example (`uploaded_pdf_url`)

**Payload:**

```json
{
  "title": "test",
  "author": "test",
  "publication": "wwwwjjjsdhhd_test",
  "published_on": "2026-02-04",
  "country": "CAN",
  "media_type": "print",
  "publication_details": {
    "id": "d2686a0f-e10b-4225-9c97-e3ca2f371498",
    "gmd_id": 26713699,
    "family": "Communities",
    "frequency": "Continuously",
    "category": "Free Press",
    "media": "tv",
    "country": "CAN",
    "global_name": "wwwwjjjsdhhd_test",
    "region": "",
    "publication_tier": ""
  },
  "ave": 12,
  "reach": 1,
  "content": "test",
  "keywords": [],
  "metadata": {
    "print": {
      "surface": "0.08"
    }
  },
  "uploaded_pdf_url": "https://staging-editorial-tool.platform.onclusive.org/api/v1/files/download/pdfs%2F1770205820129_sample-local-pdf.pdf"
}
```

---

### Example (`id`)

**Payload:**

```json
{
  "id": "4797e672a647627bf42bdf17b60ca945fec5da66b67e461602e6d3004e87b6f1",
  "content": "ENGLAND fans in Bournemouth can head to the O2 Academy Boscombe...",
  "keywords": ["O2"],
  "url": "https://uk.news.yahoo.com/bournemouth-host-fan-park-england-000000721.html",
  "country": "GBR",
  "ave": 970.33,
  "reach": 207823,
  "author": "Alexander Smith"
}
```

---

## GET `/`

Generate a PDF for **print** articles.

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
| `page_size`          | string  | ❌        | `a4`, etc.                     |
| `resize_pdf`         | boolean | ❌        | Resize PDF                     |
| `annotation_style`   | string  | ❌        | Annotation style               |
| `annotation_phrases` | string  | ❌        | Pipe-separated keywords        |
| `is_reach_hidden`    | boolean | ❌        | Hide reach                     |
| `full_page_link`     | boolean | ❌        | Inject full-page link          |
| `media_type`         | string  | ❌        | Media source                   |

**Supported `media_type`:**
`print`, `web`, `tv`, `radio`

---

### Validation Hash

Requests must include a **SHA-256** hash to verify integrity.

**Order:**
`article_id` + `application` + `locale` + `salt`

* **Algorithm:** SHA-256
* **Format:** Hexadecimal string
* **Default application:** `validation_tool`
* **Default salt:** YOUR SECRET

---

### Example

```http
GET /?article_id=58129712&application_id=validation_tool&locale=it-it&hash=040668f9aafbe1451acb74fe3d7c6fd54aa544e04233a47c606cd5ff39123a4e&annotation_phrases=market&pdf_headers=true
```

---

## GET `/web`

Generate a PDF for **online** articles. Support for additional `media_type` values is available for **non-standard content**.

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
`print`, `web`, `tv`, `radio`

---

### Example

```http
GET /web?article_id=b4f6f7bf8bb84cb6bc08ca8fd3abe41a6a34f6269243bf3c46e8c44564390ba9&locale=en-gb&annotation_phrases=market&pdf_headers=true
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
{ "message": "Media API query timed out" }
```

### `503 Service Unavailable`

```json
{ "message": "Service temporarily overloaded" }
```

### `500 Internal Server Error`

```json
{ "message": "Failed to generate PDF" }
```
