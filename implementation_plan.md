# Plan - Real-time Trend Analysis & Database Historian

This plan implements database-backed Trend Analysis (Historical Parameter Detail) for ST3 Return Temp, Supply Water Temp, and Return Water Temp. The backend scheduler will sync these values to PostgreSQL once every 1 minute (to prevent database bloat), the Trend page will fetch them dynamically using custom date range filters, and the chart line color will be aligned to the website's brand blue (`#1f6fb5`).

## User Review Required

> [!IMPORTANT]
> 1. **PostgreSQL Database Storage**: We will verify and ensure that `cooling_tower_telemetry` contains the necessary columns (`return_temp`, `supply_temp`, `st3_return_temp`) and automatically sync live API polled values into this table.
> 2. **Throttled Database Writes (1-Minute Interval)**: To keep the database lightweight and fast, we will throttled writes to PostgreSQL so that telemetry points are saved **only once per minute** (instead of every 3-4 seconds).
> 3. **Hourly Average Aggregation**:
>    - **Hourly**: Group all points inside the same hour (e.g. `YYYY-MM-DD HH:00`) and calculate the average.
>    - **Daily**: Group all points inside the same day (e.g. `YYYY-MM-DD`) and calculate the average.
>    - **Monthly**: Group all points inside the same month (e.g. `YYYY-MM`) and calculate the average.
> 4. **Brand Blue Color Alignment**: The chart line color will be changed from emerald green to the website's primary brand blue (`#1f6fb5`) with a light blue background fill (`rgba(31, 111, 181, 0.1)`).
> 5. **Custom Date Range Filter**: We will add `Start Date` and `End Date` inputs next to the resolution filters to allow arbitrary filtering of historical trend data.
> 6. **Dummy Data Removal**: We will completely clear all mock data datasets (including Effectiveness and Daily Volume charts) and return empty series for other non-configured parameters in the list.

## Proposed Changes

### Backend

#### [MODIFY] [postgres.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/database/postgres.ts)
- Add startup migration checks to ensure `return_temp`, `supply_temp`, and `st3_return_temp` columns exist in `cooling_tower_telemetry`.

#### [MODIFY] [telemetry.service.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/modules/telemetry/telemetry.service.ts)
- Add a 1-minute throttle check inside `ingestTelemetry`.
- Sync `cooling-water/return_temp`, `cooling-water/supply_temp`, and `cooling-water/st3_return_temp` values into `cooling_tower_telemetry` in PostgreSQL once per minute.

#### [MODIFY] [historian.service.ts](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/backend/src/modules/historian/historian.service.ts)
- Add exact tag mappings for the 3 active cooling water tags to query their respective column values from `cooling_tower_telemetry` in PostgreSQL.

---

### Frontend

#### [MODIFY] [MachineStatistics.tsx](file:///c:/Users/Salman%20Akbar/Documents/PKL-WIDATRA/SCADA-Platform/apps/frontend/src/pages/machines/MachineStatistics.tsx)
- Empty mock data for `ctEffectivenessData` and `dailyVolumeData` charts.
- Add `startDate` and `endDate` date picker states.
- Update data loading effect to query `/historian/range` with selected `from` and `to` custom range dates for the 3 active parameters, and set data to `[]` for other parameters.
- Change `parameterTrendData` chart line styling to `#1f6fb5`.
- Add hourly/daily/monthly averaging logic on the queried raw points.
- Inject Date Picker inputs into the JSX controls bar.
- Update the Excel export function to export the real aggregated telemetry data.

## Verification Plan

### Automated Tests
- Run compilation tests for backend and frontend.

### Manual Verification
1. Rebuild and start the backend/frontend containers.
2. Confirm the database table contains the new columns and gets populated on telemetry poll every 1 minute.
3. Open Trend Analysis tab, choose `ST3 Return Temp`, and verify real-time data matches.
4. Select custom dates and confirm the chart updates.
5. Select Hourly/Daily/Monthly and verify average calculations are correctly displayed in brand blue.
