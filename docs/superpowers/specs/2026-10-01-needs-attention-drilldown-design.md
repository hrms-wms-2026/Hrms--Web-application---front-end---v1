# Needs Attention drill-down — design

**Date:** 2026-10-01
**Repos:** `HRMS-Backend-v1` (items endpoint), `Hrms--Web-application---front-end---v1` (UI)
**Screen:** Employee detail → Overview tab

## Problem

The Overview's **Needs Attention** card lists active violations as counts only ("3 min over break
allowance", "2 overdue tasks"). A manager cannot see *which* days or *which* tasks, and nothing on
the card links anywhere — there is no item identity to link to. The same is true of the coloured KPI
cards at the top of the tab, which are built from the same signals.

## Goal

Every Needs Attention signal (all 12) becomes a three-level drill-down, without leaving the profile:

1. **Signal row** — e.g. "3 days over break allowance". Click to expand.
2. **Items** — the 3 days (or tasks grouped by project, approvals, alerts) listed under the row.
3. **Item detail** — click one item to open its existing detail view over the profile.

## Non-goals / must not change

- **Signal content stays as is.** Every signal Needs Attention shows today (including
  missing clock-outs) keeps its rank, severity, label and detail. This work adds drill-down only.
- **KPI cards keep their behaviour.** `buildKpiCards` (`src/app/modules/people/utils/overview-kpi-cards.ts`),
  the top-4-signals-then-baselines rule, and severity colours are unchanged. The only addition is
  a click handler on signal-driven (coloured) cards.
- **No new detail components.** Every item detail reuses the component that already shows that thing
  elsewhere (see §3). No look-alike drawers or read-only copies.
- No generic approval-detail modal (approvals expand inline — see §3).

## Decisions taken during brainstorming

| Question | Decision |
|---|---|
| Scope | All 12 signals in one round |
| Where item detail opens | On the profile (drawer/modal), not by navigating away |
| How items load | Lazily, per signal, when its row is first expanded (approach A) |
| Coloured KPI card click | Scrolls to Needs Attention and expands the same signal |
| Approvals | Expand inline + "Review in approvals →" link |
| Tasks | Opened in the real task form modal; editable by whoever may edit |
| Discipline widget | Removed (see §4) |

---

## 1. Backend — signal items endpoint

### Endpoint

```
GET /employees/{employeeId}/overview/signals/{key}/items?from=YYYY-MM-DD&to=YYYY-MM-DD
```

- Same access guard as the signals endpoint (`IEmployeeReadAccessGuard.EnsureCanRead`) and same
  period resolution (`EmployeePeriod.Resolve`).
- **404** for an unknown `key`.
- **403** when the signal's source is not visible to the caller or its module is off — the same
  conditions under which `GetEmployeeOverviewSignalsQueryHandler` omits that signal (work module
  disabled, activity monitoring off, exception scope cannot see the employee, location verification
  off).

### Response

```jsonc
{
  "key": "over_break",
  "total": 3,                 // full count, may exceed items.length
  "timezone": "Asia/Colombo", // employee's attendance timezone; null for non-attendance keys
  "items": [ SignalItem, ... ] // at most 50, newest first
}
```

```jsonc
// SignalItem
{
  "kind": "attendance_day" | "monitoring_alert" | "exception_case" | "task" | "approval",
  "id": "string",            // record / alert / case / task / approval id; attendance_day uses the date
  "date": "YYYY-MM-DD",
  "title": "Tue 22 Sep",
  "subtitle": "35 min over allowance",
  "occurredAt": "ISO-8601 | null",   // alerts/cases: exact time
  "projectId": "guid | null",        // task only
  "projectName": "string | null",    // task only
  "dueDate": "YYYY-MM-DD | null",    // task only
  "approvalKind": "string | null",   // approval only (leave, attendance_correction, ...)
  "requestedAt": "ISO-8601 | null",  // approval only
  "approverName": "string | null"    // approval only
}
```

### Per-signal sources — counts and lists must share one rule

For every key, items are produced by **the same code path that produces the signal's count**, so
`total` always equals the signal's `value` for the same period. Where the count lives inside a
calculator loop today, that loop is extended to also collect the dates rather than duplicated.

| Signal key | kind | Source |
|---|---|---|
| `absent_days` | attendance_day | `AttendancePeriodCalculator.Classify` — dates classified `absent` |
| `missing_clock_outs` | attendance_day | `Classify` — dates where `IsMissingClockOut` |
| `late_clock_ins` | attendance_day | `Classify` — dates where `IsLate` |
| `early_clock_outs` | attendance_day | `Classify` — dates where `IsEarlyDeparture` |
| `short_hours_days` | attendance_day | `Classify` — the short-hours condition |
| `off_schedule_work` | attendance_day | `Classify` — worked on non-working day **or** during approved time off (subtitle says which) |
| `over_break` | attendance_day | Discipline handler's break-allowance loop; subtitle = minutes over |
| `location_violations` | monitoring_alert | `OutsideWorkLocationAlert` notifications, same range query as the count |
| `idle_activity_alerts` | monitoring_alert | `LongIdleAlert` + `LowActivityAlert` notifications |
| `monitoring_exceptions` | exception_case | Exception cases in range, same `exceptionScope` visibility check |
| `overdue_tasks` | task | Work overview's overdue rule, with project id/name |
| `pending_approvals` | approval | `GetEmployeeApprovalActivity` items filtered to `pending` (without its `MaxItems` cap) |

