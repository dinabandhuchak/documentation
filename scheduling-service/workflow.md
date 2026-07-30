# Scheduling Service - Complete Documentation

## Overview

The **Scheduling Service** is a NestJS-based microservice built with Apache Kafka integration that manages automated scheduling and triggering of content delivery tasks for customer accounts. It handles dynamic cron-based scheduling, caches execution timestamps, and emits events to trigger content pulls and press reviews based on customer-defined delivery preferences.

**Technology Stack:**
- **Framework:** NestJS 11
- **Messaging:** Apache Kafka (KafkaJS)
- **Caching:** Redis (via Cache Manager)
- **Scheduling:** Node Cron
- **Language:** TypeScript

---

## System Architecture

### High-Level Flow

```
Kafka Consumer (Accounts Topic)
    ↓
App Controller (Receives Account Events)
    ↓
App Service (Orchestrates Schedule Management)
    ↓
Cron Expression Service (Generates Cron Patterns)
    ↓
Cron Jobs (Execute on Schedule)
    ↓
Content Service / Press Review Service (Handle Events)
    ↓
Emit Service (Publishes Kafka Events)
    ↓
Kafka Producer (Sends to Delivery Topic)
```

---

## Core Services

### 1. **App Service** (`app.service.ts`)
**Responsibility:** Main orchestrator for job scheduling and lifecycle management

**Key Methods:**
- `addSchedule(data)` - Creates and manages scheduling jobs for a customer
  - Generates cron expressions based on customer preferences
  - Creates separate jobs for content delivery and press reviews
  - Handles optimization flags for query frequency
  - Adds random offsets to prevent thundering herd

- `addJob(data, jobType, cronString)` - Internal method to create individual cron jobs
  - Validates that schedules exist (returns early if all delivery days disabled)
  - Creates CronJob instances with timezone support
  - Registers jobs with NestJS SchedulerRegistry
  - Routes to appropriate service (ContentService or PressReviewService)
  - Logs job creation with customer details

- `deleteCronJob(name)` - Removes jobs when customers are deleted or disabled
  - Called when account is deleted or endDate is passed

**Job Naming Convention:** `{jobType}_job_for_client_id_{clientId}`
- Example: `content_job_for_client_id_123`
- Example: `press-review_job_for_client_id_123`

**Special Features:**
- Random second offset (0-59) to distribute execution across time
- Optimized query frequency when `optimiseQueryEvents` flag is set:
  - Press Review: Every 5 minutes instead of 15 minutes
  - Clipping: Every 3 minutes instead of standard schedule
- Editorial tool integration: Uses fixed 15-minute schedule for manual press review

---

### 2. **Cron Expression Service** (`cron.expression.service.ts`)
**Responsibility:** Generates cron expressions from customer delivery preferences

**Input Parameters:**
```javascript
{
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startTime: string;        // HH:mm format
  endTime: string;          // HH:mm format
  repeat: string;           // HH:mm format (frequency)
  sendToEditorialTool: boolean;
  briefDeliveryFormat: string;
}
```

**Cron Expression Logic:**
1. **Days Selection:** Converts day booleans to day-of-week values (0=Sunday, 6=Saturday)
2. **Time Parsing:** Extracts hours and minutes from time strings
3. **Repeat Calculation:** Converts repeat frequency to minute intervals
4. **Special Cases:**
   - If repeat is "00:05" (5 minutes): Adds random 6-10 minute offset to distribute load
   - If end hour < start hour: Assumes overnight schedule
   - Editorial tool sends at fixed 15-minute intervals
   - Returns `undefined` if no days selected (no schedule needed)

**Example Output:**
- `45 */5 * * * 1,3,5` - Every 5 minutes on Mon, Wed, Fri at :45 seconds
- `30 9,12,15,18 * * * *` - 9 AM, 12 PM, 3 PM, 6 PM daily
- `0 0 * * * 1-5` - Midnight Monday to Friday

---

### 3. **Base Scheduling Service** (`base.scheduling.service.ts`)
**Responsibility:** Abstract service providing common scheduling execution logic

**Key Method:**
- `executeService(id, cronExpression, timeZone, eventName, cacheKey, pressReview)`
  - Retrieves last execution date from cache or calculates from cron expression
  - Creates message payload with:
    - `account_id`: Customer ID
    - `start_date`: Previous execution time (from cache)
    - `end_date`: Current time
    - `pressReview`: Boolean flag indicating event type
  - Publishes Kafka event via EmitService
  - Updates cache with new end date for next execution
  - Logs execution details

**Helper Method:**
- `getLastExecutionDate(cronExpression, timeZone)` - Calculates previous cron execution time using cron-parser

**Timezone Support:** All calculations respect customer's delivery timezone

---

### 4. **Content Service** (`content.service.ts`)
**Responsibility:** Handles scheduled content delivery (clipping) tasks

