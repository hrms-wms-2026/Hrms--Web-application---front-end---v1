# Attendance Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the Attendance module into a summary "Overview" page (status, today's numbers, weekly trend, monthly attendance health, requests summary, quick links) and a detail-focused "Time Tracking" page (live session, today's timeline, history table, correction/work-area requests), without duplicating the clock-action UI or attendance data-fetching logic between them.

**Architecture:** Extract the existing status-pill/clock-action/metric-card markup out of `TimeTrackingComponent` into a standalone `AttendanceStatusCardComponent` shared by both pages. Build the new Overview page by composing that shared card with the already-existing weekly trend card (moved from the dashboard module into attendance) and two new small cards (monthly health, requests summary) that read from `TimeTrackingStore`, which gains one new backend-backed method. Time Tracking keeps all of today's detail (history table, corrections, work-area/location requests) and gains two purely additive pieces: a live "today" timeline (new store slice, existing `history-detail` endpoint — no backend change) and two new columns on the history table (`Scheduled`, `Break` — `Break` already exists in the data, `Scheduled` needs one small backend DTO addition). The one new backend concept — monthly late-arrival/early-departure/missing-clock-out counts — is computed from data that already exists per `AttendanceRecord` (`ScheduledStart`/`ScheduledEnd`/`ActualStart`/`ActualEnd`) via a new aggregation query; no new domain fields or persisted concepts are introduced.

**Tech Stack:** Angular 21 (standalone components, `@ngrx/signals` `signalStore`), .NET (MediatR CQRS, xUnit + Moq + FluentAssertions).

**Spec:** No separate spec doc exists for this feature. The spec is the "Spec Summary" section immediately below, distilled from the user's Attendance Overview/Time Tracking redesign brief (2026-09-08 conversation) reconciled against a codebase inventory (see "Existing-code reconciliation" below). This plan file is the spec of record — read it in full before starting any task.

## Spec Summary

**New page — Overview** (`/attendance/overview`, first child under the Attendance nav item, and the new default redirect target for `/attendance`):
1. A status hero: current clock status (working / on break / not clocked in / completed), today's worked-vs-scheduled with a combined progress bar, clock-in time, work mode, and the Start break / End break / Clock in / Clock out action buttons.
2. A weekly summary: per-day worked hours (Mon–Sun bars) and a weekly total.
3. A monthly attendance-health summary: days present out of working days in the month, late arrivals, early departures, missing clock-outs.
4. A small requests summary: counts/most-recent status of the employee's own pending correction and work-area-change requests, linking to Time Tracking's Team/Requests view for the full list.
5. Quick links to Time Tracking and (when the employee has covered reports) the team view.

**Time Tracking stays the detail page** — no weekly or monthly summary is added there (that would duplicate Overview). It gains:
1. A live "Today's activity" timeline (clock-in / break-start / break-end events for the current day), reusing the same event model already used for past-day detail, but as its own store slice so it doesn't fight with the history drawer's day-detail state.
2. `Scheduled` and `Break` columns on the history table (`Break` already exists in the row data and is simply unrendered today; `Scheduled` needs a one-field DTO addition).

**Explicitly out of scope for this plan** (see "Deferred" below): promoting the existing correction / work-area-change / location-change request panels into a fully standalone routed "Requests" page. The rationale is in "Existing-code reconciliation."

## Existing-code reconciliation

This corrects and grounds the brief's assumptions against what already exists, found while investigating before writing this plan:

