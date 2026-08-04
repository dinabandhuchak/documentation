# Scheduling Service Workflow

## Purpose

This service converts client delivery preferences into scheduled jobs and triggers downstream delivery events at the appropriate times.

## High-Level Flow

1. A client delivery configuration is received.
2. The service evaluates delivery days, time window, repeat pattern, format, and flags.
3. It generates one or more cron schedules.
4. It registers cron jobs in the client’s timezone.
5. When a job fires, the service publishes an event with the relevant date range.

## Main Inputs

- delivery days
- start time
- end time
- repeat interval
- brief delivery format
- send to editorial tool
- delivery timezone
- optimise query events

## Core Conditions

### No active days
- If no delivery day is enabled, no schedule is created.

### Empty time values
- Empty start time defaults to `00:00`.
- Empty end time defaults to `23:59`.
- Empty repeat defaults to `00:00`.

### Press review format
- If format is `press-review`, the service always creates a content polling job.
- If format is `press-review` and `sendToEditorialTool = false`, it also creates an automated press review job.

### Non press-review format
- A standard content job is created based on the generated cron expression.

### Optimised query mode
- For `press-review`, content polling runs every `5` minutes.
- For non press-review, content polling runs every `3` minutes.
- For automated press review, the job also runs every `5` minutes with a shifted second value.

## Cron Generation Rules

### Manual editorial tool delivery
- If `sendToEditorialTool = true`, the schedule becomes every `15` minutes.

### Overnight range
- If end hour is earlier than start hour, the service falls back to a single daily trigger at the start time.

### Same-hour range with repeat
- If start hour and end hour are the same, the service uses minute stepping within that hour.
- If the repeat exceeds the available range, it falls back to a single trigger at the start time.

### Repeat contains hours and minutes
- If repeat includes both hours and minutes, the service schedules by hour interval and uses the repeat minute value.
- The starting hour is not shifted back by one in this case.
- The configured start minute is not used as the anchor minute.

### Repeat contains minutes only
- If repeat is `00:NN`, the service generates an every-`NN`-minutes cron rule across the selected hour range.
- The configured start minute is not preserved as the first execution point.

### Repeat contains hours only
- If repeat is `HH:00`, the service does not preserve the configured start minute.
- It shifts the starting hour back by one and fixes the minute to `55`.
- This can make actual trigger times earlier than the visible start time.

### No repeat
- The service schedules a single daily trigger at the configured start time.
- Special case: for `press-review`, if start minute is `00`, it may shift to the previous hour and use a random minute between `51` and `59`.

## Randomization Logic

The service adds randomness to reduce synchronized execution:

- a random second is added to cron expressions
- if repeat is `00:05`, extra random minutes are added
- some press-review single-trigger schedules use a random minute near the end of the previous hour

## Timezone Behavior

- Jobs are registered using the client’s configured timezone.
- Trigger evaluation respects that timezone.
- Execution date windows are also calculated using that timezone.

## Execution Workflow

1. A cron job fires.
2. The service determines the previous execution time.
3. It builds a payload with:
   - account id
   - start date
   - end date
   - pressReview flag
4. It publishes the event.
5. It stores the latest execution timestamp in cache.

## Output Behavior

### Content job
- Publishes a content scheduling event.

### Press review job
- Publishes a press review scheduling event.

## Important Interpretation Note

Configured schedule values are not always used literally.

In some cases, especially repeat patterns based on cron stepping or whole-hour intervals, the generated trigger times are normalized by service logic. Because of that, the actual execution time can differ from the visible start time and should be verified from the generated cron behavior, not only from input fields.
