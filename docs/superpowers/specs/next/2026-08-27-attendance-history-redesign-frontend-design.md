# Attendance history redesign — frontend design

**Date:** 2026-08-27
**Status:** Approved (chat brainstorm)
**Scope:** `Hrms--Web-application---front-end---v1` only. Companion: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-27-attendance-history-redesign-backend-design.md`

## Problem

The Time Tracking page (`/attendance/time-tracking`, module `src/app/modules/attendance`) has two issues:

1. **"My attendance history" is too dense.** Each row shows date, clock in, clock out, break, worked time, and work mode/source/status all at once, and there's no way to drill into a day.
2. **"My requests" sits stacked below "My attendance history"**, forcing extra scrolling, instead of living beside it.

Separately, the backend has a fully-built TrayApp activity-monitoring pipeline (idle time, active time, app usage, activity score — `ActivityDailySummary`) that no frontend component currently surfaces anywhere.

Both `time-tracking.component.ts` (736 lines) and `.html` (467 lines) currently handle Today + My History + My Requests + Team View + Approvals + 2 modals in one file.

## Goal

1. Trim "My attendance history" rows to: Date, Clock in, Clock out, Worked time, Status.
2. Add a shared detail drawer, opened by clicking a row (My history or Team attendance), showing Summary → Timeline → Daily activity (idle/app-usage/breaks from TrayApp), fed by the new backend endpoint (see companion doc).
3. Move "My attendance history" and "My requests" to sit side by side (history ~65%, requests ~35%), stacking vertically below the existing tablet breakpoint.
4. Extract two new child components (`AttendanceHistoryListComponent`, `MyRequestsPanelComponent`) out of the monolithic `time-tracking.component`, since the area is already being restructured.
5. Wire Team attendance rows to the same drawer, in this same effort (not deferred).

## Non-goals

- No changes to the Approvals panel or the correction/work-area-change modal flows — extracted as-is if touched, otherwise untouched.
- No changes to Team attendance's filter/search chrome beyond column trim + row-click.
- No changes to `2026-08-25-time-tracking-date-range-picker-design.md` or `2026-08-25-attendance-list-pagination-design.md` behavior — this builds on top of both (paginated rows, existing date-range picker stay as-is).

## Design

### 1. Trimmed history row + side-by-side layout

**Row columns**: Date, Clock in, Clock out, Worked time, Status (badge). Break, work mode, and source move into the drawer (still present in the `AttendanceHistoryRow` model/API response — just not rendered in the row). Rows become clickable when `row.canViewDetails` is true, calling a new `rowSelected(employeeId, workDate)` output.

**New components**:
- `AttendanceHistoryListComponent` (`feature/time-tracking/attendance-history-list/`) — renders the trimmed, paginated table (reusing the pagination pattern from `2026-08-25-attendance-list-pagination-design.md`: Previous/Next, "Page X of Y", gated on `totalCount > pageSize`). Inputs: `rows`, `page`, `pageSize`, `totalCount`, `loading`, `error`. Outputs: `pageChange(page)`, `rowSelected(employeeId, workDate)`.
- `MyRequestsPanelComponent` (`feature/time-tracking/my-requests-panel/`) — wraps the existing corrections/work-area-change tabbed panel (currently `time-tracking.component.html:224-330`), extracted with no behavior change: same tabs, same pagination, same "Request correction" trigger wiring back up to the parent (or kept self-contained if the store calls don't need to move — implementation detail for the plan).

Parent `time-tracking.component` renders both inside a new `.history-requests-row` container (flex/grid, history ~65% / requests ~35%), replacing the current stacked `<section class="history-card">` blocks at `time-tracking.component.html:161-330`. Stacks to full-width vertically below the module's existing tablet breakpoint.

**Team attendance** table (`viewMode() === 'team'` branch, currently `time-tracking.component.html:387-440`) gets the same column trim and reuses `AttendanceHistoryListComponent` (same row shape, `covered-history`-backed), with `rowSelected` opening the drawer for the selected employee instead of always the current user.

### 2. Shared detail drawer

New component `AttendanceDetailDrawerComponent` (`feature/time-tracking/attendance-detail-drawer/`), opened from either list via `(employeeId, workDate)` inputs plus an `open` signal/input. Renders as a right-side drawer over the current view (list stays visible/dimmed behind it, closable via backdrop click or close button — standard drawer pattern, match whatever existing drawer/panel primitive the design system already has, if any; otherwise a new lightweight one scoped to this component).

Single loading and error state for the whole drawer, backed by one call to the new endpoint (`GET /attendance/time-tracking/history/{employeeId}/{date}/detail`, added to `TimeTrackingApiService` as `getDayDetail(employeeId, date)`, and to `TimeTrackingStore` as `loadDayDetail(employeeId, date)` / a `dayDetail` signal + `dayDetailLoading`/`dayDetailError`).

Sections, in order:
1. **Summary** — date, clock in/out, worked time, break total, work mode, source, status (from `response.summary`, same shape as `AttendanceHistoryRow`).
2. **Timeline** — chronological list rendered from `response.timelineEvents` (clock-in/out, break start/end), each with a type label and timestamp.
3. **Daily activity** — from `response.dailyActivity` (nullable): stat tiles (active minutes, idle minutes, meeting minutes, activity score, data coverage %), app usage breakdown (productive/personal/unknown minutes, top apps), break minutes. If `dailyActivity` is `null`, render a friendly empty state ("No activity data recorded for this day") in place of the stats — the section itself still renders, doesn't disappear. (Per the backend design, `null` covers both "no data exists" and "you don't have `monitoring:read` for this person" — the frontend doesn't need to distinguish the two cases; same empty state either way.)

No manager-only actions in the drawer for this iteration (e.g. an approve-correction shortcut) — out of scope, can be added later without changing the drawer's data contract.

### 3. Models

`models/time-tracking.model.ts`:
- New `AttendanceDayDetail` interface matching the backend `AttendanceDayDetailResponse`: `summary: AttendanceHistoryRow`, `timelineEvents: TimelineEvent[]`, `dailyActivity: ActivityDailySummary | null`.
- New `TimelineEvent` interface: `eventType: 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd'`, `timestamp: string`, `source: string`.
- New `ActivityDailySummary` interface mirroring the backend `ActivityDailySummaryDto` fields needed by the drawer (active/idle/meeting minutes, activity score, data coverage %, productive/personal/unknown app minutes, top apps list, focus minutes) — only the fields the drawer actually renders, not a 1:1 mirror of every backend field.