**Key Method:**
- `pullClientContent(id, cronExpression, timeZone)` - Executes when content pull schedule triggers
  - Calls base `executeService` with:
    - `eventName`: 'clipping'
    - `cacheKey`: `schedulingNextStartDateForClientId${id}`
    - `pressReview`: false

**When Triggered:**
- Customer wants regular content/clipping delivery
- On their configured schedule based on days, times, and repeat frequency
- Emits 'clipping' event via Kafka

---

### 5. **Press Review Service** (`press.review.service.ts`)
**Responsibility:** Handles automated press review delivery tasks

**Key Method:**
- `sendPressReview(id, cronExpression, timeZone)` - Executes when press review schedule triggers
  - Calls base `executeService` with:
    - `eventName`: 'press-review'
    - `cacheKey`: `nextPressReviewStartDateForClientId${id}`
    - `pressReview`: true

**When Triggered:**
- Customer's brief format is 'press-review' AND NOT sending to editorial tool
- On optimized schedule (every 5/15 minutes depending on settings)
- Emits 'press-review' event via Kafka

---

### 6. **Emit Service** (`emit.service.ts`)
**Responsibility:** Formats and publishes scheduling events to Kafka

**Key Methods:**
- `publish(data, eventType, accountId)` - Main publishing method
  - Validates Kafka topic existence
  - Builds proper headers and metadata based on event type
  - Sends message to `{APP_ENV}.delivery.content` topic
  - Uses accountId as message key for partitioning

**Metadata Format (Clipping Events):**
```javascript
{
  message_type: {
    name: 'onclusive.delivery.event.content.schedule.triggered',
    organization: 'onclusive',
    service: 'delivery',
    type: 'event',
    entity: 'content',
    subentity: 'schedule',
    status: 'triggered',
    version: '1'
  },
  occurred_on: '2024-01-15T10:30:45.123Z',
  transaction_id: 'uuid-v4'
}
```

**Message Payload:**
```javascript
{
  data: {
    account_id: number,
    start_date: ISO8601,
    end_date: ISO8601,
    pressReview: boolean
  },
  meta: { /* metadata */ }
}
```

---

### 7. **App Controller** (`app.controller.ts`)
**Responsibility:** Kafka event listener managing account lifecycle events

**Event Pattern:** Listens to `{APP_ENV}.accounts` topic

**Handled Events:**
1. **Brief Created** (`onclusive.accounts.event.brief.created`)
   - Calls `appService.addSchedule()` with new customer data

2. **Brief Updated** (`onclusive.accounts.event.brief.updated`)
   - If account has valid end date (not expired): Updates schedule
   - If account is expired: Clears cache to prevent stale data

3. **Brief Deleted** (`onclusive.accounts.event.brief.deleted`)
   - Calls `appService.deleteJob()` to remove cron jobs

**Cache Management:**
- Clears cache entry `schedulingNextStartDateForClientId${id}` for expired accounts
- Prevents scheduling events for customers with expired subscriptions

---

### 8. **Producer Service** (`producer/producer.service.ts`)
**Responsibility:** Manages Kafka producer connections and message delivery

**Key Features:**
- Connection pooling (one producer per topic)
- Lazy initialization (connects on first use)
- Graceful shutdown on application termination
- Handles both single messages and message arrays

**Methods:**
- `produce(topic, message)` - Sends message to Kafka topic
- `getProducer(topic)` - Creates/retrieves producer for topic
- `onApplicationShutdown()` - Cleanup on service termination

---

### 9. **Authorization Service** (`authorization.service.ts`)
**Responsibility:** OAuth2 token acquisition for external API calls

**Authentication Method:** Client Credentials Flow
- Exchanges client credentials for access token
- Used for fetching customer data from external APIs
- Supports configurable endpoints and scopes

**Configuration Variables:**
- `PRODUCTION_TOOL_CLIENT_ID`
- `PRODUCTION_TOOL_TENANT_ID`
- `PRODUCTION_TOOL_SECRET_ID`
- `PRODUCTION_TOOL_SCOPES`
- `PRODUCTION_TOOL_AUTHORITY`

---

### 10. **Customer Service** (`customers.service.ts`)
**Responsibility:** API client for fetching customer/account data

**Methods:**
- `getAll()` - Fetches all managed customer accounts
- `diyAccounts()` - Fetches only DIY (self-service) accounts

**API Base:** Calls `v1/accounts` endpoint with bearer token authentication

---

## Complete Workflow Scenarios

### Scenario 1: New Customer Created (Brief Created Event)

