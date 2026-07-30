# Scheduling Service - Workflow Guide

## What It Does

The Scheduling Service automatically sends content delivery notifications to customers at scheduled times. When a customer sets up a delivery schedule, the service triggers events at the right moments.

---

## Main Workflows

### 1. Customer Subscribes (New Account)

```
1. Customer creates a new subscription with delivery preferences
   - Days: Mon, Tue, Wed, Fri
   - Time: 9am to 5pm
   - Frequency: Every 30 minutes
   - Timezone: America/New_York

2. System sends subscription event to scheduler

3. Scheduler creates a job for this customer
   - Job is configured with their timezone
   - Job is configured with their schedule

4. Scheduler waits for the next scheduled time
```

---

### 2. Scheduled Delivery Triggers

```
1. Job wakes up at scheduled time (respecting customer's timezone)
   Example: Monday 9:30am in America/New_York

2. Scheduler checks: "What was the last time this job ran?"
   - Looks in cache for last execution time
   - If found: Uses that time
   - If not found: Calculates from schedule

3. Scheduler creates a delivery event
   - From: Last execution time
   - To: Right now
   - Customer ID: Included

4. Event is sent to delivery team via message queue

5. Cache is updated with current time
   - Next time job runs, it will use this time as "last execution"

6. Job goes back to sleep until next scheduled time
```

---

### 3. Customer Updates Delivery Schedule

```
1. Customer modifies their subscription
   - Changes days, times, or frequency
   - Example: Now wants Mon-Fri instead of just M/T/W/F

2. System sends update event to scheduler

3. Scheduler:
   - Stops the old job
   - Deletes the old job
   - Creates a new job with updated schedule
   - Starts the new job

4. New schedule takes effect immediately
```

---

### 4. Customer Cancels Subscription

```
1. Customer cancels their subscription

2. System sends cancellation event to scheduler

3. Scheduler:
   - Finds all jobs for this customer
   - Stops all jobs
   - Removes all jobs from the system

4. No more delivery events will be sent
```

---

### 5. Customer's Subscription Expires

```
1. Customer's subscription end date passes
   Example: Subscription ended 2025-12-31, but today is 2026-01-05

2. System sends expiration event to scheduler

3. Scheduler:
   - Clears any cached data for this customer
   - Next update will ignore this customer

4. Existing jobs may still be registered but won't cause problems
```

---

## Types of Deliveries

### Content Delivery (Clipping)
- Sends regular content/news clippings to customer
- Follows customer's schedule (days, times, frequency)
- Triggers the main workflow

### Press Review Delivery
- Sends automated press review summaries
- Only if customer selected "press-review" format
- May use different frequency than regular content

---

## Key Principles

### 1. Timezone Awareness
- All times are converted to customer's timezone
- A customer in London gets delivery at 9am their time (not UTC)
- A customer in Tokyo gets delivery at 9am their time

### 2. No Overlaps or Gaps
- System remembers when it last sent content
- Next delivery continues from where last one left off
- No content is missed, no content is sent twice

### 3. Load Distribution
- All jobs don't trigger at exactly the same second
- Prevents system overload from thousands of jobs at once
- Random delays ensure smooth operation

### 4. Flexible Scheduling
- Any combination of days: Mon, Wed, Fri
- Any time range: 9am to 6pm
- Any frequency: Every 5 min, every 30 min, once per hour, etc.
- No code changes needed to support new schedules

---

## Example Day-in-Life

### 9:00 AM Monday (America/New_York timezone)

**Customer A** (Mon-Fri, 9am-5pm, every 30 min)
- Job triggers
- Event sent: "Send content from 8:30am to 9:00am"
- Cache updated: Last run was 9:00am