- **Nav/routing today:** `Attendance` has exactly two children — Time Tracking (`/attendance/time-tracking`, also the `''` redirect target) and Monitoring (`/attendance/monitoring`). No Overview, no standalone Requests route. (`src/app/layouts/main-layout/nav/nav-items.config.ts:29-53`, `src/app/modules/attendance/attendance.routes.ts`)
- **Clock actions already live in `TimeTrackingStore`** as plain async methods (`clockIn`, `startBreak`, `endBreak`, `clockOut`) — a new component can call `store.clockIn()` etc. directly with no new wiring. (`src/app/modules/attendance/state/time-tracking.store.ts:524-541`)
- **"Worked vs. scheduled with a progress bar" does not exist yet** — today's hero has four separate metric cards (Work schedule, Break time, Worked today, Attendance times); only the break-time card has a progress bar (for break allowance, a different metric). (`src/app/modules/attendance/feature/time-tracking/time-tracking.component.html:118-256`)
- **A weekly trend card already exists** — `AttendanceTrendCardComponent`, currently rendered only on the Home dashboard, reads `TimeTrackingStore.history()` directly and needs zero changes to be reused inside Attendance. (`src/app/modules/dashboard/feature/attendance-trend-card/attendance-trend-card.component.ts`)
- **"Today's activity timeline" data already exists but is wired only to past days.** `AttendanceDayDetail.timelineEvents` comes back from the existing `GET /attendance/time-tracking/history-detail` endpoint via `TimeTrackingStore.loadDayDetail(employeeId, workDate)` / `store.dayDetail()`, but that same state slice is shared with — and cleared by — the historical detail drawer (`attendance-detail-drawer.component.ts`). Reusing `dayDetail` directly for a live "today" view would make opening a past day's drawer clobber the live timeline, and closing the drawer would clear it. This plan adds a **separate** state slice (`todayTimelineEvents` / `loadTodayTimeline`) hitting the same existing endpoint, rather than reusing `dayDetail`.
- **Monthly attendance health does not exist as a computed summary anywhere**, but the raw data it needs already does: `AttendanceRecord.ScheduledStart`/`ScheduledEnd` (`TimeOnly?`) and `ActualStart`/`ActualEnd` (`DateTimeOffset?`) are already loaded per record in `AttendanceReadHandler.BuildRowsAsync`, and `AttendanceDayStatusResolver.Resolve(...)` already classifies a day as `missing_clock_out` from exactly this data. So this plan adds a new **aggregation query**, not a new domain concept. Late-arrival/early-departure grace is a plain code constant (mirroring `AttendanceDayStatusResolver.MissingClockOutThreshold`'s pattern), not the payroll `ClockInPolicy.LateArrivalMinute` tiered-deduction field — that field encodes graduated payroll multipliers for a different feature and pulling it in here would couple this display-only feature to payroll config for no benefit.
- **`Break` is already on `AttendanceHistoryRow.breakMinutes` today** — the history table just doesn't render it. **`Scheduled` is not** — `BuildRowsAsync` computes a `schedule` object with `ScheduledStart`/`ScheduledEnd`/`RequiredWorkMinutes` per record already but never puts it on the response DTO. (`HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadHandlers.cs:251-258`)
- **Correction and work-area-change requests already exist in full** (models, forms, preview/submit flows, approvals) but their state (draft form values, preview flow) is owned directly by `TimeTrackingComponent` (`src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts:110-126, 273-500`), not by `MyRequestsPanelComponent`. Promoting Requests to an independently-routed page means first extracting that state out of `TimeTrackingComponent` — a separate, larger, riskier refactor with its own test surface. Building it speculatively now would violate YAGNI; it's called out as a follow-on, not attempted here.
- **Monitoring is confirmed to be a pure policy/config screen today** (toggles for activity monitoring, app tracking, screenshot capture, idle threshold) with no activity feed of its own — so nothing about this plan risks colliding with it, and no changes to Monitoring are needed.

## Global Constraints

- Angular standalone components only, `ChangeDetectionStrategy.OnPush` on every new component (matches every existing component touched by this plan).
- New backend DTOs are C# `sealed record`s; new queries follow the existing `IRequestHandler<TQuery, Result<TResponse>>` MediatR pattern in `AttendanceReadHandler`.
- No emojis anywhere in UI copy or code comments — this codebase's nav icons are hand-authored inline SVGs (`src/app/layouts/main-layout/side-navbar/nav-icon.component.ts`), and none are added by this plan (sub-nav items render no icon; page headers use the existing `icon="time-attendance"` prop already used by Time Tracking).
- All new frontend state lives in `TimeTrackingStore` (`src/app/modules/attendance/state/time-tracking.store.ts`) — no new store is introduced, matching how `AttendanceTrendCardComponent` already reads this same store from outside the attendance module.
- Every new/changed backend response field is additive (nullable or defaulted) so existing consumers of `AttendanceHistoryRow`/`AttendanceTodayResponse` are unaffected.

---

## Task 1: Expose `Scheduled` fields on `AttendanceHistoryRow`

**Files:**
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs:66-87`
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadHandlers.cs:246-303`
- Test: `HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendanceReadHandlerTests.cs`

**Interfaces:**
- Produces: `AttendanceHistoryRow` gains three trailing optional fields — `string? ScheduledStartTime`, `string? ScheduledEndTime`, `int? RequiredWorkMinutes` — consumed by Task 3 (frontend model) and Task 11 (history table column).

- [ ] **Step 1: Write the failing test**

Add to `AttendanceReadHandlerTests.cs` (near the other `MyHistory_*` tests, e.g. after `MyHistory_AppliesPagingAndReturnsPagedResult`):

```csharp
[Fact]
public async Task MyHistory_ExposesScheduledStartEndAndRequiredMinutes()
{
    var fixture = CreateFixture();
    var record = new AttendanceRecord
    {
        Id = Guid.NewGuid(),
        TenantId = TenantId,
        EmployeeId = EmployeeId,
        Date = new(2026, 8, 21),
        ScheduledStart = new TimeOnly(9, 0),
        ScheduledEnd = new TimeOnly(17, 30),
        RequiredWorkMinutes = 480
    };
    fixture.Attendance.Setup(x => x.ListRecordsAsync(TenantId, It.Is<IReadOnlyCollection<Guid>>(ids => ids.SequenceEqual(new[] { EmployeeId })), new(2026, 8, 1), new(2026, 8, 21), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
        .ReturnsAsync((new List<AttendanceRecord> { record }, 1));

    var result = await fixture.Handler.Handle(
        new GetMyAttendanceHistoryQuery(new(2026, 8, 1), new(2026, 8, 21), new PagedRequest()), CancellationToken.None);

    result.Value!.Items[0].ScheduledStartTime.Should().Be("09:00");
    result.Value.Items[0].ScheduledEndTime.Should().Be("17:30");
    result.Value.Items[0].RequiredWorkMinutes.Should().Be(480);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit --filter FullyQualifiedName~MyHistory_ExposesScheduledStartEndAndRequiredMinutes`
Expected: FAIL — `AttendanceHistoryRow` has no `ScheduledStartTime` member (compile error).

- [ ] **Step 3: Add the fields to the DTO**

In `AttendanceReadResponses.cs`, extend the `AttendanceHistoryRow` record (it currently ends `... int BreakOverageMinutes = 0, bool IsOverBreakAllowance = false);` at line 87):

```csharp
public sealed record AttendanceHistoryRow(
    Guid AttendanceRecordId,
    DateOnly WorkDate,
    AttendanceHistoryEmployee? Employee,
    DateTimeOffset? ClockInAt,
    DateTimeOffset? ClockOutAt,
    bool IsActive,
    int BreakMinutes,
    int TotalWorkedMinutes,
    string? ExpectedWorkMode,
    string? AttendanceSource,
    string Status,
    bool CanViewDetails,
    bool CanRequestCorrection,
    bool CanRequestWorkAreaChange,
    bool CanCorrect,
    string? StatusLabel = null,
    string? AttentionType = null,
    string? AttentionLabel = null,
    string? AttentionSeverity = null,
    int BreakOverageMinutes = 0,
    bool IsOverBreakAllowance = false,
    string? ScheduledStartTime = null,
    string? ScheduledEndTime = null,
    int? RequiredWorkMinutes = null);
```

- [ ] **Step 4: Populate the fields in `BuildRowsAsync`**

In `AttendanceReadHandlers.cs`, the `schedule` local (built at line 251) already carries `ScheduledStart`/`ScheduledEnd`/`RequiredWorkMinutes` — pass them through on the returned row. Change the `return new AttendanceHistoryRow(...)` at line 280 to add the three new arguments at the end:

```csharp
            return new AttendanceHistoryRow(
                record.Id,
                record.Date,
                includeEmployee && identities.TryGetValue(record.EmployeeId, out var identity) ? identity : null,
                record.ActualStart,
                record.ActualEnd,
                record.ActualStart is not null && record.ActualEnd is null,
                record.BreakMinutes,
                AttendanceTodayStateService.CalculateWorkedMinutes(record, breakUsedMinutes, now),
                NormalizeWorkMode(record.ExpectedWorkArea),
                record.AttendanceSource,
                status.Status,
                CanViewDetails: true,
                CanRequestCorrection: record.EmployeeId == currentEmployeeId
                    && record.Date <= (dateTimeProvider?.Today ?? DateOnly.FromDateTime(DateTime.UtcNow)),
                CanRequestWorkAreaChange: false,
                CanCorrect: false,
                status.StatusLabel,
                status.AttentionType,
                status.AttentionLabel,
                status.AttentionSeverity,
                status.BreakOverageMinutes,
                status.IsOverBreakAllowance,
                schedule.Start?.ToString("HH:mm"),
                schedule.End?.ToString("HH:mm"),
                schedule.RequiredWorkMinutes);
        }).ToList();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit --filter FullyQualifiedName~MyHistory_ExposesScheduledStartEndAndRequiredMinutes`
Expected: PASS

- [ ] **Step 6: Run the full read-handler suite to check for regressions**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit --filter FullyQualifiedName~AttendanceReadHandlerTests`
Expected: PASS (all existing tests still pass — the new fields are trailing optional parameters)

- [ ] **Step 7: Commit**

```bash
git add HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadHandlers.cs HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendanceReadHandlerTests.cs
git commit -m "feat(attendance): expose scheduled start/end/required-minutes on history rows"
```

---

## Task 2: Backend — monthly attendance-health aggregation endpoint

**Files:**
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/DTOs/Responses/AttendanceReadResponses.cs`
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadQueries.cs`
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance/Queries/AttendanceReadHandlers.cs`
- Modify: `HRMS-Backend-v1/src/ONEVO.Api/Controllers/Tenant/Attendance/TimeTrackingController.cs`
- Test: `HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendanceReadHandlerTests.cs`

**Interfaces:**
- Consumes: `IAttendanceReadRepository.ListRecordsAsync(tenantId, employeeIds, from, to, skip, take, ct)` (existing, `IAttendanceReadRepository.cs:25-32`), `AttendanceDayStatusResolver.Resolve(...)` (existing, `Services/AttendanceDayStatusResolver.cs:25-34`).
- Produces: `GetMyAttendanceMonthlySummaryQuery(DateOnly From, DateOnly To) : IRequest<Result<AttendanceMonthlySummaryResponse>>` and `AttendanceMonthlySummaryResponse(int WorkingDays, int DaysPresent, int LateArrivals, int EarlyDepartures, int MissingClockOuts)`, and `GET /api/v1/attendance/time-tracking/monthly-summary?from=&to=` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Add to `AttendanceReadHandlerTests.cs`:

```csharp
[Fact]
public async Task MonthlySummary_CountsPresentLateEarlyAndMissingClockOut()
{
    var fixture = CreateFixture();
    var records = new List<AttendanceRecord>
    {
        // On time, full day worked.
        new() {
            Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = EmployeeId, Date = new(2026, 8, 3),
            ExpectedWorkingDay = true, ScheduledStart = new TimeOnly(9, 0), ScheduledEnd = new TimeOnly(17, 30),
            ActualStart = DateTimeOffset.Parse("2026-08-03T03:30:00+00:00"), ActualEnd = DateTimeOffset.Parse("2026-08-03T12:00:00+00:00")
        },
        // Late arrival (clocked in 04:00 local = after 09:00 scheduled start, Colombo is UTC+5:30 so 03:30Z == 09:00 local).
        new() {
            Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = EmployeeId, Date = new(2026, 8, 4),
            ExpectedWorkingDay = true, ScheduledStart = new TimeOnly(9, 0), ScheduledEnd = new TimeOnly(17, 30),
            ActualStart = DateTimeOffset.Parse("2026-08-04T04:15:00+00:00"), ActualEnd = DateTimeOffset.Parse("2026-08-04T12:00:00+00:00")
        },
        // Early departure (clocked out 11:00 local, before 17:30 scheduled end).
        new() {
            Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = EmployeeId, Date = new(2026, 8, 5),
            ExpectedWorkingDay = true, ScheduledStart = new TimeOnly(9, 0), ScheduledEnd = new TimeOnly(17, 30),
            ActualStart = DateTimeOffset.Parse("2026-08-05T03:30:00+00:00"), ActualEnd = DateTimeOffset.Parse("2026-08-05T05:30:00+00:00")
        },
        // Missing clock-out (still open after the 16h threshold).
        new() {
            Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = EmployeeId, Date = new(2026, 8, 6),
            ExpectedWorkingDay = true, ScheduledStart = new TimeOnly(9, 0), ScheduledEnd = new TimeOnly(17, 30),
            ActualStart = DateTimeOffset.Parse("2026-08-06T03:30:00+00:00"), ActualEnd = null
        },
        // Never clocked in — counts toward WorkingDays but not DaysPresent.
        new() {
            Id = Guid.NewGuid(), TenantId = TenantId, EmployeeId = EmployeeId, Date = new(2026, 8, 7),
            ExpectedWorkingDay = true, ScheduledStart = new TimeOnly(9, 0), ScheduledEnd = new TimeOnly(17, 30)
        }
    };
    fixture.Attendance.Setup(x => x.ListRecordsAsync(TenantId, It.Is<IReadOnlyCollection<Guid>>(ids => ids.SequenceEqual(new[] { EmployeeId })), new(2026, 8, 1), new(2026, 8, 7), 0, It.IsAny<int>(), It.IsAny<CancellationToken>()))
        .ReturnsAsync((records, records.Count));

    var result = await fixture.Handler.Handle(
        new GetMyAttendanceMonthlySummaryQuery(new(2026, 8, 1), new(2026, 8, 7)), CancellationToken.None);

    result.IsSuccess.Should().BeTrue();
    result.Value!.WorkingDays.Should().Be(5);
    result.Value.DaysPresent.Should().Be(4);
    result.Value.LateArrivals.Should().Be(1);
    result.Value.EarlyDepartures.Should().Be(1);
    result.Value.MissingClockOuts.Should().Be(1);
}

[Fact]
public async Task MonthlySummary_RangeOverAMonthIsRejected()
{
    var fixture = CreateFixture();

    var result = await fixture.Handler.Handle(
        new GetMyAttendanceMonthlySummaryQuery(new(2026, 8, 1), new(2026, 10, 1)), CancellationToken.None);

    result.IsSuccess.Should().BeFalse();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit --filter FullyQualifiedName~MonthlySummary`
Expected: FAIL — `GetMyAttendanceMonthlySummaryQuery` and `AttendanceMonthlySummaryResponse` don't exist (compile error).

- [ ] **Step 3: Add the response DTO**

In `AttendanceReadResponses.cs`, add near `AttendanceHistoryRow`:

```csharp
public sealed record AttendanceMonthlySummaryResponse(
    int WorkingDays,
    int DaysPresent,
    int LateArrivals,
    int EarlyDepartures,
    int MissingClockOuts);
```

- [ ] **Step 4: Add the query**

In `AttendanceReadQueries.cs`, add alongside `GetMyAttendanceHistoryQuery`:

```csharp
public sealed record GetMyAttendanceMonthlySummaryQuery(DateOnly From, DateOnly To) : IRequest<Result<AttendanceMonthlySummaryResponse>>;
```

- [ ] **Step 5: Implement the handler**

In `AttendanceReadHandlers.cs`:

1. Add `IRequestHandler<GetMyAttendanceMonthlySummaryQuery, Result<AttendanceMonthlySummaryResponse>>` to the class's interface list (alongside the three existing ones on line 31-34).
2. Add a late-arrival/early-departure grace constant near the top of the class, mirroring `AttendanceDayStatusResolver.MissingClockOutThreshold`'s documented-constant style:

```csharp
    // Kept as a plain code constant (not a configurable policy field) because this is a
    // display-only summary, not the payroll-affecting ClockInPolicy.LateArrivalMinute tiers -
    // coupling this count to that graduated deduction schedule would be the wrong dependency.
    private static readonly TimeSpan LateOrEarlyGrace = TimeSpan.Zero;
```

3. Add the handler method (place it after `Handle(GetMyAttendanceHistoryQuery ...)`, before `Handle(GetCoveredAttendanceHistoryQuery ...)`):

```csharp
    public async Task<Result<AttendanceMonthlySummaryResponse>> Handle(
        GetMyAttendanceMonthlySummaryQuery query, CancellationToken ct)
    {
        var validation = ValidateRange(query.From, query.To);
        if (validation is not null)
            return Result<AttendanceMonthlySummaryResponse>.Failure(validation);
        if (query.To.DayNumber - query.From.DayNumber > 31)
            return Result<AttendanceMonthlySummaryResponse>.Failure("Range must be 31 days or fewer.");

        var employee = await employees.GetDefaultForUserAsync(currentUser.TenantId, currentUser.UserId, ct);
        if (employee is null)
            return Result<AttendanceMonthlySummaryResponse>.NotFound("Current employee record was not found.");

        var (records, _) = await attendance.ListRecordsAsync(
            currentUser.TenantId, [employee.Id], query.From, query.To, 0, 62, ct);

        var legalEntity = legalEntities is not null && employee.LegalEntityId is Guid entityId
            ? await legalEntities.GetByIdForTenantAsync(currentUser.TenantId, entityId, ct)
            : null;
        var timezone = TryFindTimezone(legalEntity?.Timezone ?? records.FirstOrDefault()?.ScheduleTimezone);
        var now = dateTimeProvider?.UtcNow ?? DateTimeOffset.UtcNow;

        var workingDays = 0;
        var daysPresent = 0;
        var lateArrivals = 0;
        var earlyDepartures = 0;
        var missingClockOuts = 0;

        foreach (var record in records)
        {
            if (record.ExpectedWorkingDay)
                workingDays += 1;

            if (record.ActualStart is null)
                continue;

            daysPresent += 1;

            if (record.ScheduledStart is TimeOnly scheduledStart)
            {
                var localStart = TimeZoneInfo.ConvertTime(record.ActualStart.Value, timezone).TimeOfDay;
                if (localStart - scheduledStart.ToTimeSpan() > LateOrEarlyGrace)
                    lateArrivals += 1;
            }

            if (record.ActualEnd is DateTimeOffset actualEnd && record.ScheduledEnd is TimeOnly scheduledEnd)
            {
                var localEnd = TimeZoneInfo.ConvertTime(actualEnd, timezone).TimeOfDay;
                if (scheduledEnd.ToTimeSpan() - localEnd > LateOrEarlyGrace)
                    earlyDepartures += 1;
            }

            if (record.ActualEnd is null
                && now - record.ActualStart.Value >= AttendanceDayStatusResolver.MissingClockOutThreshold)
                missingClockOuts += 1;
        }

        return Result<AttendanceMonthlySummaryResponse>.Success(
            new AttendanceMonthlySummaryResponse(workingDays, daysPresent, lateArrivals, earlyDepartures, missingClockOuts));
    }
```

- [ ] **Step 6: Add the controller endpoint**

In `TimeTrackingController.cs`, add after the `History` action (line 78):

```csharp
    [HttpGet("monthly-summary")]
    public async Task<IActionResult> MonthlySummary(
        [FromQuery] DateOnly from,
        [FromQuery] DateOnly to,
        CancellationToken ct = default)
    {
        var result = await mediator.Send(new GetMyAttendanceMonthlySummaryQuery(from, to), ct);
        return result.IsSuccess
            ? Ok(result.Value)
            : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit --filter FullyQualifiedName~MonthlySummary`
Expected: PASS

- [ ] **Step 8: Run the full unit-test project to check for regressions**

Run: `dotnet test HRMS-Backend-v1/tests/ONEVO.Tests.Unit`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add HRMS-Backend-v1/src/ONEVO.Application/Features/TimeAttendance HRMS-Backend-v1/src/ONEVO.Api/Controllers/Tenant/Attendance/TimeTrackingController.cs HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendanceReadHandlerTests.cs
git commit -m "feat(attendance): add monthly attendance-health summary endpoint"
```

---

## Task 3: Frontend — model, API method, and store slice for monthly summary + scheduled fields

**Files:**
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/models/time-tracking.model.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/data-access/time-tracking-api.service.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/state/time-tracking.store.ts`
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/state/time-tracking.store.spec.ts`
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts`

**Interfaces:**
- Consumes: Task 1's three new `AttendanceHistoryRow` fields; Task 2's `GET /attendance/time-tracking/monthly-summary` endpoint.
- Produces: `AttendanceMonthlySummaryResponse` model type; `TimeTrackingApiService.getMyMonthlySummary(from: string, to: string): Observable<AttendanceMonthlySummaryResponse>`; `TimeTrackingStore` gains `monthlySummary`, `monthlySummaryLoading`, `monthlySummaryError` signals and a `loadMonthlySummary(range: TimeTrackingRange): Promise<void>` method — consumed by Task 6.

- [ ] **Step 1: Add the model fields and type**

In `time-tracking.model.ts`, add `scheduledStartTime`/`scheduledEndTime`/`requiredWorkMinutes` to `AttendanceHistoryRow` (mirrors Task 1's DTO) and a new interface:

```typescript
export interface AttendanceHistoryRow {
  attendanceRecordId: string;
  workDate: string;
  employee: AttendanceHistoryEmployee | null;
  clockInAt: string | null;
  clockOutAt: string | null;
  isActive: boolean;
  breakMinutes: number;
  totalWorkedMinutes: number;
  expectedWorkMode: string | null;
  attendanceSource: string | null;
  status: string;
  canViewDetails: boolean;
  canRequestCorrection: boolean;
  canRequestWorkAreaChange: boolean;
  canCorrect: boolean;
  statusLabel?: string | null;
  attentionType?: string | null;
  attentionLabel?: string | null;
  attentionSeverity?: string | null;
  breakOverageMinutes?: number;
  isOverBreakAllowance?: boolean;
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  requiredWorkMinutes?: number | null;
}

export interface AttendanceMonthlySummaryResponse {
  workingDays: number;
  daysPresent: number;
  lateArrivals: number;
  earlyDepartures: number;
  missingClockOuts: number;
}
```

- [ ] **Step 2: Write the failing API-service test**

Add to `time-tracking-api.service.spec.ts` (mirror whichever existing test calls `getMyHistory` for the `HttpTestingController` setup pattern already in that file):

```typescript
it('getMyMonthlySummary requests the monthly-summary endpoint with from/to params', () => {
  service.getMyMonthlySummary('2026-08-01', '2026-08-31').subscribe();

  const req = httpMock.expectOne(
    (request) => request.url === `${basePath}/monthly-summary`
      && request.params.get('from') === '2026-08-01'
      && request.params.get('to') === '2026-08-31'
  );
  expect(req.request.method).toBe('GET');
  req.flush({ workingDays: 20, daysPresent: 18, lateArrivals: 2, earlyDepartures: 1, missingClockOuts: 0 });
});
```

(If the existing spec file does not already expose a `basePath` constant matching `${environment.apiUrl}/attendance/time-tracking`, inline that string instead of referencing `basePath`.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --include='**/time-tracking-api.service.spec.ts'`
Expected: FAIL — `getMyMonthlySummary` does not exist on `TimeTrackingApiService` (compile error).

- [ ] **Step 4: Implement the API method**

In `time-tracking-api.service.ts`, import `AttendanceMonthlySummaryResponse` from the model file and add, after `getMyHistory`:

```typescript
  getMyMonthlySummary(from: string, to: string): Observable<AttendanceMonthlySummaryResponse> {
    return this.http.get<AttendanceMonthlySummaryResponse>(`${this.basePath}/monthly-summary`, {
      params: this.rangeParams(from, to)
    });
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --include='**/time-tracking-api.service.spec.ts'`
Expected: PASS

- [ ] **Step 6: Write the failing store test**

Add to `time-tracking.store.spec.ts` (mirror the existing `loadMyHistory` test's TestBed/mock-service setup pattern already in that file):

```typescript
it('loadMonthlySummary patches monthlySummary on success', async () => {
  const store = TestBed.inject(TimeTrackingStore);
  const api = TestBed.inject(TimeTrackingApiService);
  jest.spyOn(api, 'getMyMonthlySummary').mockReturnValue(of({
    workingDays: 20, daysPresent: 18, lateArrivals: 2, earlyDepartures: 1, missingClockOuts: 0
  }));

  await store.loadMonthlySummary({ from: '2026-08-01', to: '2026-08-31' });

  expect(store.monthlySummary()).toEqual({
    workingDays: 20, daysPresent: 18, lateArrivals: 2, earlyDepartures: 1, missingClockOuts: 0
  });
  expect(store.monthlySummaryLoading()).toBe(false);
  expect(store.monthlySummaryError()).toBeNull();
});
```

(Use whichever test double convention — `jest.spyOn` or the codebase's existing Jasmine/`jest` runner and `HttpTestingController` vs. service-mock style — the existing tests in this spec file already use; match it exactly rather than introducing a second style.)

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test -- --include='**/time-tracking.store.spec.ts'`
Expected: FAIL — `loadMonthlySummary`/`monthlySummary` don't exist on the store (compile error).

- [ ] **Step 8: Implement the store slice**

In `time-tracking.store.ts`:

1. Import `AttendanceMonthlySummaryResponse` from `../models/time-tracking.model`.
2. Add an error constant near the other `TIME_TRACKING_*_ERROR` constants:

```typescript
export const TIME_TRACKING_MONTHLY_SUMMARY_ERROR = 'Could not load your attendance summary. Try again.';
```

3. Add three fields to `TimeTrackingState` (after `historyTotalCount`):

```typescript
  readonly monthlySummary: AttendanceMonthlySummaryResponse | null;
  readonly monthlySummaryLoading: boolean;
  readonly monthlySummaryError: string | null;
```

4. Add matching entries to `initialState`:

```typescript
  monthlySummary: null,
  monthlySummaryLoading: false,
  monthlySummaryError: null,
```

5. Add the method inside `withMethods`'s returned object (after `loadMyHistory`):

```typescript
      async loadMonthlySummary(range: TimeTrackingRange): Promise<void> {
        if (store.monthlySummaryLoading()) return;
        patchState(store, { monthlySummaryLoading: true, monthlySummaryError: null });
        try {
          const monthlySummary = await firstValueFrom(api.getMyMonthlySummary(range.from, range.to));
          patchState(store, { monthlySummary, monthlySummaryLoading: false, monthlySummaryError: null });
        } catch (error) {
          patchState(store, { monthlySummaryLoading: false, monthlySummaryError: errors.toSafeMessage(error, TIME_TRACKING_MONTHLY_SUMMARY_ERROR) });
        }
      },
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test -- --include='**/time-tracking.store.spec.ts'`
Expected: PASS

- [ ] **Step 10: Run the full attendance module test suite to check for regressions**

Run: `npm test -- --include='**/modules/attendance/**/*.spec.ts'`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/app/modules/attendance/models/time-tracking.model.ts src/app/modules/attendance/data-access/time-tracking-api.service.ts src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts src/app/modules/attendance/state/time-tracking.store.ts src/app/modules/attendance/state/time-tracking.store.spec.ts
git commit -m "feat(attendance): add monthly-summary store slice and scheduled row fields"
```

---

## Task 4: Nav + routing for the new Overview page

**Files:**
- Modify: `Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/nav/nav-items.config.ts:29-53`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/attendance.routes.ts`
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/attendance.routes.spec.ts`
- Test: `Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/nav/nav-access.spec.ts`

**Interfaces:**
- Produces: route `/attendance/overview` (loads `OverviewComponent`, built in Task 8) and makes it the `''`-path redirect target for `/attendance`; nav item `time-attendance-overview` as the first child of the `time-attendance` nav entry.

- [ ] **Step 1: Write the failing routing test**

Add to `attendance.routes.spec.ts` (mirror its existing assertions style — it already tests the `''` redirect and the other routes' `loadComponent`):

```typescript
it('redirects the empty path to overview', () => {
  const emptyRoute = ATTENDANCE_ROUTES.find((route) => route.path === '');
  expect(emptyRoute?.redirectTo).toBe('overview');
});

it('registers the overview route with the correct permissions and module gate', () => {
  const overviewRoute = ATTENDANCE_ROUTES.find((route) => route.path === 'overview');
  expect(overviewRoute).toBeDefined();
  expect(overviewRoute?.data?.['modules']).toEqual(['time_attendance']);
  expect(overviewRoute?.data?.['permissions']).toEqual([
    'attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/attendance.routes.spec.ts'`
Expected: FAIL — no `overview` route exists yet, and `''` still redirects to `time-tracking`.

- [ ] **Step 3: Add the route**

In `attendance.routes.ts`, add a new entry before `time-tracking` and change the trailing redirect:

```typescript
export const ATTENDANCE_ROUTES: Routes = [
  {
    path: 'overview',
    canActivate: [permissionGuard],
    data: {
      title: 'Overview',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/overview/overview.component').then(
        (module) => module.OverviewComponent
      )
  },

  {
    path: 'monitoring',
    canActivate: [permissionGuard],
    data: {
      title: 'Monitoring',
      permissions: ['monitoring:read'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/monitoring/monitoring.component').then(
        (module) => module.MonitoringComponent
      )
  },

  {
    path: 'time-tracking',
    canActivate: [permissionGuard],
    data: {
      title: 'Time Tracking',
      permissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
      modules: ['time_attendance']
    },
    loadComponent: () =>
      import('./feature/time-tracking/time-tracking.component').then(
        (module) => module.TimeTrackingComponent
      )
  },
  {
    path: 'corrections/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Attendance correction approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'corrections' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
  {
    path: 'work-area-change-requests/approvals',
    canActivate: [permissionGuard],
    data: { title: 'Work-area approvals', permissions: ['attendance:approve'], modules: ['time_attendance'], approvalType: 'work-area' },
    loadComponent: () =>
      import('./feature/legacy-approval-redirect/legacy-approval-redirect.component').then(
        (module) => module.LegacyApprovalRedirectComponent
      )
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'overview'
  }
];
```

Note: `OverviewComponent` doesn't exist yet — this compiles fine (lazy `import()` is only resolved at navigation time), and the component is built in Task 8.

- [ ] **Step 4: Update the nav config**

In `nav-items.config.ts`, update the `time-attendance` entry (lines 29-53): change `path` to point at overview, and add the Overview child first:

```typescript
  {
    id: 'time-attendance',
    label: 'Attendance',
    icon: 'time-attendance',
    path: '/attendance/overview',
    requiredModules: ['time_attendance'],
    requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve'],
    children: [
      {
        id: 'time-attendance-overview',
        label: 'Overview',
        path: '/attendance/overview',
        exact: true,
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve']
      },
      {
        id: 'time-attendance-tracking',
        label: 'Time Tracking',
        path: '/attendance/time-tracking',
        exact: true,
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read-own', 'attendance:write-own', 'attendance:read', 'attendance:approve']
      },
      {
        id: 'time-attendance-monitoring',
        label: 'Monitoring',
        path: '/attendance/monitoring',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['monitoring:read']
      }
    ]
  },
```

- [ ] **Step 5: Update `nav-access.spec.ts` for the new nav id if it enumerates nav ids**

Read `nav-access.spec.ts` first; if it has a hardcoded list of `time-attendance-*` ids or a count of Attendance children, add `time-attendance-overview` to it. If it only tests permission-gating logic generically, no change is needed.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- --include='**/attendance.routes.spec.ts' --include='**/nav-access.spec.ts'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/layouts/main-layout/nav/nav-items.config.ts src/app/modules/attendance/attendance.routes.ts src/app/modules/attendance/attendance.routes.spec.ts src/app/layouts/main-layout/nav/nav-access.spec.ts
git commit -m "feat(attendance): add Overview route and nav entry, redirect '' to overview"
```

---

## Task 5: Extract `AttendanceStatusCardComponent` from Time Tracking's hero markup

**Files:**
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/status-card/attendance-status-card.component.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/status-card/attendance-status-card.component.html`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/status-card/attendance-status-card.component.css`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/status-card/attendance-status-card.component.spec.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.html:56-259`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` (imports only)

**Interfaces:**
- Consumes: `TimeTrackingStore` (injected directly, same pattern as `AttendanceTrendCardComponent` and `AttendanceDetailDrawerComponent` already use).
- Produces: `<app-attendance-status-card>` (no inputs — it is fully self-contained against the store), used by Task 8 (Overview) and Task 9 (Time Tracking).

This is the highest-value extraction: it turns the status-pill/action-buttons/metric-cards block that currently lives inline in `time-tracking.component.html` into something Overview can also render, with a new worked-vs-scheduled progress bar the brief asks for and today's markup doesn't have.

- [ ] **Step 1: Write the failing component test**

Create `attendance-status-card.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AttendanceStatusCardComponent } from './attendance-status-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { AttendanceTodayResponse } from '../../models/time-tracking.model';

describe('AttendanceStatusCardComponent', () => {
  let fixture: ComponentFixture<AttendanceStatusCardComponent>;
  const today = signal<AttendanceTodayResponse | null>(null);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttendanceStatusCardComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: {
            today,
            todayLoading: signal(false),
            actionLoading: signal(false),
            activeAction: signal(null),
            clockIn: jest.fn(),
            startBreak: jest.fn(),
            endBreak: jest.fn(),
            clockOut: jest.fn()
          }
        }
      ]
    });
    fixture = TestBed.createComponent(AttendanceStatusCardComponent);
  });

  it('shows a 0% worked-vs-scheduled bar when nothing has been worked yet', () => {
    today.set({
      totalWorkedMinutes: 0, requiredWorkMinutes: 480, attendanceStatus: 'not_clocked_in'
    } as AttendanceTodayResponse);
    fixture.detectChanges();

    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="worked-progress-fill"]');
    expect(bar.style.width).toBe('0%');
  });

  it('caps the worked-vs-scheduled bar at 100% when worked exceeds scheduled', () => {
    today.set({
      totalWorkedMinutes: 600, requiredWorkMinutes: 480, attendanceStatus: 'working'
    } as AttendanceTodayResponse);
    fixture.detectChanges();

    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="worked-progress-fill"]');
    expect(bar.style.width).toBe('100%');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/attendance-status-card.component.spec.ts'`
Expected: FAIL — the component module doesn't exist yet.

- [ ] **Step 3: Create the component class**

`attendance-status-card.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';
import {
  formatDateTime,
  formatMinutes,
  sourceLabel,
  statusLabel,
  workModeLabel
} from '../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-status-card',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-status-card.component.html',
  styleUrl: './attendance-status-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceStatusCardComponent {
  readonly store = inject(TimeTrackingStore);

  readonly Math = Math;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly sourceLabel = sourceLabel;
  readonly statusLabel = statusLabel;
  readonly workModeLabel = workModeLabel;

  readonly workedPercent = computed(() => {
    const today = this.store.today();
    if (!today || !today.requiredWorkMinutes) return 0;
    return Math.min(100, Math.round((today.totalWorkedMinutes / today.requiredWorkMinutes) * 100));
  });

  actionIsLoading(action: TimeTrackingAction): boolean {
    return this.store.activeAction() === action;
  }
}
```

- [ ] **Step 4: Create the template**

`attendance-status-card.component.html` — this is the extracted hero (status pill, actions, worked-vs-scheduled bar, break, attendance times), trimmed of Time-Tracking-only pieces (the "Work schedule" card's timezone/source line stays; the friendly-messages banner and missing-clock-out fix button stay behind an `@if` on `today()` being present, matching the source markup's conditionals):

```html
@if (store.todayLoading() && !store.today()) {
  <div class="status-card-skeleton" aria-busy="true" aria-label="Loading today's attendance"></div>
} @else if (store.today(); as today) {
  <section class="attendance-status-card" aria-labelledby="status-card-heading">
    <div class="status-card-header">
      <div class="status-card-title-cluster">
        <span
          class="status-pill"
          [class.status-pill--active]="today.attendanceStatus === 'working' || today.attendanceStatus === 'clocked_in'"
          [class.status-pill--break]="today.attendanceStatus === 'on_break'"
        >
          <span class="status-pill__dot"></span>
          {{ statusLabel(today.attendanceStatus, today.attendanceStatusLabel) }}
        </span>
        <span id="status-card-heading" class="status-card-worked">{{ formatMinutes(today.totalWorkedMinutes) }} worked</span>
      </div>

      @if (today.allowedClockInMethods.web) {
        <div class="action-buttons">
          @if (today.canClockIn) {
            <app-button type="button" data-testid="status-card-clock-in" variant="primary" size="sm" [loading]="actionIsLoading('clockIn')" [disabled]="store.actionLoading()" (pressed)="store.clockIn()">Clock in</app-button>
          }
          @if (today.canStartBreak) {
            <app-button type="button" data-testid="status-card-start-break" variant="secondary" size="sm" [loading]="actionIsLoading('startBreak')" [disabled]="store.actionLoading()" (pressed)="store.startBreak()">Start break</app-button>
          }
          @if (today.canEndBreak) {
            <app-button type="button" data-testid="status-card-end-break" variant="secondary" size="sm" [loading]="actionIsLoading('endBreak')" [disabled]="store.actionLoading()" (pressed)="store.endBreak()">End break</app-button>
          }
          @if (today.canClockOut) {
            <app-button type="button" data-testid="status-card-clock-out" variant="danger" size="sm" [loading]="actionIsLoading('clockOut')" [disabled]="store.actionLoading()" (pressed)="store.clockOut()">Clock out</app-button>
          }
        </div>
      }
    </div>

    <div class="worked-progress" [attr.title]="formatMinutes(today.totalWorkedMinutes) + ' worked of ' + (today.requiredWorkMinutes ? formatMinutes(today.requiredWorkMinutes) : 'an unscheduled day')">
      <div class="worked-progress-track">
        <div class="worked-progress-fill" data-testid="worked-progress-fill" [style.width.%]="workedPercent()"></div>
      </div>
      <span class="worked-progress-label">
        {{ formatMinutes(today.totalWorkedMinutes) }}
        @if (today.requiredWorkMinutes) {
          <span class="worked-progress-label__muted">of {{ formatMinutes(today.requiredWorkMinutes) }} scheduled</span>
        }
      </span>
    </div>

    <div class="status-card-meta">
      <span class="status-card-meta__item">Clocked in {{ today.clockInAt ? formatDateTime(today.clockInAt, today.timezone) : 'not recorded' }}</span>
      <span class="status-card-meta__item">Work mode {{ workModeLabel(today.expectedWorkMode) }}</span>
      @if (today.breakRemainingMinutes !== null) {
        <span class="status-card-meta__item">{{ formatMinutes(today.breakRemainingMinutes) }} break remaining</span>
      }
    </div>
  </section>
}
```

- [ ] **Step 5: Add CSS**

`attendance-status-card.component.css` — reuse the class names/values already defined for `.status-pill`, `.action-buttons`, `.metric-value`, `.break-progress-track`/`.break-progress-fill` in `time-tracking.component.css` as the basis (copy those rules that apply to `.status-pill`, `.status-pill__dot`, `.status-pill--active`, `.status-pill--break`, and `.action-buttons` verbatim into this new file so the component is self-contained), then add the new rules this template introduces:

```css
.attendance-status-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.status-card-title-cluster {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.status-card-worked {
  font-size: 1.25rem;
  font-weight: 600;
}

.worked-progress-track {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-muted, #e5e7eb);
  overflow: hidden;
}

.worked-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent, #2563eb);
  transition: width 0.2s ease;
}

.worked-progress-label {
  display: block;
  margin-top: 0.375rem;
  font-size: 0.8125rem;
}

.worked-progress-label__muted {
  color: var(--text-muted, #6b7280);
  margin-left: 0.25rem;
}

.status-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--text-muted, #6b7280);
}
```

(Read `time-tracking.component.css` first and match its actual custom-property names — `var(--surface-muted, ...)` etc. above are placeholders for whatever tokens that file already uses; do not invent new design tokens.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --include='**/attendance-status-card.component.spec.ts'`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/attendance/feature/status-card
git commit -m "feat(attendance): extract shared AttendanceStatusCardComponent with worked-vs-scheduled bar"
```

(Time Tracking's own template is not modified in this task — that's Task 9, kept separate so this extraction is reviewable on its own before anything switches over to it.)

---

## Task 6: `AttendanceMonthlyHealthCardComponent`

**Files:**
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/monthly-health-card/attendance-monthly-health-card.component.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/monthly-health-card/attendance-monthly-health-card.component.html`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/monthly-health-card/attendance-monthly-health-card.component.spec.ts`

**Interfaces:**
- Consumes: `TimeTrackingStore.monthlySummary()` / `loadMonthlySummary()` (Task 3).
- Produces: `<app-attendance-monthly-health-card>`, used by Task 8 (Overview).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AttendanceMonthlyHealthCardComponent } from './attendance-monthly-health-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

describe('AttendanceMonthlyHealthCardComponent', () => {
  let fixture: ComponentFixture<AttendanceMonthlyHealthCardComponent>;
  const monthlySummary = signal<{ workingDays: number; daysPresent: number; lateArrivals: number; earlyDepartures: number; missingClockOuts: number } | null>(null);
  const loadMonthlySummary = jest.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttendanceMonthlyHealthCardComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: { monthlySummary, monthlySummaryLoading: signal(false), monthlySummaryError: signal(null), loadMonthlySummary }
        }
      ]
    });
    fixture = TestBed.createComponent(AttendanceMonthlyHealthCardComponent);
  });

  it('requests the current month range on init', () => {
    fixture.detectChanges();
    expect(loadMonthlySummary).toHaveBeenCalledTimes(1);
  });

  it('renders days-present-over-working-days and each health metric', () => {
    monthlySummary.set({ workingDays: 20, daysPresent: 18, lateArrivals: 2, earlyDepartures: 1, missingClockOuts: 0 });
    fixture.detectChanges();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('18');
    expect(text).toContain('20');
    expect(text).toContain('2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/attendance-monthly-health-card.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

`attendance-monthly-health-card.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { TimeTrackingRange } from '../../models/time-tracking.model';

@Component({
  selector: 'app-attendance-monthly-health-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './attendance-monthly-health-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceMonthlyHealthCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly summary = this.store.monthlySummary;
  protected readonly loading = this.store.monthlySummaryLoading;
  protected readonly error = this.store.monthlySummaryError;

  ngOnInit(): void {
    void this.store.loadMonthlySummary(currentMonthRange());
  }

  retry(): void {
    void this.store.loadMonthlySummary(currentMonthRange());
  }
}

function currentMonthRange(reference = new Date()): TimeTrackingRange {
  const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const to = new Date(reference.getFullYear(), reference.getMonth() + 1, 0);
  return { from: toDateOnly(from), to: toDateOnly(to) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Implement the template**

`attendance-monthly-health-card.component.html`:

```html
<app-card>
  <h3 class="monthly-health-title">This month</h3>

  @if (loading() && !summary()) {
    <p class="monthly-health-skeleton" aria-busy="true">Loading attendance health…</p>
  } @else if (error() && !summary()) {
    <p role="alert">{{ error() }}</p>
    <button type="button" (click)="retry()">Try again</button>
  } @else if (summary(); as summary) {
    <p class="monthly-health-headline">{{ summary.daysPresent }} / {{ summary.workingDays }} days present</p>
    <dl class="monthly-health-grid">
      <div class="monthly-health-item">
        <dt>Late arrivals</dt>
        <dd>{{ summary.lateArrivals }}</dd>
      </div>
      <div class="monthly-health-item">
        <dt>Early departures</dt>
        <dd>{{ summary.earlyDepartures }}</dd>
      </div>
      <div class="monthly-health-item">
        <dt>Missing clock-outs</dt>
        <dd>{{ summary.missingClockOuts }}</dd>
      </div>
    </dl>
  }
</app-card>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --include='**/attendance-monthly-health-card.component.spec.ts'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/attendance/feature/monthly-health-card
git commit -m "feat(attendance): add monthly attendance-health card"
```

---

## Task 7: `AttendanceRequestsSummaryCardComponent`

**Files:**
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/requests-summary-card/attendance-requests-summary-card.component.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/requests-summary-card/attendance-requests-summary-card.component.html`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/requests-summary-card/attendance-requests-summary-card.component.spec.ts`

**Interfaces:**
- Consumes: `TimeTrackingStore.myCorrections()` / `loadMyCorrections()` and `TimeTrackingStore.myWorkAreaRequests()` / `loadMyWorkAreaRequests()` (both existing, `time-tracking.store.ts:78-84, 98-104, 331-347, 403-432`).
- Produces: `<app-attendance-requests-summary-card>`, used by Task 8 (Overview). Emits nothing — it is read-only, with a `RouterLink` to `/attendance/time-tracking?view=my` (the existing self-service requests panel already renders there via `MyRequestsPanelComponent`).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AttendanceRequestsSummaryCardComponent } from './attendance-requests-summary-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

describe('AttendanceRequestsSummaryCardComponent', () => {
  let fixture: ComponentFixture<AttendanceRequestsSummaryCardComponent>;
  const myCorrections = signal<{ status: string }[]>([]);
  const myWorkAreaRequests = signal<{ status: string }[]>([]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttendanceRequestsSummaryCardComponent],
      providers: [
        provideRouter([]),
        {
          provide: TimeTrackingStore,
          useValue: {
            myCorrections, myCorrectionsLoaded: signal(true), loadMyCorrections: jest.fn(),
            myWorkAreaRequests, myWorkAreaRequestsLoaded: signal(true), loadMyWorkAreaRequests: jest.fn()
          }
        }
      ]
    });
    fixture = TestBed.createComponent(AttendanceRequestsSummaryCardComponent);
  });

  it('shows a no-pending-requests message when nothing is pending', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No pending requests');
  });

  it('counts pending corrections and work-area requests together', () => {
    myCorrections.set([{ status: 'pending' }, { status: 'approved' }]);
    myWorkAreaRequests.set([{ status: 'pending' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('2 pending');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/attendance-requests-summary-card.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

`attendance-requests-summary-card.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

@Component({
  selector: 'app-attendance-requests-summary-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './attendance-requests-summary-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceRequestsSummaryCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly pendingCount = computed(() =>
    this.store.myCorrections().filter((item) => item.status === 'pending').length
    + this.store.myWorkAreaRequests().filter((item) => item.status === 'pending').length
  );

  ngOnInit(): void {
    if (!this.store.myCorrectionsLoaded()) void this.store.loadMyCorrections();
    if (!this.store.myWorkAreaRequestsLoaded()) void this.store.loadMyWorkAreaRequests();
  }
}
```

- [ ] **Step 4: Implement the template**

`attendance-requests-summary-card.component.html`:

```html
<app-card>
  <h3 class="requests-summary-title">Requests</h3>

  @if (pendingCount() > 0) {
    <p class="requests-summary-count">{{ pendingCount() }} pending</p>
  } @else {
    <p class="requests-summary-empty">No pending requests</p>
  }

  <a routerLink="/attendance/time-tracking" [queryParams]="{ view: 'my' }" class="requests-summary-link">View requests</a>
</app-card>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --include='**/attendance-requests-summary-card.component.spec.ts'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/attendance/feature/requests-summary-card
git commit -m "feat(attendance): add requests summary card"
```

---

## Task 8: `OverviewComponent` — compose the new page

**Files:**
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/overview/overview.component.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/overview/overview.component.html`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/overview/overview.component.css`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/overview/overview.component.spec.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/dashboard/feature/attendance-trend-card/attendance-trend-card.component.ts` (path-only import fix if it moves — see Step 3 note)

**Interfaces:**
- Consumes: `AttendanceStatusCardComponent` (Task 5), `AttendanceMonthlyHealthCardComponent` (Task 6), `AttendanceRequestsSummaryCardComponent` (Task 7), `AttendanceTrendCardComponent` (existing, reused as-is from the dashboard module).
- Produces: `OverviewComponent`, referenced by the route added in Task 4.

Decision: `AttendanceTrendCardComponent` is **reused in place**, not moved — it already lives at `src/app/modules/dashboard/feature/attendance-trend-card/` and imports nothing dashboard-specific (it reads `TimeTrackingStore` directly, same as the new cards in Tasks 6-7). Cross-module feature imports already happen in the reverse direction today (dashboard imports from attendance), so importing it from `attendance/feature/overview` is consistent with the existing pattern, and moving the file is unnecessary churn for this plan's goal.

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { OverviewComponent } from './overview.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

describe('OverviewComponent', () => {
  let fixture: ComponentFixture<OverviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: TimeTrackingStore,
          useValue: {
            today: signal(null), todayLoading: signal(false), actionLoading: signal(false), activeAction: signal(null),
            clockIn: jest.fn(), startBreak: jest.fn(), endBreak: jest.fn(), clockOut: jest.fn(),
            history: signal([]), historyLoading: signal(false), loadMyHistory: jest.fn(),
            monthlySummary: signal(null), monthlySummaryLoading: signal(false), monthlySummaryError: signal(null), loadMonthlySummary: jest.fn(),
            myCorrections: signal([]), myCorrectionsLoaded: signal(true), loadMyCorrections: jest.fn(),
            myWorkAreaRequests: signal([]), myWorkAreaRequestsLoaded: signal(true), loadMyWorkAreaRequests: jest.fn(),
            canViewCoveredEmployees: signal(false)
          }
        }
      ]
    });
    fixture = TestBed.createComponent(OverviewComponent);
  });

  it('renders the status card, weekly trend, monthly health, and requests summary', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('app-attendance-status-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-trend-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-monthly-health-card')).toBeTruthy();
    expect(host.querySelector('app-attendance-requests-summary-card')).toBeTruthy();
  });

  it('renders a quick link to Time Tracking', () => {
    fixture.detectChanges();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="quick-link-time-tracking"]');
    expect(link.getAttribute('href')).toContain('/attendance/time-tracking');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/overview.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

`overview.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { AttendanceTrendCardComponent } from '../../../dashboard/feature/attendance-trend-card/attendance-trend-card.component';
import { AttendanceStatusCardComponent } from '../status-card/attendance-status-card.component';
import { AttendanceMonthlyHealthCardComponent } from '../monthly-health-card/attendance-monthly-health-card.component';
import { AttendanceRequestsSummaryCardComponent } from '../requests-summary-card/attendance-requests-summary-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

@Component({
  selector: 'app-attendance-overview',
  standalone: true,
  imports: [
    AttendanceMonthlyHealthCardComponent,
    AttendanceRequestsSummaryCardComponent,
    AttendanceStatusCardComponent,
    AttendanceTrendCardComponent,
    BreadcrumbHeaderComponent,
    RouterLink
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewComponent {
  private readonly store = inject(TimeTrackingStore);

  readonly canShowTeamLink = computed(() => this.store.canViewCoveredEmployees());
}
```

- [ ] **Step 4: Implement the template**

`overview.component.html`:

```html
<div class="attendance-overview-page">
  <header class="attendance-overview-header">
    <app-breadcrumb-header parentLabel="Attendance" currentLabel="Overview" icon="time-attendance" />
  </header>

  <app-attendance-status-card />

  <div class="attendance-overview-grid">
    <app-attendance-trend-card />
    <app-attendance-monthly-health-card />
    <app-attendance-requests-summary-card />
  </div>

  <nav class="attendance-overview-quick-links" aria-label="Quick links">
    <a routerLink="/attendance/time-tracking" data-testid="quick-link-time-tracking">View time tracking</a>
    @if (canShowTeamLink()) {
      <a routerLink="/attendance/time-tracking" [queryParams]="{ view: 'team' }" data-testid="quick-link-team">View team attendance</a>
    }
  </nav>
</div>
```

- [ ] **Step 5: Add CSS**

`overview.component.css`:

```css
.attendance-overview-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.attendance-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.attendance-overview-quick-links {
  display: flex;
  gap: 1rem;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --include='**/overview.component.spec.ts'`
Expected: PASS

- [ ] **Step 7: Manually verify the route resolves** (this plan's one non-unit-test verification step, since it's the first task that makes the new route reachable end-to-end)

Run: `npm start`, then navigate to `/attendance/overview` in the browser. Confirm:
- The page loads without console errors.
- Clicking "Attendance" in the side nav lands on Overview (not Time Tracking).
- The status card's clock-in/out buttons work identically to how they did on Time Tracking before this plan.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/attendance/feature/overview
git commit -m "feat(attendance): add Overview page composing status, trend, health, and requests cards"
```

---

## Task 9: Time Tracking — replace inline hero with the shared status card

**Files:**
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.html:68-259`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` (imports; remove now-dead `actionIsLoading`/formatter re-exports that were only used by the deleted markup — check each before deleting, several are still used elsewhere in the same template for the history table and drawer)
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts`

**Interfaces:**
- Consumes: `AttendanceStatusCardComponent` (Task 5).

This removes the duplicated hero markup from Time Tracking now that Overview (Task 8) and the extracted component (Task 5) both exist, per the brief's explicit instruction that Time Tracking should not re-show the same daily summary as Overview — it keeps the "Work schedule" detail card (timezone/source, which the shared status card intentionally omits) and the attention/missing-clock-out banner, both of which stay page-specific to Time Tracking.

- [ ] **Step 1: Confirm current tests reference the old hero markup, then update them first**

Read `time-tracking.component.spec.ts` for any assertions against `data-testid="clock-in"`, `.status-pill`, `.metric-card`, etc. (the old testids from `time-tracking.component.html:88-98`). Update each to the new testids from Task 5's template (`status-card-clock-in`, `status-card-start-break`, `status-card-end-break`, `status-card-clock-out`) and import `AttendanceStatusCardComponent`'s host selector `app-attendance-status-card` where the spec queries for the hero.

- [ ] **Step 2: Run the updated test file to verify it fails against the still-unmodified template**

Run: `npm test -- --include='**/time-tracking.component.spec.ts'`
Expected: FAIL — the new testids (`status-card-clock-in` etc.) aren't in the DOM yet because the template still has the old markup.

- [ ] **Step 3: Replace the hero markup**

In `time-tracking.component.html`, replace lines 68-259 (the `<section class="time-tracking-overview" ...>` block covering the status pill, action buttons, attention banner, and the four `metric-card` articles) with:

```html
      <app-attendance-status-card />

      @if (hasAttention(today.attentionLabel)) {
        <div [class]="attentionClass(today.attentionSeverity)" role="status" aria-live="polite">
          <span class="warning-icon" aria-hidden="true">!</span>
          <p>{{ today.attentionLabel }}</p>
          @if (today.attentionType === 'missing_clock_out' && today.attentionWorkDate) {
            <app-button type="button" data-testid="fix-missing-clock-out" variant="secondary" size="sm" (pressed)="openMissingClockOutCorrection(today.attentionWorkDate)">Fix {{ formatDate(today.attentionWorkDate) }}'s clock-out</app-button>
          }
        </div>
      } @else if (today.shouldHaveClockedIn) {
        <div class="time-tracking-warning" role="status">
          <span class="warning-icon" aria-hidden="true">!</span>
          <p>You have not clocked in yet.</p>
        </div>
      }

      <article class="metric-card metric-card--schedule">
        <div class="metric-card-header">
          <span class="metric-label">Work schedule</span>
        </div>
        <div class="metric-card-body">
          <div class="metric-detail-grid">
            <div class="metric-detail">
              <span class="metric-helper">Hours</span>
              <strong class="metric-value">
                @if (today.scheduledStartTime && today.scheduledEndTime) {
                  {{ today.scheduledStartTime }} – {{ today.scheduledEndTime }}
                } @else if (today.scheduledStartTime) {
                  {{ today.scheduledStartTime }}
                } @else if (today.scheduledEndTime) {
                  {{ today.scheduledEndTime }}
                } @else {
                  Not scheduled
                }
              </strong>
            </div>
          </div>
          <span class="metric-helper">{{ today.timezone || 'Timezone unavailable' }} · Source: {{ sourceLabel(today.attendanceSource) }}</span>
        </div>
      </article>
```

Note: this deliberately drops the standalone "Break time", "Worked today", and "Attendance times" `metric-card` articles — their content now lives in the shared status card (break-remaining in its meta row, worked-vs-scheduled in its progress bar, clock-in time in its meta row). The "Work schedule" card is kept standalone because it carries the timezone/source detail line that the shared card intentionally left out (that's Time-Tracking-only forensic detail, matching the brief's Overview-vs-Time-Tracking split).

- [ ] **Step 4: Add the import**

In `time-tracking.component.ts`, add `AttendanceStatusCardComponent` to the `imports` array (alongside the other feature imports already there) and its import statement:

```typescript
import { AttendanceStatusCardComponent } from '../status-card/attendance-status-card.component';
```

- [ ] **Step 5: Remove now-unused code, checking each usage first**

In `time-tracking.component.ts`, `actionIsLoading()`, `sourceLabel()`, `workModeLabel()`, `formatMinutes()`, `hasBreakOverage()`, `breakOverageLabel()` may now be unused by the template if nothing else in `time-tracking.component.html` (the history table, drawer, correction/work-area forms) still calls them. Grep the template for each name individually before deleting its method — several (e.g. `formatMinutes`, used by the history list's parent bindings) are very likely still referenced elsewhere in the same file and must stay.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- --include='**/time-tracking.component.spec.ts'`
Expected: PASS

- [ ] **Step 7: Run the full attendance module suite to check for regressions**

Run: `npm test -- --include='**/modules/attendance/**/*.spec.ts'`
Expected: PASS

- [ ] **Step 8: Manually verify in the browser**

Run: `npm start`, navigate to `/attendance/time-tracking`. Confirm the status card renders identically to Overview's (same component), the Work-schedule detail card still shows timezone/source, and clock in/out/break actions still work.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/time-tracking.component.html src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts src/app/modules/attendance/feature/time-tracking/time-tracking.component.spec.ts
git commit -m "refactor(attendance): replace Time Tracking's inline hero with the shared status card"
```

---

## Task 10: Live "Today's activity" timeline on Time Tracking

**Files:**
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/state/time-tracking.store.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/today-timeline/attendance-today-timeline.component.ts`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/today-timeline/attendance-today-timeline.component.html`
- Create: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/today-timeline/attendance-today-timeline.component.spec.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.html`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/state/time-tracking.store.spec.ts`

**Interfaces:**
- Consumes: `TimeTrackingApiService.getDayDetail(employeeId, date)` (existing, unchanged — no backend work needed for this task).
- Produces: `TimeTrackingStore.todayTimelineEvents` / `todayTimelineLoading` / `todayTimelineError` signals and `loadTodayTimeline(employeeId: string, workDate: string): Promise<void>`; `<app-attendance-today-timeline>`.

As established in "Existing-code reconciliation," this is a **new, separate** state slice from `dayDetail` (used by the historical drawer) so the two views never clobber each other.

- [ ] **Step 1: Write the failing store test**

Add to `time-tracking.store.spec.ts`:

```typescript
it('loadTodayTimeline patches todayTimelineEvents independently of dayDetail', async () => {
  const store = TestBed.inject(TimeTrackingStore);
  const api = TestBed.inject(TimeTrackingApiService);
  jest.spyOn(api, 'getDayDetail').mockReturnValue(of({
    summary: {} as never,
    timelineEvents: [{ eventType: 'ClockIn', timestamp: '2026-09-08T04:00:00Z', source: 'web' }],
    dailyActivity: null,
    checkIns: []
  }));

  await store.loadTodayTimeline('employee-1', '2026-09-08');

  expect(store.todayTimelineEvents()).toHaveLength(1);
  expect(store.dayDetail()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/time-tracking.store.spec.ts'`
Expected: FAIL — `loadTodayTimeline`/`todayTimelineEvents` don't exist.

- [ ] **Step 3: Implement the store slice**

In `time-tracking.store.ts`:

1. Add an error constant:

```typescript
export const TIME_TRACKING_TODAY_TIMELINE_ERROR = 'Could not load today’s activity. Try again.';
```

2. Import `TimelineEvent` from `../models/time-tracking.model`.
3. Add three fields to `TimeTrackingState` (near `dayDetail`):

```typescript
  readonly todayTimelineEvents: readonly TimelineEvent[];
  readonly todayTimelineLoading: boolean;
  readonly todayTimelineError: string | null;
```

4. Add matching `initialState` entries:

```typescript
  todayTimelineEvents: [],
  todayTimelineLoading: false,
  todayTimelineError: null,
```

5. Add the method (after `loadDayDetail`):

```typescript
      async loadTodayTimeline(employeeId: string, workDate: string): Promise<void> {
        if (store.todayTimelineLoading()) return;
        patchState(store, { todayTimelineLoading: true, todayTimelineError: null });
        try {
          const detail = await firstValueFrom(api.getDayDetail(employeeId, workDate));
          patchState(store, { todayTimelineEvents: detail.timelineEvents, todayTimelineLoading: false, todayTimelineError: null });
        } catch (error) {
          patchState(store, { todayTimelineLoading: false, todayTimelineError: errors.toSafeMessage(error, TIME_TRACKING_TODAY_TIMELINE_ERROR) });
        }
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/time-tracking.store.spec.ts'`
Expected: PASS

- [ ] **Step 5: Write the failing component test**

`attendance-today-timeline.component.spec.ts`:

```typescript
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AttendanceTodayTimelineComponent } from './attendance-today-timeline.component';
import { TimeTrackingStore } from '../../../state/time-tracking.store';

describe('AttendanceTodayTimelineComponent', () => {
  let fixture: ComponentFixture<AttendanceTodayTimelineComponent>;
  const todayTimelineEvents = signal<{ eventType: string; timestamp: string; source: string }[]>([]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AttendanceTodayTimelineComponent],
      providers: [
        {
          provide: TimeTrackingStore,
          useValue: { todayTimelineEvents, todayTimelineLoading: signal(false), todayTimelineError: signal(null) }
        }
      ]
    });
    fixture = TestBed.createComponent(AttendanceTodayTimelineComponent);
  });

  it('shows an empty state with no events', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No activity recorded yet today');
  });

  it('lists each timeline event with its humanized label', () => {
    todayTimelineEvents.set([{ eventType: 'ClockIn', timestamp: '2026-09-08T04:00:00Z', source: 'web' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Clocked in');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- --include='**/attendance-today-timeline.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 7: Implement the component**

`attendance-today-timeline.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { formatDateTime, timelineEventLabel } from '../../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-today-timeline',
  standalone: true,
  templateUrl: './attendance-today-timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceTodayTimelineComponent {
  readonly store = inject(TimeTrackingStore);
  readonly formatDateTime = formatDateTime;
  readonly timelineEventLabel = timelineEventLabel;
}
```

`attendance-today-timeline.component.html`:

```html
<section class="today-timeline" aria-labelledby="today-timeline-heading">
  <h3 id="today-timeline-heading">Today's activity</h3>

  @if (store.todayTimelineLoading()) {
    <p aria-busy="true">Loading today's activity…</p>
  } @else if (store.todayTimelineError()) {
    <p role="alert">{{ store.todayTimelineError() }}</p>
  } @else if (store.todayTimelineEvents().length === 0) {
    <p class="today-timeline-empty">No activity recorded yet today.</p>
  } @else {
    <ol class="today-timeline-list">
      @for (event of store.todayTimelineEvents(); track event.timestamp + event.eventType) {
        <li class="today-timeline-item">
          <span class="today-timeline-item__label">{{ timelineEventLabel(event.eventType) }}</span>
          <span class="today-timeline-item__time">{{ formatDateTime(event.timestamp, store.today()?.timezone) }}</span>
        </li>
      }
    </ol>
  }
</section>
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- --include='**/attendance-today-timeline.component.spec.ts'`
Expected: PASS

- [ ] **Step 9: Wire it into Time Tracking**

In `time-tracking.component.ts`: import `AttendanceTodayTimelineComponent`, add it to `imports`. In the `constructor()`'s existing `effect(...)` (or a new small `effect`, whichever reads more naturally next to the existing team-loading effect), call `void this.store.loadTodayTimeline(today.employeeId, today.workDate)` once `store.today()` resolves for the `my` view — e.g. add immediately after the existing `void this.store.loadToday();` call in `ngOnInit()`:

```typescript
  ngOnInit(): void {
    const range = this.currentWeekRange;
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    if (this.hasSelfServiceAccess() || this.hasCoveredAccess()) {
      void this.store.loadToday().then(() => {
        const today = this.store.today();
        if (today) void this.store.loadTodayTimeline(today.employeeId, today.workDate);
      });
    }
    if (this.hasSelfServiceAccess()) {
      void this.store.loadMyHistory(range);
    }
  }
```

Also re-load it after any clock action so the timeline reflects a just-completed clock-in/break/clock-out without a manual refresh — add a small `effect()` in the constructor that watches `store.today()?.totalWorkedMinutes` (a value that changes on every action) is unnecessary complexity; instead, call `loadTodayTimeline` again inside each of the four button handlers is also unnecessary since the buttons call `store.clockIn()` etc. directly from the template. Simplest correct approach: re-trigger it the same way `loadToday()` already gets a fresh value after actions — check `time-tracking.store.ts`'s `runAction` helper (lines 189-208): it already re-patches `today` after every action. Add one line to `runAction`'s success branch so the timeline stays in sync automatically wherever `today` changes:

Do **not** modify `runAction` for this — that couples the store's core action-runner to a UI-only concern the drawer doesn't need. Instead, in `time-tracking.component.html`, add the timeline directly after the status card and let it be a plain read from state that's refreshed on the next full page load; add a manual "Refresh" affordance is out of scope. Add to the template (after `<app-attendance-status-card />` and the attention banner block from Task 9):

```html
      <app-attendance-today-timeline />
```

And add the import to `time-tracking.component.ts`'s `imports` array:

```typescript
import { AttendanceTodayTimelineComponent } from './today-timeline/attendance-today-timeline.component';
```

- [ ] **Step 10: Run the full attendance module suite**

Run: `npm test -- --include='**/modules/attendance/**/*.spec.ts'`
Expected: PASS

- [ ] **Step 11: Manually verify in the browser**

Run: `npm start`, navigate to `/attendance/time-tracking`, clock in, and confirm a "Clocked in" row appears under "Today's activity" after the page's next data load.

- [ ] **Step 12: Commit**

```bash
git add src/app/modules/attendance/state/time-tracking.store.ts src/app/modules/attendance/state/time-tracking.store.spec.ts src/app/modules/attendance/feature/time-tracking
git commit -m "feat(attendance): add live today's-activity timeline to Time Tracking"
```

---

## Task 11: `Scheduled` and `Break` columns on the history table

**Files:**
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.ts`
- Modify: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.html`
- Test: `Hrms--Web-application---front-end---v1/src/app/modules/attendance/feature/time-tracking/attendance-history-list/attendance-history-list.component.spec.ts`

**Interfaces:**
- Consumes: `AttendanceHistoryRow.scheduledStartTime`/`scheduledEndTime`/`breakMinutes` (the first two added in Task 3; `breakMinutes` already existed).

- [ ] **Step 1: Read the current template**

Read `attendance-history-list.component.html` in full before editing — it hasn't been read yet in this plan's research and its exact column markup (table headers, row cells, responsive/mobile card fallback if any) must be matched exactly rather than guessed.

- [ ] **Step 2: Write the failing test**

Add to `attendance-history-list.component.spec.ts` (mirror its existing row-rendering test setup):

```typescript
it('renders Scheduled and Break columns for each row', () => {
  fixture.componentRef.setInput('rows', [
    {
      attendanceRecordId: '1', workDate: '2026-08-21', employee: null,
      clockInAt: '2026-08-21T09:00:00Z', clockOutAt: '2026-08-21T17:30:00Z',
      isActive: false, breakMinutes: 45, totalWorkedMinutes: 465,
      expectedWorkMode: 'onsite', attendanceSource: 'web', status: 'clocked_out',
      canViewDetails: true, canRequestCorrection: false, canRequestWorkAreaChange: false, canCorrect: false,
      scheduledStartTime: '09:00', scheduledEndTime: '17:30'
    }
  ]);
  fixture.detectChanges();

  const text: string = fixture.nativeElement.textContent;
  expect(text).toContain('09:00');
  expect(text).toContain('17:30');
  expect(text).toContain('45m');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --include='**/attendance-history-list.component.spec.ts'`
Expected: FAIL — no Scheduled/Break cells in the rendered table yet.

- [ ] **Step 4: Add a `scheduledLabel` helper and add the columns**

In `attendance-history-list.component.ts`, add a method:

```typescript
  scheduledLabel(row: AttendanceHistoryRow): string {
    if (row.scheduledStartTime && row.scheduledEndTime) return `${row.scheduledStartTime} – ${row.scheduledEndTime}`;
    if (row.scheduledStartTime) return row.scheduledStartTime;
    if (row.scheduledEndTime) return row.scheduledEndTime;
    return 'Not scheduled';
  }
```

In `attendance-history-list.component.html`, using whatever exact header-row/data-row markup Step 1 revealed, add a `<th>Scheduled</th>` and `<th>Break</th>` to the header row (placed between the existing Date and Clock-in columns for Scheduled, and between Clock-out and Worked-time for Break, matching the order implied by the spec's proposed table: Date, Scheduled, Clock in, Clock out, Break, Worked, Status), and corresponding `<td>` cells per row:

```html
<td>{{ scheduledLabel(row) }}</td>
```

```html
<td>{{ formatMinutes(row.breakMinutes) }}</td>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --include='**/attendance-history-list.component.spec.ts'`
Expected: PASS

- [ ] **Step 6: Run the full attendance module suite**

Run: `npm test -- --include='**/modules/attendance/**/*.spec.ts'`
Expected: PASS

- [ ] **Step 7: Manually verify in the browser**

Run: `npm start`, navigate to `/attendance/time-tracking`, confirm the history table shows Scheduled and Break columns with real values for past days.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/attendance-history-list
git commit -m "feat(attendance): add Scheduled and Break columns to the history table"
```

---

## Deferred (explicitly out of scope for this plan)

- **Standalone "Requests" nav item/page.** `MyRequestsPanelComponent` exists and works, but the correction/work-area-change draft-form state it needs lives in `TimeTrackingComponent`, not in the panel itself. Promoting Requests to its own route means extracting ~230 lines of form/preview state (`time-tracking.component.ts:110-126, 273-500`) into either the store or the panel component first — a genuinely separate refactor with its own risk and test surface, not a natural extension of this plan's tasks. Recommended as the next plan once this one ships and the Overview/Time-Tracking split has been used for a sprint.
- **Reusing `ClockInPolicy.LateArrivalMinute`'s tiered payroll-deduction schedule** for the monthly health card's "late arrival" threshold. Task 2 uses a flat zero-grace comparison instead (see its rationale) to avoid coupling a display-only count to payroll configuration; if product wants the two to match exactly later, that's a follow-up to Task 2 alone, not a reason to block this plan.