```
1. Kafka Topic (accounts) receives brief.created event
   ↓
2. App Controller receives event
   ↓
3. Check if account has valid end date (not expired)
   - YES → Continue with scheduling
   - NO/EXPIRED → Skip scheduling
   ↓
4. App Service.addSchedule(customerData) called
   ↓
5. Check delivery format:
   - "press-review" format → Create press review job + content job
   - Other formats → Create content job only
   ↓
6. For each job:
   a. Generate cron expression from customer preferences
   b. If no days selected → Return early (no schedule needed)
   c. Calculate random offset for load distribution
   d. Delete existing job if present (prevents duplicates)
   e. Create CronJob instance with timezone
   f. Register with NestJS SchedulerRegistry
   g. Start the job
   ↓
7. Jobs wait for next scheduled execution time...
```

### Scenario 2: Scheduled Job Execution (Cron Trigger)

```
1. CronJob triggers at scheduled time (respects customer timezone)
   ↓
2. Determine service to call:
   - "press-review" job → Press Review Service
   - "content" job → Content Service
   ↓
3. Service.execute() called with job parameters
   ↓
4. Base Scheduling Service processes:
   a. Check Redis cache for previous execution timestamp
   b. If exists → Use cached timestamp as start_date
   c. If not exists → Calculate from cron expression
   ↓
5. Create message payload:
   {
     account_id: customer_id,
     start_date: previous_execution,
     end_date: now,
     pressReview: [true/false]
   }
   ↓
6. Emit Service publishes to Kafka:
   - Topic: {APP_ENV}.delivery.content
   - Headers: message_type, version
   - Meta: event details, transaction_id
   ↓
7. Update Redis cache with current timestamp
   - Cache key: schedulingNextStartDateForClientId{id}
   - TTL: Depends on repeat frequency
   ↓
8. Log execution with start/end dates and cache info
```

### Scenario 3: Customer Schedule Updated

```
1. Kafka receives brief.updated event
   ↓
2. App Controller receives updated customer data
   ↓
3. Check end date:
   - If expired → Clear cache and stop
   - If valid → Proceed to schedule update
   ↓
4. App Service.addSchedule() called with new preferences
   ↓
5. Generate new cron expression from updated params
   ↓
6. Delete existing jobs (same name)
   ↓
7. Create new jobs with updated cron expressions
   ↓
8. Old schedules are replaced
```

### Scenario 4: Customer Deleted or Subscription Ended

```
1. Kafka receives brief.deleted event
   OR customer endDate has passed
   ↓
2. App Controller checks:
   - If deleted → Call deleteJob()
   - If expired → Clear cache entry
   ↓
3. App Service.deleteJob():
   a. Get all registered cron jobs
   b. Find jobs matching pattern: content_job_for_client_id_{id}
   c. Stop each job
   d. Unregister from SchedulerRegistry
   ↓
4. No more events will be triggered for this customer
```

---

## Data Flow: Event Messages

### Message Going INTO the Service
**Topic:** `{APP_ENV}.accounts`
```javascript
{
  data: {
    id: 123,
    name: "Customer ABC",
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    startTime: "09:00",
    endTime: "17:00",
    repeat: "00:30",  // Every 30 minutes
    deliveryTimeZone: "America/New_York",
    briefDeliveryFormat: "press-review",
    sendToEditorialTool: false,
    endDate: "2025-12-31",
    optimiseQueryEvents: false
  },
  meta: {
    message_type: {
      name: "onclusive.accounts.event.brief.created"
    }
  }
}
```

### Messages Going OUT of the Service

**Topic:** `{APP_ENV}.delivery.content`