**Customer B** (Only Tuesday, 2pm-3pm)
- No job today (it's Monday)
- Job will trigger tomorrow at 2pm

**Customer C** (Every day, but subscription ended 2025-12-31)
- Cache cleared
- No events sent

### 9:30 AM Monday

**Customer A** (Mon-Fri, 9am-5pm, every 30 min)
- Job triggers again
- Event sent: "Send content from 9:00am to 9:30am"
- Cache updated: Last run was 9:30am

### 10:00 AM Monday

**Customer A** (Mon-Fri, 9am-5pm, every 30 min)
- Job triggers again
- Pattern continues...

### 2:00 PM Tuesday

**Customer B** (Only Tuesday, 2pm-3pm)
- Job finally triggers
- Event sent: "Send content since last Tuesday at 2pm until now"
- Cache updated: Last run was 2:00pm

---

## Information Sent in Each Event

| Field | Example | Purpose |
|-------|---------|---------|
| Customer ID | 12345 | Identifies which customer gets the content |
| Start Time | 2024-01-15 09:00:00 | Beginning of time period for content |
| End Time | 2024-01-15 09:30:00 | End of time period for content |
| Event Type | "clipping" or "press-review" | What kind of content to send |
| Timestamp | 2024-01-15 09:30:15 | When event was triggered |
| Transaction ID | uuid-v4 | Unique ID for tracking this event |

---

## Common Scenarios

### Scenario: Customer in Different Timezone

**Setup:**
- Customer timezone: Asia/Tokyo (UTC+9)
- Schedule: Daily at 9am

**What Happens:**
- 9:00 AM Tokyo time = 12:00 AM UTC
- When it's 9:00 AM in Tokyo, job triggers
- Event sent with Tokyo-adjusted times
- Content is delivered at 9am their local time, not UTC

### Scenario: Very Frequent Delivery

**Setup:**
- Schedule: Every 5 minutes from 8am to 6pm

**What Happens:**
- 8:05 AM: Event sent
- 8:10 AM: Event sent
- 8:15 AM: Event sent
- ... continues every 5 minutes ...
- 5:55 PM: Event sent
- 6:00 PM: Event sent
- 6:05 PM: No event (outside window)

### Scenario: One-Time Delivery Day

**Setup:**
- Schedule: Only Wednesday, 2pm

**What Happens:**
- Monday: No event
- Tuesday: No event
- Wednesday 2pm: Event sent
- Thursday: No event
- Friday: No event
- Following Wednesday 2pm: Event sent again

---

## Error Scenarios

### What If Timezone Is Wrong?
- Customer gets content at wrong local time
- Fix: Update customer's timezone
- New schedule takes effect on next update

### What If Schedule Is Invalid?
- No jobs created
- System logs the error
- No events sent
- Fix: Customer must fix their schedule settings

### What If Cache Is Lost?
- System recalculates when last job should have run
- May skip small time period, but resumes normally
- No data is permanently lost

### What If Customer Expires Mid-Schedule?
- Existing jobs stop working
- No new events sent
- Cache cleared
- If subscription renewed, system starts fresh

---

## System Guarantees

✅ **Each customer gets their content on schedule**

✅ **Content time ranges don't overlap**

✅ **No content is missed**

✅ **Respects customer's local timezone**

✅ **Flexible enough for any schedule pattern**

✅ **Can handle thousands of simultaneous customers**

✅ **Survives temporary outages gracefully**

---

## Next Steps in the Pipeline

Once the Scheduling Service sends a delivery event:

1. **Delivery Service** receives the event
2. **Delivery Service** gathers content for that time period
3. **Delivery Service** formats the content (clipping or press review)
4. **Email/Notification Service** sends it to customer
5. Customer receives their scheduled content

The Scheduling Service is just the first step — it's the trigger that says "now is the time to send content."

---

## Summary

The Scheduling Service is a **time keeper and messenger**:

- **Time Keeper:** Remembers when jobs last ran, calculates next run
- **Messenger:** Sends "time to deliver" events at the right moments
- **Flexibile:** Adapts to any schedule a customer needs
- **Reliable:** Ensures no gaps or overlaps in delivery times
