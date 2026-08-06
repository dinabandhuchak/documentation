**Standard & Broadcast Article Processing Workflow**

This document outlines the workflow logic for handling print, web, and broadcast media types through Percolate, the Optimization Service, Enrichment, and downstream systems.

---

### **1. Standard Media Workflow (Print & Web)**

Print and Web articles follow a direct, low-latency path without artificial delays.

* **Matching:** Articles are matched in Percolate against defined queries.
* **Optimization Service:** Upon reaching the optimization service, non-broadcast articles (Print & Online) bypass staging delays.
* **Forwarding:** Articles are forwarded immediately to downstream tools/projects with zero artificial hold time.

---

### **2. Broadcast Media Workflow (TV, Radio & Podcast)**

Broadcast articles require consolidation ("Auto-Kill" deduplication logic) to merge overlapping media clips into a single continuous file before being dispatched.

#### **Optimization Staging & Holding**

* **15-Minute Buffer Window:** Broadcast articles coming from Percolate are held in the Optimization Service for **15 minutes**.
* **Scheduled Execution:** Batch evaluation runs every **15 minutes** to analyze incoming broadcast content before pushing it forward.

#### **Auto-Kill / Deduplication Logic**

For broadcast articles arriving within the buffer:

1. **Window Identification:** Identify articles where content start times and end times fall within a **5-minute window**.
2. **Sorting:** Sort the group chronologically based on `Content Start Time`.
3. **Consolidation:**
* Retain the **first article**.
* Update the first article’s `Content Start Time` to match the **earliest start time** in the group.
* Update the first article’s `Content End Time` to match the **latest end time** among all 5 articles.


4. **Purging:** Remove/kill the remaining 4 duplicate articles.

#### **Downstream Enrichment & Creation**

1. **Enrichment Service:** Receives the single consolidated article with the updated 5-minute time range.
2. **Clip Generation:** Generates one unified 5-minute media clip corresponding to the updated timestamps.
3. **Delivery:** Sends the final consolidated article and clip to Trail / downstream Project tools.

---

### **3. Workflow Comparison**

| Feature | Standard Media (Print & Web) | Broadcast Media (TV, Radio, Podcast) |
| --- | --- | --- |
| **Optimization Hold Time** | 0 minutes (Immediate) | 15 minutes (Max delay ~15 mins) |
| **Deduplication Strategy** | Direct pass-through | 5-minute window consolidation (Auto-Kill) |
| **Enrichment Action** | Standard processing | Single merged clip generation |
| **Article Volume Shift** | 1:1 input to output | N:1 reduction (Multiple clips merged to 1) |

---
