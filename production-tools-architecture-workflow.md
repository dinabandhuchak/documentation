# Production Tools Architecture Workflow

This document synthesizes the available Confluence pages under the Production Tools tree into a single reference for how the suite works end-to-end. It focuses on system boundaries, component responsibilities, interaction patterns, event flow, data movement, and the main external integrations that support delivery.

Production Tools is described as a suite of internal tools and services used by editorial and operations teams. The available source pages show both user-facing tools and background services working together to turn monitoring definitions into delivered client outputs.

## Table of Contents

- [System Overview](#system-overview)
- [Core Architectural Model](#core-architectural-model)
- [End-to-end Workflow](#end-to-end-workflow)
- [Component Interactions](#component-interactions)
- [Event Flow Sequence](#event-flow-sequence)
- [Data Pipelines](#data-pipelines)
- [Key Integrations](#key-integrations)
- [Cross-cutting Architectural Characteristics](#cross-cutting-architectural-characteristics)
- [Architecture Summary](#architecture-summary)
- [Source Pages](#source-pages)

## System Overview

Production Tools combines configuration tools, shared reference services, processing services, and editorial workflows into one delivery pipeline. At a high level, teams define what to monitor, configure how outputs should be assembled and sent, trigger scheduled or event-driven processing, match and optimize content, optionally enrich and validate it manually, and finally deliver finished outputs to clients or external platforms.

| Component                 | Primary Role                                                              | Upstream Inputs                                                                 | Downstream Outputs                                                              |
| :------------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------ |
| **Query Tool**            | Builds and manages monitoring queries                                     | User-defined Boolean logic, filters, topics, briefs                             | Query definitions reused by Client Brief, Editorial Tool, and matching services |
| **Media List Tool**       | Maintains media contacts, outlets, programs, and social accounts          | User-maintained lists, spreadsheet imports                                      | Shared media-list data and filters for Query Tool and Client Brief              |
| **Client Brief**          | Defines client sections, recipients, formatting, and delivery preferences | Queries, media lists, external account data, user configuration                 | Brief configuration and schedule inputs for downstream services                 |
| **Scheduling Service**    | Turns delivery preferences into timed triggers                            | Client Brief schedules and updates                                              | Due-delivery signals to content-generation pipeline                             |
| **Content Service**       | Matches incoming coverage against brief queries                           | Incoming coverage, query definitions, brief configuration, media search data    | Matched and filtered content for optimization and delivery pipeline             |
| **Deduplication Service** | Optimizes matched content for delivery                                    | Matched content, delivery triggers                                              | Deduplicated, grouped, ranked content and assembled press reviews               |
| **Editorial Tool**        | Manual review and enrichment workspace                                    | Content awaiting validation, query preview data, media and AI enrichment inputs | Approved enriched content and delivery approval signals                         |
| **Content Delivery**      | Final packaging and sending of deliverables                               | Optimized content, editorial approval, enrichment outputs                       | Press reviews, digests, alerts, external feeds, delivery-status events          |
| **User Management Tool**  | Authentication, authorization, and shared access control                  | Admin-managed users, roles, corporate identity data                             | Access and permission decisions across the suite                                |

## Core Architectural Model

The suite follows a layered architecture with clear separation between configuration, orchestration, processing, editorial review, and delivery.

- **Configuration Layer:** Query Tool, Media List Tool, Client Brief, and User Management Tool.
- **Orchestration Layer:** Scheduling Service coordinates when delivery work should occur.
- **Processing Layer:** Content Service and Deduplication Service transform coverage into delivery-ready sets.
- **Review and Enrichment Layer:** Editorial Tool supports manual curation and validation.
- **Delivery Layer:** Content Delivery produces customer-facing outputs and downstream status events.

## End-to-end Workflow

### 1. Configuration and Setup

The workflow starts with teams creating reusable monitoring inputs and client delivery definitions.

- **Query Tool** lets users build and validate monitoring logic using Boolean operators, phrases, proximity, wildcards, and filters.
- **Media List Tool** manages the lists and entities that can be referenced by monitoring and briefing workflows.
- **Client Brief** binds these assets to a client outcome by defining sections, queries, media lists, recipients, formatting templates, and delivery preferences.
- **User Management Tool** controls who can access which applications and roles across the suite.

### 2. Schedule Generation and Orchestration

Once a brief exists, the **Scheduling Service** converts its delivery settings into active schedules. It keeps each client aligned to their local time zone and updates schedules automatically when a brief is modified.

### 3. Content Matching Pipeline

**Content Service** acts as the matching engine. It monitors incoming media coverage and compares it against the saved queries associated with each client brief, supporting both real-time matching and scheduled batch searches.

### 4. Optimization and Assembly

After matching, **Deduplication Service** refines raw results into delivery-ready content sets by removing duplicates, grouping related stories, and ranking content so the most relevant items surface first.

### 5. Enrichment, Review, and Approval

The **Editorial Tool** consumes content from the delivery pipeline for manual validation. Editors can group, filter, annotate, accept, or reject content. Once approved, it signals downstream brief delivery.

### 6. Final Delivery

**Content Delivery** packages processed coverage into client outputs such as press reviews, news digests, email alerts, and feeds for external platforms. It also emits delivery-status events for lifecycle tracking.

## Component Interactions

| From                  | To                         | Interaction                                    | Purpose                                  |
| :-------------------- | :------------------------- | :--------------------------------------------- | :--------------------------------------- |
| Users                 | Query Tool                 | Create, edit, preview, and validate queries    | Define monitoring logic                  |
| Users                 | Media List Tool            | Create and manage lists and source entities    | Maintain reusable media reference data   |
| Query Tool            | Client Brief               | Shared query retrieval and reuse               | Attach monitoring logic to client briefs |
| Media List Tool       | Client Brief               | Shared list lookup and management              | Attach curated source lists to briefs    |
| Client Brief          | Scheduling Service         | Schedule and delivery preference provisioning  | Create timed delivery triggers           |
| Client Brief          | Content Service            | Brief configuration and compiled query context | Control what content is matched          |
| Scheduling Service    | Content Service / pipeline | Due-delivery trigger                           | Start delivery cycle                     |
| Content Service       | Deduplication Service      | Matched content handoff                        | Optimize and prepare content             |
| Deduplication Service | Editorial Tool / Delivery  | Optimized content routing                      | Choose manual review or automated path   |
| Editorial Tool        | Content Delivery           | Approved enriched content and approval signal  | Release final deliverables               |
| User Management Tool  | All tools                  | Access and role resolution                     | Enforce authorization across suite       |
| Content Delivery      | External platforms         | Deliver outputs and publish status events      | Complete client delivery and tracking    |

## Event Flow Sequence

1. A user creates or updates a query in **Query Tool**.
2. A user or team associates that query and relevant media lists to a client configuration in **Client Brief**.
3. **Client Brief** stores recipients, sections, ranking rules, formatting, and delivery schedules.
4. **Scheduling Service** reads those delivery preferences and maintains a live timed schedule.
5. When a delivery becomes due, **Scheduling Service** emits a trigger for downstream processing.
6. **Content Service** retrieves the applicable brief configuration and query definitions, then matches incoming or searchable coverage.
7. **Content Service** filters results and passes matched items into the optimization pipeline.
8. **Deduplication Service** removes duplicates, groups related items, ranks content, and assembles review-ready or delivery-ready sets.
9. If manual review is required, content is routed to **Editorial Tool** for annotation, acceptance, rejection, and enrichment.
10. Once approved, or if no manual review is needed, **Content Delivery** packages the content for the required channel.
11. **Content Delivery** sends outputs as press reviews, digests, alerts, or external feeds.
12. **Content Delivery** emits delivery-status events so other systems can track lifecycle progress.

## Data Pipelines

### Configuration Data Pipeline

- User-defined queries are created in Query Tool.
- Media entities and lists are maintained in Media List Tool.
- Client Brief combines queries, lists, account information, sections, formatting rules, recipients, and schedules into client-specific delivery definitions.

### Content Processing Pipeline

- Incoming coverage enters the system through media search and related ingestion sources.
- Content Service matches coverage to brief definitions.
- Deduplication Service optimizes matched coverage into ranked, grouped sets.
- Content Delivery transforms approved content into channel-specific outputs.

### Control and Status Pipeline

- Brief changes propagate to Scheduling Service and matching services.
- Timed delivery events initiate workflow execution.
- Shared event streams (Kafka) exchange account and enriched content updates.
- Delivery-status events from Content Delivery provide observable lifecycle tracking.

## Key Integrations

| Integration                      | Used by                         | Role in workflow                              | Why it matters                                  |
| :------------------------------- | :------------------------------ | :-------------------------------------------- | :---------------------------------------------- |
| Corporate identity directory     | User Management Tool            | Authentication and colleague lookup           | Centralized identity and profile resolution     |
| Media search API                 | Content Service, Editorial Tool | Coverage retrieval and broadcast program data | Supplies the raw content and metadata           |
| External media-intelligence data | Client Brief                    | Brief enrichment with branded account data    | Supports account-aware configuration            |
| AI summarisation services        | Editorial Tool, Delivery        | Generate summaries and enriched content       | Improves editorial productivity                 |
| Broadcast clip-processing        | Editorial Tool, Delivery        | Broadcast enrichment and preparation          | Enables handling of non-text media              |
| External transcription services  | Content Delivery                | Broadcast audio processing                    | Supports transformation of broadcast material   |
| External destination platforms   | Content Delivery                | Push feeds and finished content outward       | Extends Production Tools beyond email           |
| Shared event stream / Kafka      | Multiple services               | Exchange content, account, and status events  | Decouples services and supports async execution |

## Cross-cutting Architectural Characteristics

- **Shared-service model:** Query Tool, Media List Tool, and User Management Tool act as reusable platform capabilities.
- **Event-driven processing:** Multiple pages reference status events, downstream signals, and shared event streams.
- **Hybrid automation:** The suite blends automated content pipelines with manual editorial validation.
- **Stateful orchestration:** Scheduling, delivery history, and optimization state are retained to preserve consistency.
- **Channel-aware delivery:** Outputs vary by content type and destination.
- **Compliance-aware processing:** Licensing restrictions and paywall screening are explicit responsibilities in the delivery layer.

## Architecture Summary

Production Tools is a modular production platform for media monitoring and client delivery. Query Tool and Media List Tool provide reusable monitoring inputs. Client Brief converts those inputs into client-specific configurations. Scheduling Service turns those configurations into timed execution. Content Service performs the match between live coverage and client need. Deduplication Service improves quality, relevance, and packaging. Editorial Tool adds human validation and enrichment where needed. Content Delivery transforms the resulting content into finished outputs and notifies downstream systems through delivery events. User Management Tool secures access across the whole suite.

## Source Pages

| Page                                   | Primary contribution to this synthesis                              | Link                                                                                 |
| :------------------------------------- | :------------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| Production Tools                       | Suite scope and architecture entry point                            | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5345345552)       |
| Query Tool                             | Query authoring and shared query service behavior                   | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5324406792)       |
| Client Brief                           | Client configuration, recipients, formatting, and scheduling inputs | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5360254992)       |
| Content Delivery                       | Final delivery behavior, enrichment, screening, and status events   | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5359501402)       |
| Content Service                        | Coverage matching pipeline                                          | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5359435852)       |
| Deduplication Service                  | Optimization, grouping, ranking, and review gating                  | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5360222227)       |
| Editorial Tool                         | Manual review, enrichment, and approval workflow                    | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5360091147)       |
| Media List Tool                        | Shared media-list and source-entity management                      | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5359468633)       |
| Scheduling Service                     | Timed orchestration and schedule state management                   | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5359632472)       |
| User Management Tool                   | Cross-suite access control and authorization                        | [Open page](https://onclusive.atlassian.net/wiki/spaces/RDKB/pages/5359140926)       |
| Production tool workflow documentation | Reference workflow sequence across all components                   | [Open page](https://onclusive.atlassian.net/wiki/spaces/Applicatio/pages/3851190273) |
