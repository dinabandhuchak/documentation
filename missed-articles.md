## Investigating Missing **Matched** (`onclusive.delivery.event.content.matched`) Events in Content Service

This playbook outlines best practices for investigating cases where an article did **not** generate a `matched` (`onclusive.delivery.event.content.matched`) event from the **Content Service**.
There have been multiple support tickets regarding this issue. The typical summary of such tickets is:

> The client reports that certain article(s) were not delivered, even though those articles appear in the results of the query configured for them in the [**Query Tool**](https://querytool.platform.onclusive.org).

---

### 📌 Note:

The screenshots in this document use values from a specific support ticket for illustration purposes. Please substitute these with relevant values from the ticket you're investigating.

**Example Ticket Details Used:**

* Ticket: [THD-11523](https://onclusive.atlassian.net/browse/THD-11523)
* `brief_id`: `8548`
* `article_id`: `5689315c48f8e8710804a6a11ef1802011ce71fe1ee7f8f39bf26f74ddc299cf`
* `title`: *Edinburgh law firm raises £3,090 in charity Will-writing campaign*
* `date`: `16-06-2025`

---

## Steps to Investigate Missing Matched Event

### 1. **Verify that the event is not present**

Visit the *Admin Tool's* [**Article Finder**](https://client-brief.platform.onclusive.org/admin/find-article) page.
Use the filters to input the article's `id` and `brief_id` (*account id*).
Select the **matched** (`onclusive.delivery.event.content.matched`) event from the dropdown and set the **Start Date** to the expected delivery date.

> 🔍 *Note:* Sometimes the match might have occurred a day earlier — be sure to check the previous date as well.

Then click the **Filter** button. There should be **no results** for the article if the matched event truly didn't happen.

![Article Finder](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20092916.png)

---

### 2. **Investigate the query**

Visit the **Client Brief** [**Account Page**](https://client-brief.platform.onclusive.org/).
From the ticket, identify the relevant section and the query that was supposed to match the article.

Navigate to the query's detail page by clicking **Edit** on the 3-dot menu next to the query.

![Account Section](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20094048.png)
![Query Edit Page](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20094126.png)

**First**, go to the **Results** tab on the query page.
Set the date picker to the match date and verify that the article in question is present in the results.

![Query Results](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20095031.png)

*(In the screenshot above, the article is highlighted and visible in the results for the date)*

**Second**, check the **History** tab of the query.
If the query was modified **after** the match date, it might mean the article didn’t match the **original** version of the query, even though it does match the **current** version.

![Query History](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20095123.png)

*(In the screenshot above, the query hasn’t been changed since January 2025, so it’s likely the same as it was on the match date.)*

---

### 3. **Investigate Media Filters**

Go to the **Media Filters** tab of the account on the [**Client Brief**](https://client-brief.platform.onclusive.org/) page.
If media filters are attached, click **Edit** on the 3-dot menu next to the filter to open the filter’s configuration.

![Media Filter Tab](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20101107.png)

On the media filter page, click the **History** tab.
Check whether the publication list was changed **after** the match date.

> 🔍 *Note:* If the filter was changed after the match date, it’s possible the **previous version** of the media filter excluded the article — and therefore it was filtered out during processing.

![Media Filter History](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20102020.png)

*(In the screenshot, the media list was last changed in February 2025 — so it did not affect the match on 16-06-2025.)*

> 🛈 **Tip:** The same applies to section-level media filters. If the section had a filter attached at the time, it could have influenced whether the article matched. Use the same process to check history at the section level.

---

### 4. **Investigate Account History**

Return to the **account page** of the client in [**Client Brief**](https://client-brief.platform.onclusive.org/).
Changes in account configuration — especially in **sections** and their associated queries — can affect whether a match occurs.

For example, if the relevant query wasn’t attached to the section on the match date, the article wouldn't have matched.

Check the **History** tab of the account and look for changes before or after the match date.

![Account History](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20103444.png)

*(In the screenshot, we can see that the **WILL AID** section — where the query was attached — was last updated on 12-06-2025, which is before the match date of 16-06-2025.)*

---

### 🔗 Related Tickets:

* [THD-11523](https://onclusive.atlassian.net/browse/THD-11523)
* [THD-11460](https://onclusive.atlassian.net/browse/THD-11460)
* [THD-12272](https://onclusive.atlassian.net/browse/THD-12272)
* [THD-12201](https://onclusive.atlassian.net/browse/THD-12201)
* [THD-12140](https://onclusive.atlassian.net/browse/THD-12140)
* [THD-12004](https://onclusive.atlassian.net/browse/THD-12004)
* [THD-12003](https://onclusive.atlassian.net/browse/THD-12003)
* [THD-11810](https://onclusive.atlassian.net/browse/THD-11810)
* [THD-11524](https://onclusive.atlassian.net/browse/THD-11524)
* [THD-11386](https://onclusive.atlassian.net/browse/THD-11386)