Implementation shape: `AttendancePeriodClassification` gains per-violation date lists alongside the
existing counts; the discipline handler's over-break loop records the dates it counts; notification
and exception repositories get a list counterpart to their existing `Count…InRange` methods; the
work and approvals sources expose their filtered item lists. A single
`GetEmployeeSignalItemsQuery` handler dispatches on `key`.

### Backend tests

- For each of the 12 keys: on shared fixture data, `items.length` (when ≤ 50) and `total` equal that
  signal's `value` from `GetEmployeeOverviewSignals` for the same period.
- 404 for unknown key; 403 for each hidden-source condition; cap at 50 with correct `total`.
- Existing calculator / discipline / signals tests keep passing unchanged (counts unaffected).

---

## 2. Frontend — Needs Attention interaction

- Each signal row becomes a `<button>` with a chevron and `aria-expanded`; clicking toggles its items
  panel directly beneath it.
- **One row open at a time.** Opening another closes the current one.
- The existing collapsed-to-3 / "View all" behaviour stays; expanding a row beyond the first 3
  (e.g. from a KPI card) switches to "View all" first.
- First expand fetches items (skeleton rows while loading; inline error with **Retry** on failure).
  Results are cached by `key + from + to`; reopening is instant.
- Changing the month or the compare month clears the cache and collapses any open row.

### Item list presentation (`app-signal-items-list`, renders by `kind`)

- **attendance_day / monitoring_alert:** one line per item — `title · subtitle` (alerts add the
  time), with a `›` affordance.
- **task:** grouped under project headings — **Project Apollo** (2) → task title + due date.
- **approval:** approval type · title · "requested 28 Sep"; click expands inline (see §3).
- **exception_case:** date + time + short description.
- When `total > items.length`: "+N more · open full list" linking to the module page.

### KPI card click

Signal-driven (coloured) KPI cards become clickable: click → scroll Needs Attention into view and
expand the same `key`. Baseline (neutral) cards stay non-interactive. Card colours, order and
content do not change.

### New frontend units

- `SignalDrilldownStore` (component-scoped to the Overview tab): `openKey`, per-key item cache,
  loading/error state, `open(key)`, `close()`, `reset()`. Shared by the KPI strip and Needs
  Attention so a card click can open a row.
- `app-signal-items-list`: presentational; input = items response; output = `itemSelected(item)`.
- `PeopleApiService.getOverviewSignalItems(employeeId, key, from, to)`.
- `overview-needs-attention.component.ts` is extended in place. **It currently has uncommitted
  edits from another session** — implementation must build on the file as it is on disk, not
  replace it.

### Frontend tests

- First expand calls the API once; reopen uses cache; month change clears and collapses.
- Only one row open at a time; expanding a row past the first 3 switches to View all.
- Tasks render grouped by project with counts.
- Coloured KPI card click opens the matching row; baseline cards do nothing.
- Error state shows Retry and refetches.

---

## 3. Item detail — reused components only

All detail views open over the profile; closing returns to Needs Attention with the row still open.

| Item kind | Opens (existing component) | Wiring |
|---|---|---|
| attendance_day | `app-attendance-detail-drawer` | `selection = { employeeId, workDate: item.date }`, `displayTimezone = response.timezone`. `TimeTrackingStore` is root-provided, so it loads outside Time Tracking. The `requestCorrection` output is not bound on the profile (a reviewer is not the requester). |
| monitoring_alert | `app-attendance-detail-drawer` | Same, for the alert's date. The alert's time is shown on its row in the items list; the drawer is reused unchanged. |
| exception_case | `app-exception-evidence-panel` inside `app-modal` | Same inputs the Alerts page passes. |
| task | `app-task-form-modal` | `mode = 'edit'`, `projectId = item.projectId`, `taskId = item.id`. `ProjectDetailStore` is loaded for that project before opening (the modal reads members/statuses from it). Edits allowed per the user's existing permissions. If the project cannot be loaded for the viewer (403), the item shows **"Open on board →"** to `/work/{projectId}/board?taskId={id}` instead. |
| approval | *inline* | Row expands to show type, title, requested date, waiting approver, plus **"Review in approvals →"** to the matching approvals inbox. |

### Risk: task modal outside the board

`app-task-form-modal` (≈2,600 lines) reads `ProjectDetailStore` and `TaskBoardStore`, both
root-provided. Loading a project into `ProjectDetailStore` from the profile changes shared root
state; the project pages already (re)load their project on entry, so this is acceptable, but the
plan must verify that navigating from the profile to a *different* project afterwards shows that
project's data, not the one loaded for the modal.

### Detail tests

- attendance_day opens the drawer with the right employee, date and timezone, and no correction
  action; monitoring_alert opens the drawer for its date.
- exception_case opens the evidence panel in a modal.
- task opens the modal in edit mode for the right project/task; falls back to the board link on 403.
- approval expands inline with the inbox link.

---

## 4. Discipline widget removal

`app-overview-discipline-widget` is rendered only inside the hidden (`display: none`) test-compat
block in `overview-tab.component.ts`; every figure it shows is already a Needs Attention signal.
Remove that element and the component. **Keep** `app-overview-approvals-widget` in that block — the
visible Approval Activity card reads from it. Update overview-tab specs that reference the
Discipline widget.

## 5. Already done (this session, uncommitted)

Attendance widget: Missing clock-out stat removed (it lives in Needs Attention); five-day row uses
real recent working days; one shared status colour scale; "View attendance →" deep-links to Time
Tracking team view filtered to the employee and period.

## Open risks

- Count/list drift if a future change edits a count without its list — mitigated by the
  per-key equality tests in §1.
- Shared working tree: other sessions are editing Overview files; commit only files this work
  touches and re-check `git status` before each commit.
