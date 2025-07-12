This is a playbook about best practices for investigation what might have caused the article did not **matched**(`onclusive.delivery.event.content.matched`) event by the **Content Service**. There have been many support tickets relating to this issue. Essentially the summary of the ticket is this, they will complain about article(s) being not deliveried to a client. But those articles are present in the results for the query they have setup for the client for the date in the [**Query Tool**](https://querytool.platform.onclusive.org).

---

## Steps to investigate the missing **matched**(`onclusive.delivery.event.content.matched`) event

1. **Verify that the event not present**
    Visit the _Admin Tool_'s [**Article Finder**](https://client-brief.platform.onclusive.org/admin/find-article) page. In the filter input the article's `id` and `briref id`(_account id_). Select **matched**(`onclusive.delivery.event.content.matched`) from the event dropdown and pick the **Start Date** which should be the expected delivered date(One thing to note, somethimes match might happend a day before. so, check of the previous date too). Then click on the filter button, no articles should be there on the results table.
    ![aritcle_finder_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20092916.png)
2. **Investiagte the query**
    Visit the **account** page of the client in [**Client Brief**](https://client-brief.platform.onclusive.org/). From the ticket determine the section and the query attach to it was suppose to match the article(s). Nativate to the query page of the attached query by clicking the _"Edit"_ button in the popup when clicked on the _3 dots_ icon for the query.
    ![account_page_section_tab_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20094048.png)
    ![attached_query_page_schreenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20094126.png)

3. 

---

### Related:
- https://onclusive.atlassian.net/browse/THD-11523
- https://onclusive.atlassian.net/browse/THD-11460
- https://onclusive.atlassian.net/browse/THD-12272
- https://onclusive.atlassian.net/browse/THD-12201
- https://onclusive.atlassian.net/browse/THD-12140
- https://onclusive.atlassian.net/browse/THD-12004
- https://onclusive.atlassian.net/browse/THD-12003
- https://onclusive.atlassian.net/browse/THD-11810
- https://onclusive.atlassian.net/browse/THD-11524
- https://onclusive.atlassian.net/browse/THD-11386