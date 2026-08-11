# Plan - Restrict Alarms to Cooling Water System & Disable DB Warnings

This plan corrects the alarm logging workflow. Warnings (baseline breaches) will ONLY be used as visual indications (yellow outlines) on the P&ID diagram. They will NOT trigger database entries or appear in the Alarm Log (Dashboard/P&ID). Only high-limit breaches will generate database alarm logs (red outline & log entries).

## User Review Required

> [!IMPORTANT]
> 1. **Visual-Only Warnings**: We will modify the backend scheduler to ONLY generate database alarm logs for high-limit breaches (Alarms). Warning-level breaches (exceeding baseline but not high limit) will be ignored by the database generator, but they will still turn yellow on the P&ID diagram.
> 2. **Restrict Scheduler to Cooling Water**: We will configure the backend scheduler to evaluate rules only for the cooling water system (`cooling-water-%`). Other systems will not generate alarms.
> 3. **Filter Out Double Alarms**: We will modify the active alarms API query so that it filters strictly by the specific unit ID (e.g. `cooling-water-1` instead of `cooling-water%`). This will prevent other units' alarms from leaking onto your page and showing double alerts.
> 4. **Database Cleanup**: We will run a query on startup to delete all current active alarms for non-cooling-water systems and all warning-level alarms to clean up your logs.

## Proposed Changes

### Backend

#### [MODIFY] [postgres.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/database/postgres.ts)
- Add a startup query to delete all current database alarms where `unit_id NOT LIKE 'cooling-water%'` or `severity = 'medium'` (warning level).

#### [MODIFY] [scheduler.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/core/scheduler.ts)
- Modify the `sensor_rules` database query inside `evaluateSensorRulesForPoints` to fetch rules only `WHERE unit_id LIKE 'cooling-water%'`.
- Remove the `else if (warning !== null && value >= warning)` block so the scheduler never writes warning-level alarms to the database.

#### [MODIFY] [alarms.service.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/modules/alarms/alarms.service.ts)
- Update `getActiveAlarms` to query by strict `unit_id = $x` instead of wildcard `LIKE` for cooling-water.

## Verification Plan

### Automated Tests
- Compile the backend and frontend to ensure no build errors.

### Manual Verification
1. Rebuild and restart the Docker containers.
2. Verify that non-cooling-water alarms and warning-level alarms are deleted from the database.
3. Check the Dashboard and P&ID sidebar. Verify that only high-limit alarms are displayed.
4. Verify that warning-level breaches still turn yellow visually on the P&ID diagram boxes, but do not show up in the logs.
