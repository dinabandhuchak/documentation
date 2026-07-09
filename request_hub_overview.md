# Request Hub Overview

Request Hub is a service that allows users to **request the onboarding of new publications into the Onclusive Media Database (OMDB)**. It manages the entire lifecycle of an onboarding request, from creation through processing and completion.

The service architecture is divided into three layers:

* Client
* API
* Orchestrator

## Client

This is the user interface through which analysts can search for existing requests and submit new requests for publications that are not yet available in OMDB. It also allows users to track the progress of each request.

The client has two main pages:

### `/search`

* Search existing requests.
* Create a new publication request.

### `/request/[id]`

This page displays the details of a specific request.

It includes:

* The current status of the request.
* The complete status/history timeline.
* The publication details entered when creating the request.
* Subscription details (if applicable).
* Workflow actions that may require user input (approvals, credentials, etc.).

## API

This is the main backend of the application and owns the business logic and database.

Its responsibilities include:

* Storing requests in the database.
* Maintaining the request history (audit trail).
* Managing request statuses.
* Exposing REST APIs used by the frontend.
* Dispatching requests to the Orchestrator.
* Receiving status updates from the Orchestrator.

When a new request is created:

1. The API stores the request in the `MediaRequest` table.
2. It creates an initial entry in the `RequestHistory` table.
3. It sends a dispatch request to the Orchestrator (except for certain workflow types, such as `online-publication`, which require manual review before dispatch).

When the status of a request changes, the Orchestrator calls the `/api/v1/media-requests/{id}/orchestrator-update` endpoint. The API then updates the request and records the new status in the request history.

The API does **not** communicate directly with external services such as the crawler. All communication with external systems goes through the Orchestrator.

## Orchestrator

The Orchestrator is the integration layer between Request Hub and external services (currently the crawler, with support for additional adapters in the future).

Its responsibilities include:

* Receiving dispatch requests from the API.
* Selecting the appropriate adapter based on the request type.
* Sending requests to external services (such as the crawler).
* Receiving webhook callbacks from external services.
* Storing raw event payloads in MinIO for debugging and auditing.
* Mapping external service statuses to Request Hub statuses.
* Sending the translated updates back to the API.

When a new request is dispatched, the API sends a request to the Orchestrator. The Orchestrator determines which adapter should handle the request (currently the crawler) and forwards it to the appropriate external service.

As the external service processes the request, it sends webhook events to the Orchestrator. The Orchestrator:

1. Stores the raw event payload in MinIO.
2. Maps the external status to the corresponding Request Hub status.
3. Extracts the relevant information required by the API.
4. Calls the API's `/api/v1/media-requests/{id}/orchestrator-update` endpoint to update the request.
