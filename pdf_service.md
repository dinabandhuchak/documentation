# Documentation for PDF Service

## POST `/create`

Generate a PDF for an article and return it as `application/pdf`.

---

## Request

**Content-Type:** `application/json`

### Body

```json
{
  "id": "string",
  "title": "string",
  "content": "string",
  "publication": "string",
  "published_on": "string",
  "locale": "string",

  "country": "string",
  "domain": "string",
  "media_type": "string",
  "licenses": ["string"],

  "publication_details": {
    "global_name": "string",
    "id": "string",
    "gmd_id": 0,
    "family": "string",
    "frequency": "string",
    "category": "string",
    "language": "string",
    "media": "string",
    "country": "string",
    "support_name": "string",
    "region": "string",
    "publication_tier": "string"
  },

  "opengraph": {
    "og_image": "string",
    "og_description": "string"
  },

  "url": "string",
  "author": "string",
  "ave": 0,
  "ave_legacy": 0,
  "reach": 0,

  "domain_details": {
    "category": "string",
    "monthly_visits_average": 0,
    "time_on_site": 0,
    "daily_audience_average": 0,
    "unique_visitors": 0
  },

  "metadata": {
    "print": {
      "page_number": "string",
      "full_article_url": "string",
      "pdf_fullpages_url": ["string"],
      "pef_frontpages_url": ["string"],
      "surface": "string"
    }
  },

  "source": "string",
  "truncate_amount": 0,
  "truncate_phrases": "string",
  "header_format": "string",
  "annotation_style": "string",
  "annotation_phrases": "keyword1|keyword2",
  "is_reach_hidden": false,
  "ave_type": "legacy | new",
  "uploaded_pdf_url": "string",

  "is_transcript": false,
  "start_time": "string",
  "end_time": "string",
  "program_name": "string"
}
```

---

## Required Fields

### When `id` is **not** provided

| Field          |
| -------------- |
| `title`        |
| `content`      |
| `publication`  |
| `published_on` |
| `locale`       |

---

## Constraints

* `id` **cannot** be used together with `is_transcript = true`
* `publication_details.global_name` is required if `publication_details` is provided
* `annotation_phrases` must be pipe-separated (`|`)

---

## Behavior

* If `id` is provided → article is fetched and request fields override fetched data
* If `uploaded_pdf_url` is provided → headers are modified on the uploaded PDF
* Otherwise → PDF is generated from article data
* Annotations are applied if `annotation_phrases` is present

---

## Responses

### `200 OK`

* **Content-Type:** `application/pdf`
* **Content-Disposition:** `inline; filename=<title>.pdf`

### `400 Bad Request`

```json
{ "message": "Missing required fields: title, content, locale" }
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