### Testing

- `AttendanceHistoryListComponent`: row rendering with trimmed columns, `rowSelected` emitted on click only when `canViewDetails`, pagination controls (reusing existing `employee-list`-style pagination tests as reference).
- `MyRequestsPanelComponent`: extracted behavior unchanged — same assertions as the current `time-tracking.component.spec.ts` requests-panel tests, moved to the new component's spec.
- `AttendanceDetailDrawerComponent`: loading/error states, Summary/Timeline rendering from a fixture response, Daily activity section rendering stats vs. the empty state when `dailyActivity` is `null`.
- `time-tracking.component.spec.ts`: updated for the side-by-side layout and the two new child components being present; row-click-opens-drawer wiring for both My and Team views.
- `time-tracking-api.service.spec.ts`: new test for `getDayDetail`.
- `time-tracking.store.spec.ts`: new tests for `loadDayDetail` (success, error, loading states).

### Risks / notes

- Extracting `MyRequestsPanelComponent` must preserve the exact tab/pagination behavior added by `2026-08-25-attendance-list-pagination-design.md` — verify against that spec's frontend section when planning, not just against current code, in case that work landed after this doc was written.
- The drawer's activity section depends on the backend's `dailyActivity: null` covering both "no data" and "no permission" — if the backend design changes to distinguish these (e.g. a 403 vs. `null`), the frontend empty-state copy may need to change; flag this as a coupling point between the two docs during planning.
