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
    First, **result** tab on the **query** page and pick out the date range from the date picker at the top. It should match the reported date of the match. Verify in the results that the missed matched articles is present.
    ![query_page_result_tab_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20095031.png)
    (_in the screenshot we can the article(higlighted) is present for the date_)
    
    Second, check the history of the query. If it has been alter after the date of the match. If the history has changed after the date of match. which would mean that for the match the query was different, for which the article did not match. And for the current query the articles are matching.
    ![query_page_history_tab_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20095123.png)
    (_in the schreentshot, we can see the query was not sicne the januagre of 2025 which means the query was same for match_)
3. **Investigate mediafilters**
    Visit the **account** page of the client in  [**Client Brief**](https://client-brief.platform.onclusive.org/). Navigate to _Media Filters_ tab, observe if there any media filter(s) attacch to the account. If media filter present then navigate to media filter's page by clicking _"Edit"_ button in the _popup_ on clinking _3 dots_ against the media filter.
    ![account_page_mediafilter_tab_scheenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20101107.png)
    
    On the media filter page, click on the **"History"** tab and determine if the publication was changed after the matched date. If it has been changed that would means previous filter might have filters out the article on the **Content Service** on procesing the query on the match day.
    ![medialist_page_history_tab_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20102020.png)
    (_In the screenshot, we can see in the history tab the media list was last changed on Feberary 2025 which means that it had not affected the query_)
    
    **Note: The same can be applied ot the section level. meaning if a section has any _media fitlers_ attached to it then it could affect the query. Hence, the process of determination same as above for the section**
4.  **Investigate account history**
    Visit the **account** page of the client in  [**Client Brief**](https://client-brief.platform.onclusive.org/). Many times change of account's configuration effect the query processing for the day. For example, if the section had not had the mention query for which the article should match, attached to it on the day of mathc. Then it would not have matched. To determine such cases we can navigate to the history tab and observe if any confiuration has been since the match day.
    ![account_page_history_tab_screenshot](https://raw.githubusercontent.com/dinabandhuchak/documentation/refs/heads/main/assets/Screenshot%202025-07-12%20103444.png)
    (_In the screenshot, we can that the account **WILL AID** section(query attached section) last updated(_12-06-2025_) before the match date(_16-06-2025_)_)



> **📌 Note:**
> The screenshots in this document use values from a specific support ticket for illustration purposes. Please substitute these with relevant values from the ticket you're investigating.
>
> **Example Ticket Details Used:**
> • Ticket: [THD-11523](https://onclusive.atlassian.net/browse/THD-11523)
> • `brief_id`: `8548`
> • `article_id`: `5689315c48f8e8710804a6a11ef1802011ce71fe1ee7f8f39bf26f74ddc299cf`
> • `title`: *Edinburgh law firm raises £3,090 in charity Will-writing campaign*
> • `date`: `16-06-2025`

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