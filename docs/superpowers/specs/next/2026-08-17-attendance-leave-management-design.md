# Attendance & Leave Management (Frontend) — Design

**Status:** Approved 2026-08-17. Companion to the backend repo's `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-attendance-leave-management-design.md`, which scopes the real API but has open questions still unanswered — this frontend ships against mocked data first and swaps to real calls once that backend work lands. No plan written yet.

> **SUPERSEDED (Leave only) — 2026-08-21.** The backend companion doc named above was never actually written (confirmed by directory listing on 2026-08-21 — only this frontend doc ever existed for Leave). A complete product spec surfaced since then (`C:\HR\leave-management-complete.md`, all 9 screens, full self-service + HR flows, not just HR-admin list+approve/reject) and now drives real backend + frontend design docs: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-leave-management-design.md` (backend) and `specs/next/2026-08-21-leave-management-design.md` (this repo). **The Leave section of this file below is historical only** — do not build against its mocked `LeaveRequestResponse` shape or its HR-only/no-self-service Phase 1 scope; see `plans/next/2026-08-21-leave-management/` instead. The **Attendance** section of this file is untouched and still current.

## Why this exists

The nav shell (`src/app/layouts/main-layout/nav/nav-items.config.ts`) already has live entries for **Attendance** (`/time-attendance`, gated on module `time_attendance`) and **Time Off** (`/time-off`, gated on module `leave`), but no routed feature sits behind either path yet. This is the next module to build after People/Organization.

## Scope — Phase 1

- **Audience:** HR/Admin only. No employee self-service (view-own-attendance, apply-for-leave) in this phase.
- **Attendance:** read-only list of daily records (employee, date, check-in/out time, status), filterable by employee, department, and date range. No manual entry/correction from the frontend in Phase 1 — the backend design doc's `POST /attendance/records` exists for HR to seed data via API/Postman, not for this UI to call yet.
- **Leave:** list of leave requests (employee, type, dates, status), filterable by employee, status, and date range, with Approve/Reject row actions. No "apply for leave" form in this phase (matches the backend's Open Question 2 — Create ships unused by any UI for now).
- Explicitly deferred: self-service screens, attendance manual correction UI, leave type/policy management UI, real backend integration.

## Data source: mocked, same contract shape as the real API

`AttendanceApiService` and `LeaveApiService` expose method signatures identical to what an `HttpClient`-backed service would have (matching the `PeopleApiService` pattern), but return `of(mockData).pipe(delay(300))` internally instead of calling `HttpClient`. Field names mirror the backend design doc's DTOs exactly, so migrating later is a same-shape swap of these two files' internals only — stores, components, and templates don't change:

```ts
// attendance-record.model.ts
export interface AttendanceRecordResponse {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string;
  date: string;               // ISO date
  checkInAt: string | null;
  checkOutAt: string | null;
  status: 'Present' | 'Late' | 'Absent' | 'OnLeave' | 'HalfDay';
}

// leave-request.model.ts
export interface LeaveRequestResponse {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'Annual' | 'Sick' | 'Unpaid' | 'Other';
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  requestedAt: string;
}
```

Mock datasets: ~30-50 seeded fake employees/records per module, generated once as a static fixture file per service (`attendance-api.service.fixtures.ts` / `leave-api.service.fixtures.ts`), covering all status values so filters and empty/loading/error states are all reachable in dev.

## Module structure

Follows the existing `modules/<domain>/{data-access,feature,models,state,ui}` convention used by `people`/`organization`:

```
src/app/modules/attendance/
  models/attendance-record.model.ts
  data-access/attendance-api.service.ts       ← mock-backed, real-shaped Observable API
  state/attendance.store.ts                   ← @ngrx/signals signalStore (records, totalCount, page, pageSize, filters, loading, error)
  feature/attendance-list/attendance-list.component.ts   ← page: filter bar + table
  ui/attendance-table/attendance-table.component.ts      ← presentational table
  attendance.routes.ts                        ← wired to the existing /time-attendance nav path

src/app/modules/leave/
  models/leave-request.model.ts
  data-access/leave-api.service.ts            ← mock: list / approve / reject
  state/leave.store.ts                        ← requests, totalCount, filters, loading, error; approve/reject re-fetch the list on success
  feature/leave-requests/leave-requests.component.ts     ← page: filter bar + table + row actions
  ui/leave-request-table/leave-request-table.component.ts
  leave.routes.ts                             ← wired to the existing /time-off nav path
```

No `nav-items.config.ts` change needed — both nav entries already exist and just need routed components behind their paths, following the same lazy-load + module-gate + permission-guard registration already used for `people`/`organization` in `app.routes.ts`.

Leave row actions (Approve/Reject) use an inline confirm (no modal) — matches the "list + approve/reject" scope without adding a new UI pattern; Reject requires a short reason, captured in the confirm step.

## Testing

`.spec.ts` alongside each component/service/store (Vitest), matching the existing 1:1 spec-file convention. Store specs assert filter/pagination state transitions and that approve/reject update `status` in place (or refetch) without a full-page reload.

## Follow-up once the backend lands

Swap `AttendanceApiService`/`LeaveApiService` internals from the fixture-backed `of(...)` calls to real `HttpClient` calls against `${environment.apiUrl}/attendance/records` and `${environment.apiUrl}/leave/requests`, per the backend design doc's route table. Backend's three open questions (attendance data source, whether Create ships without a UI, calendar-day vs working-day leave counting) must be resolved first — they affect whether this frontend's Phase 1 scope still holds once real data arrives.