**Clipping Event (Content Delivery):**
```javascript
{
  data: {
    account_id: 123,
    start_date: "2024-01-15T09:30:00.000Z",
    end_date: "2024-01-15T10:00:00.000Z",
    pressReview: false
  },
  meta: {
    message_type: {
      name: "onclusive.delivery.event.content.schedule.triggered",
      organization: "onclusive",
      service: "delivery",
      type: "event",
      entity: "content",
      subentity: "schedule",
      status: "triggered",
      version: "1"
    },
    occurred_on: "2024-01-15T10:00:15.456Z",
    transaction_id: "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Press Review Event:**
```javascript
{
  data: {
    account_id: 123,
    start_date: "2024-01-15T09:55:00.000Z",
    end_date: "2024-01-15T10:00:00.000Z",
    pressReview: true
  },
  meta: {
    message_type: {
      name: "onclusive.delivery.event.content.press_review.triggered",
      // ... other meta fields
    }
  }
}
```

---

## Key Concepts

### Cron Expression Generation
The service converts human-friendly customer preferences into standard cron expressions:
- **Input:** Days of week, time range, repeat frequency, timezone
- **Output:** Cron expression like `45 */30 9-17 * * 1-5`
- **Validation:** Returns `undefined` if no days selected (prevents invalid schedules)

### Timezone Support
- All customer schedules respect their configured timezone
- Cron jobs created with timezone parameter
- Last execution calculation uses moment-timezone for accuracy
- Ensures jobs trigger at expected local times, not UTC

### Caching Strategy
- **Cache Key:** `schedulingNextStartDateForClientId{id}` (for clipping)
- **Cache Key:** `nextPressReviewStartDateForClientId{id}` (for press reviews)
- **Purpose:** Stores last execution timestamp for precise start_date in next event
- **Backend:** Redis (via Cache Manager)
- **Lifetime:** Set to next execution time

**Without Cache:**
- Would recalculate start_date from cron expression every time
- Might miss content between scheduled runs if calculations drift

**With Cache:**
- Guarantees no overlap or gaps in time ranges
- Ensures continuous coverage of time intervals

### Load Distribution
- Random second offset (0-59) on all jobs
- Random minute adjustment (6-10 min) for 5-minute repeat frequency
- Prevents all customer jobs triggering simultaneously (thundering herd problem)
- Reduces peak load on downstream systems

### Optimization Flags
- `optimiseQueryEvents: true` → Increases check frequency (every 3-5 minutes)
- `optimiseQueryEvents: false` → Standard frequency (15+ minutes)
- Allows fine-tuning performance vs. resource consumption per customer

---

## Configuration & Environment

**Required Environment Variables:**
```
# Kafka Configuration
APP_ENV=production                           # Environment prefix for topics
KAFKA_BROKERS=kafka1:9092,kafka2:9092      # Kafka broker addresses
KAFKA_USERNAME=user                         # SASL authentication
KAFKA_PASSWORD=password
KAFKA_CONNECTION_TIMEOUT=10000              # milliseconds
KAFKA_AUTHENTICATION_TIMEOUT=10000
KAFKA_REAUTHENTICATION_THRESHOLD=600000

# Redis Cache
REDIS_URL=redis://localhost:6379            # Redis connection string

# OAuth2 (Production Tool)
PRODUCTION_TOOL_CLIENT_ID=client_id
PRODUCTION_TOOL_TENANT_ID=tenant_id
PRODUCTION_TOOL_SECRET_ID=secret
PRODUCTION_TOOL_SCOPES=scope1 scope2
PRODUCTION_TOOL_AUTHORITY=https://authority.example.com

# Customer API
CLIENT_BRIEF_BASE_URL=https://api.example.com/
```

---

## API Endpoints

The service runs as a **Kafka microservice** with no REST endpoints. All communication is event-driven through Kafka topics:

- **Incoming Topic:** `{APP_ENV}.accounts` - Account lifecycle events
- **Outgoing Topic:** `{APP_ENV}.delivery.content` - Scheduled trigger events

---

## Error Handling

**Graceful Degradation:**
- Invalid cron expressions logged but don't crash service
- Failed Kafka publishes logged with account context
- Missing environment variables caught at startup
- Expired account events clear cache but don't fail

**Logging:**
- Service: `AppService`
- Content: `ContentService`
- Press Review: `PressReviewService`
- Authorization: `AuthorizationService`
- Emit: `EmitService`
- Custom timestamp logging enabled for all services

**Error Log Example:**
```
[Content-Scheduler-Service] Error adding content job for client
Error: Invalid cron expression
{ name: "Customer ABC" }
```

---

## Testing

**Test Files:**
- `specs/app.service.spec.ts` - Core scheduling logic
- `specs/app.controller.spec.ts` - Event handling
- `specs/cron.expression.service.spec.ts` - Cron generation
- `specs/producer/producer.service.spec.ts` - Kafka publishing
- `test/app.e2e-spec.ts` - End-to-end scenarios

**Running Tests:**
```bash
npm run test              # Unit tests
npm run test:watch       # Watch mode
npm run test:cov         # Coverage report
npm run test:e2e         # E2E tests
```

---

## Deployment

**Docker Support:**
- Dockerfile provided for containerization
- docker-compose.yml for local development stack

**Build & Run:**
```bash
# Production build
npm run build
npm run start:prod

# Development
npm run start:dev

# Debug mode
npm run start:debug
```

**NestJS CLI:**
- Pre-configured nest-cli.json
- TypeScript compilation via tsconfig.json and tsconfig.build.json

---

## Summary

The **Scheduling Service** is the orchestrator for time-based content delivery automation:

1. **Listens** to customer account events (create, update, delete)
2. **Generates** dynamic cron expressions from customer preferences
3. **Manages** long-running cron jobs with timezone support
4. **Triggers** events at scheduled times with cached execution boundaries
5. **Publishes** structured Kafka events to downstream content delivery services
6. **Caches** execution timestamps to ensure data continuity and prevent duplication
7. **Scales** through random offset distribution and query optimization flags

This event-driven architecture allows flexible, customer-specific scheduling without requiring changes to the system for each new customer or preference update.
