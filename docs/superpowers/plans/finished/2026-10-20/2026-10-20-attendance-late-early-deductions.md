# Attendance Late/Early Deductions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the clock-in policy's rows to late clock-ins and early clock-outs (charging leave, audited, refundable), use the policy's first row as the late/early threshold everywhere, measure around approved time off, and retire short hours.

**Architecture:** A new `ClockInPolicyResolver` finds an employee's policy for a date. `AttendancePeriodData` gains the policy threshold, and the calculator uses it plus approved-leave-adjusted schedule edges. A new `AttendanceDeductionService` reconciles each late/early alert's desired charge against its stored `AttendanceAlertDeduction` (charge / re-charge / refund through `LeaveEntitlement.UsedHours` + `LeaveBalanceAudit`). It is called by the daily materializer and immediately on Excuse. The inbox detail gets a small `facts` list rendered as card rows. The policy form's rules editor is switched on.

**Tech Stack:** ASP.NET Core / EF Core (Postgres) / xUnit + Moq; Angular 21 + signals + Vitest.

**Spec:** `Hrms--Web-application---front-end---v1/docs/superpowers/specs/finished/2026-10-20/2026-10-20-attendance-late-early-deductions-design.md`

## Global Constraints

- **Multiplier rows:** the highest row with `LateArrivalMinute ≤ minutes` applies, and the deduction is `minutes × Multiplier` minutes. Hours are `Math.Round(minutes × M / 60m, 2)`.
- **Late and early** use the same rows. Same day: two separate charges.
- **Below the first row:** no alert, no charge. With no policy, or no active rows, the threshold is 0: today's behaviour (any lateness), no charge.
- **Balance may go negative.** Charges are frozen at the rule they were made with.
- **Charge** = `LeaveBalanceAudit` with `ChangeType = "deduction"`, `HoursChanged = -h`. **Refund** = `"adjustment"`, `+h`. Every charge and refund writes exactly one audit.
- **No back-charging:** work dates before `ClockInPolicy.DeductionRulesChangedAt` (date part) are never newly charged.
- **No entitlement row** for (employee, type, year): the deduction stays `pending`. It never creates an entitlement.
- **Only approved leave** shifts the schedule edges. Full-day covered → no late/early.
- **Short hours:** no new short-hours alerts, no short-hours signal, and clock-out never sets `short_hours`.
- **Frontend:** zero warnings (`npm run check:warnings`). No "Additional information" block; facts render as plain card rows.
- **Tests:**
  - Backend: kill `ONEVO.Api.exe` before each `dotnet test tests/ONEVO.Tests.Unit --filter …`.
  - Migrations: `dotnet ef migrations add <Name> --project src/ONEVO.Infrastructure --startup-project src/ONEVO.Api`, then apply it locally with `dotnet ef database update` (same flags).

## Review Focus

- **Job re-runs:** running the materializer twice in a row must charge once (idempotent). Task 5 pins this.
- **Excuse then revert:** Excuse refunds. A revert reopens the alert, and the next run charges again. Task 6 pins this.
- **Correction shrinking lateness** below the first row on a Confirmed alert: refund, alert kept. Task 5 pins this.
- **Hourly leave covering the scheduled start:** lateness is counted from the leave's end, and leave covering the whole day gives none. Task 2 pins this.
- **Rule edit that only renames the policy:** `DeductionRulesChangedAt` must not move. Task 1 pins this.

---

## Backend (`C:\onevoNew\HRMS-Backend-v1`)

### Task 1: Policy resolver + `DeductionRulesChangedAt`

**Files:**
- Modify: `src/ONEVO.Domain/Features/TimeAttendance/Entities/ClockInPolicy.cs` (`public DateTimeOffset? DeductionRulesChangedAt { get; set; }`), `ClockInPolicyConfiguration.cs` (column `deduction_rules_changed_at`)
- Modify: `IClockInPolicyRepository` + EF impl: `Task<IReadOnlyList<ClockInPolicy>> ListActiveOnDateAsync(Guid tenantId, Guid legalEntityId, DateOnly date, CancellationToken ct)`, which returns active policies effective on `date`, rules included
- Create: `src/ONEVO.Application/Features/TimeAttendance/Services/ClockInPolicyResolver.cs`
- Modify: `CreateClockInPolicyCommandHandler`, `UpdateClockInPolicyCommandHandler`, DI registration
- Create: migration `AddClockInPolicyDeductionRulesChangedAt`
- Test: `tests/ONEVO.Tests.Unit/Features/TimeAttendance/ClockInPolicyResolverTests.cs`, plus the existing update-handler tests file

**Interfaces:**
- Produces:
  ```csharp
  public interface IClockInPolicyResolver
  {
      /// The most specific active policy covering the employee on `date`: employee > position (active primary assignment) > department > full company.
      Task<ClockInPolicy?> ResolveAsync(Guid tenantId, Guid employeeId, Guid legalEntityId, DateOnly date, CancellationToken ct);
  }
  public static class ClockInPolicyRules
  {
      /// Active rows ordered by LateArrivalMinute; empty when none.
      public static IReadOnlyList<ClockInLateDeductionRule> Active(ClockInPolicy? policy);
      /// First active row's minutes, or 0.
      public static int ThresholdMinutes(ClockInPolicy? policy);
      /// Highest active row with LateArrivalMinute <= minutes, or null.
      public static ClockInLateDeductionRule? Match(ClockInPolicy? policy, int minutes);
  }
  ```
- Update handler: set `DeductionRulesChangedAt = now` only when the sorted active `(LateArrivalMinute, Multiplier, TimeOffTypeId)` set differs from before. Create handler: set it when rows exist.

- [ ] **Step 1: Write the failing tests:**
  - `Resolve_PrefersEmployeeOverPositionOverDepartmentOverCompany`: four policies; peel them away one by one.
  - `Resolve_IgnoresInactiveAndOutOfDatePolicies`
  - `Resolve_ReturnsNullWithoutPolicy`
  - `Match_PicksHighestRowNotAboveMinutes`: rows 15 and 60; minutes 10 → null, 30 → 15-row, 75 → 60-row.
  - `ThresholdMinutes_IsFirstActiveRow_OrZero`
  - `Update_KeepsRulesChangedAt_WhenOnlyNameChanges`, `Update_SetsRulesChangedAt_WhenAMultiplierChanges`
- [ ] **Step 2:** Run them. Expected: FAIL (compile).
- [ ] **Step 3:** Implement. Position comes from `IPositionAssignmentRepository.GetActivePrimaryAsync`, department from `Employee.DepartmentId`.
- [ ] **Step 4:** Add the migration and apply it locally. Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(attendance): resolve an employee's clock-in policy and track rule changes`

### Task 2: Calculator threshold + leave-adjusted edges + short hours out

**Files:**
- Modify: `src/ONEVO.Application/Features/TimeAttendance/Services/IEmployeeAttendancePeriodReader.cs`: add `int LateEarlyThresholdMinutes = 0` as the last optional parameter of `AttendancePeriodData`
- Modify: `EmployeeAttendancePeriodReader.cs`: fill it with `ClockInPolicyRules.ThresholdMinutes(await resolver.ResolveAsync(..., period.To))` when a legal entity exists
- Modify: `AttendancePeriodCalculator.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendancePeriodCalculatorTests.cs` (existing file, or create it)

**Interfaces:**
- Produces, in `AttendancePeriodCalculator`:
  - `public static (int Late, int Early) MissingMinutes(AttendanceRecord record, AttendancePeriodData data)` gives whole minutes after the leave-adjusted start / before the leave-adjusted end. It is 0 when the day is fully covered by approved leave, there is no schedule, or there is no clock-out (for early).
  - A day is late iff `Late >= max(1, threshold)` when the threshold is > 0, else iff `Late > 0` (today's rule). The same applies to early. `Classify`, `DayDetails` and `DayStatus` use this.
  - `Count` and `DayStatus` gain an optional `int thresholdMinutes = 0` and keep the old leave-unaware edges.
- Leave-adjusted edges:
  - Scheduled start → the latest `EndAt` (local time of day) among approved leaves that cover the scheduled start instant.
  - Scheduled end → the earliest `StartAt` among those covering the scheduled end instant.
  - If adjusted start ≥ adjusted end, the day is fully covered.
- `Classify`: stop computing short hours (the list stays empty, and `AttendanceViolationDates.ShortHours` is kept for compatibility). In `DayDetails`, `shortHours` is always false.

- [ ] **Step 1: Write the failing tests:**
  - `Late_UsesPolicyThreshold`: threshold 15; 10 min late → not late, 15 → late.
  - `Late_ZeroThresholdKeepsAnyMinute`
  - `Late_MeasuredFromEndOfHourlyLeaveCoveringStart`: 09:00 start; leave 09:00–11:00; clock-in 11:20 → 20 min late.
  - `Early_MeasuredToStartOfLeaveCoveringEnd`
  - `FullDayLeave_NoLateOrEarly`
  - `Classify_NoLongerReportsShortHours`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Update callers that compile against `Count`/`DayStatus` only if the signature forces it (optional parameter, so it shouldn't).
- [ ] **Step 4:** Run `--filter "AttendancePeriodCalculator|EmployeeAttendance|Attendance"`. Expected: PASS. Existing tests that asserted short hours are updated to the retirement rule, and each is listed in the ledger.
- [ ] **Step 5:** Commit: `feat(attendance): policy threshold and approved time off decide late/early; short hours retired in the calculator`

### Task 3: Retire short hours everywhere else

**Files:**
- Modify: `AttendanceAlertMaterializer.cs` (drop the `Days(dates.ShortHours, …)` line)
- Modify: `EmployeeSignalCatalogue.cs` (drop the `short_hours_days` entry)
- Modify: `GetEmployeeSignalItemsQueryHandler.cs` (drop it from the signal list and its switch arm)
- Modify: `ClockOutCommandHandler.cs` (status is always `StatusClockedOut`)
- Tests: the existing materializer, signal catalogue and clock-out tests

- [ ] **Step 1: Write the failing tests:**
  - `Materializer_RaisesNoShortHoursAlert`: a day with worked < required gets no `short_hours_days` alert.
  - `Materializer_DropsAnOpenShortHoursAlert`: an existing open, unresolved one is removed.
  - `ClockOut_UnderRequiredMinutes_IsClockedOut`
  - `SignalCatalogue_HasNoShortHours`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The `AttendanceAlertSignals.ShortHoursDays` constant and its label stay, for historic alerts.
- [ ] **Step 4:** Run the affected test classes. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(attendance): retire short-hours alerts, signal and status`

### Task 4: Deduction entity + service

**Files:**
- Create: `src/ONEVO.Domain/Features/TimeAttendance/Alerts/AttendanceAlertDeduction.cs`, its EF configuration, `IAttendanceAlertDeductionRepository` + EF impl, migration `AddAttendanceAlertDeductions`
- Create: `src/ONEVO.Application/Features/TimeAttendance/Alerts/AttendanceDeductionService.cs`
- Modify: `ILeaveEntitlementRepository` only if needed (it already has `GetTrackedByEmployeeTypeYearAsync`). Add `Task AddBalanceAuditAsync` access through `ILeaveApprovalRepository.AddBalanceAuditAsync` (existing).
- Test: `tests/ONEVO.Tests.Unit/Features/TimeAttendance/AttendanceDeductionServiceTests.cs`

**Interfaces:**
- Entity `AttendanceAlertDeduction : BaseEntity`:
  - fields `EmployeeId`, `AlertId` (unique), `LeaveTypeId`, `Year`, `Minutes`, `Multiplier`, `Hours`, `Status`, `ChargedAt?`, `RefundedAt?`, `ChargeAuditId?`, `RefundAuditId?`
  - `AttendanceAlertDeductionStatuses { Pending = "pending", Charged = "charged", Refunded = "refunded" }`
- Repository:
  - `Task<AttendanceAlertDeduction?> GetByAlertAsync(Guid tenantId, Guid alertId, CancellationToken ct)` (tracked)
  - `Task<IReadOnlyDictionary<Guid, AttendanceAlertDeduction>> ListByAlertsAsync(Guid tenantId, IReadOnlyCollection<Guid> alertIds, CancellationToken ct)` (tracked)
  - `void Add(AttendanceAlertDeduction d)`
- Service:
  ```csharp
  public sealed record DeductionTarget(int Minutes, ClockInLateDeductionRule Rule);   // what the day should cost now
  public sealed class AttendanceDeductionService
  {
      /// Brings the alert's deduction in line with `target` (null = should cost nothing). Never saves; caller saves.
      Task ReconcileAsync(Guid tenantId, AttendanceAlert alert, DeductionTarget? target, Guid? actorEmployeeId, CancellationToken ct);
  }
  ```
- Rules inside `ReconcileAsync`:
  - **target null:**
    - `charged` → refund: `UsedHours -= Hours`, audit `adjustment +Hours`, reason "Refund: {Late clock-in|Early clock-out} {dd MMM}".
    - `pending` → `refunded` (no audit).
  - **target set, no row:** create the row with Minutes, `Multiplier = rule.Multiplier`, Hours, `LeaveTypeId = rule.TimeOffTypeId`, `Year = alert.WorkDate.Year`. Charge if the entitlement exists, else `pending`.
  - **target set, `pending` row:** charge if the entitlement now exists.
  - **target set, `charged` row, same Minutes:** nothing. Different Minutes: refund, then charge with the stored Multiplier (frozen) and the new Minutes.
  - **target set, `refunded` row:** charge again with the stored Multiplier and the target Minutes.
  - **Charge:** `UsedHours += Hours`, audit `deduction -Hours`, reason "{Late clock-in|Early clock-out} {dd MMM} · {m} min × {M}". `BalanceAfter = Total + CarriedForward - Used - Pending`.

- [ ] **Step 1: Write the failing tests:**
  - `Charge_DeductsMinutesTimesMultiplier_AndAudits`: 30 min × 1 → 0.5 h; one deduction audit −0.5.
  - `Charge_GoesNegative`
  - `NoEntitlement_StaysPending_ThenChargesWhenItExists`
  - `SameMinutes_IsIdempotent`: reconcile twice → one audit.
  - `MinutesChanged_RefundsAndRecharges_AtFrozenMultiplier`: rule multiplier changed to 3 between runs; the re-charge still uses 1.
  - `NullTarget_RefundsACharge`
  - `RefundedRow_ChargesAgainWhenTargetReturns`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Add the migration and apply it locally.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(attendance): audited leave deductions for late/early alerts`

### Task 5: Materializer charges, re-charges and refunds

**Files:**
- Modify: `AttendanceAlertMaterializer.cs` (inject `IClockInPolicyResolver`, `AttendanceDeductionService`, `IAttendanceAlertDeductionRepository`)
- Test: the existing materializer test file

**Interfaces:**
- Consumes: Tasks 1, 2 and 4.
- After the alert upsert, for every late or early alert in the window, each with its day's record:
  - minutes = `MissingMinutes(...)`
  - `policy = resolver.ResolveAsync(…, workDate)`
  - `rule = ClockInPolicyRules.Match(policy, minutes)`
  - **target** = null when any of:
    - the alert is Excused or ConvertedToLeave
    - there is no rule
    - the alert was removed (its deduction gets target null too)
    - `workDate < policy.DeductionRulesChangedAt?.Date` **and** no deduction row exists yet
  - otherwise `new DeductionTarget(minutes, rule)`
  - Resolved Confirmed alerts are included. Then save once.
- Alerts below the threshold no longer qualify, because the calculator already applies the threshold (Task 2).

- [ ] **Step 1: Write the failing tests:**
  - `LateDay_PastFirstRow_RaisesAlertAndCharges`
  - `LateDay_BelowFirstRow_NoAlertNoCharge`
  - `RunTwice_ChargesOnce`
  - `CorrectionErasesLateness_OnConfirmedAlert_Refunds_AlertKept`
  - `LeaveApprovedLater_CoveringStart_RefundsOrReduces`
  - `DayBeforeRulesChangedAt_NotCharged`
  - `EarlyClockOut_ChargedWithSameRows`
  - `NoPolicy_KeepsTodaysAlert_NoCharge`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the materializer tests, then the whole unit project. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(attendance): daily job charges and reconciles late/early deductions`

### Task 6: Excuse refunds now; inbox shows the charge

**Files:**
- Modify: `AttendanceAlertInbox.cs`:
  - `ResolveAsync` with outcome Excused → `ReconcileAsync(…, target: null, actor)` in the same save
  - outcome labels: "Excused - stop counting it and refund the deduction" when a charged deduction exists
  - detail facts
- Modify: `src/ONEVO.Application/Features/Inbox/Contracts/InboxContracts.cs`: `public sealed record InboxFact(string Label, string Value);` and `InboxItemDetail(..., IReadOnlyList<InboxFact>? Facts = null)` as a new last optional parameter
- Test: `tests/ONEVO.Tests.Unit/Features/TimeAttendance/Inbox/AttendanceInboxTests.cs`

**Interfaces:**
- Detail facts for late and early alerts:
  - "Late by" / "Left early by" → "{m} min"
  - "Deducted" → "{h:0.##} h from {Leave type name}"
  - "Deduction pending" when the deduction is pending, "Refunded" when refunded
  - nothing when there's no deduction

- [ ] **Step 1: Write the failing tests:**
  - `Excuse_RefundsTheDeductionImmediately`: one adjustment audit, deduction refunded.
  - `Confirm_KeepsTheDeduction`
  - `Detail_ShowsLateByAndDeductedFacts`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `--filter AttendanceInboxTests`, then the full unit and architecture suites. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(inbox): excusing a late/early alert refunds its deduction; facts show the charge`

---

## Frontend (`C:\onevoNew\Hrms--Web-application---front-end---v1`)

### Task 7: Card renders detail facts

**Files:**
- Modify: `src/app/modules/inbox/models/inbox.dto.ts`: `export interface InboxFactDto { label: string; value: string; }`, and `facts?: InboxFactDto[] | null` on `InboxItemDetailDto`
- Modify: `inbox-item-card.component.ts`: after the Severity row, `@for (f of d.facts ?? []; …)` renders a `card__row` (`dt` label, `dd` value, `data-testid="inbox-card-fact"`)
- Test: `inbox-item-card.component.spec.ts`

- [ ] **Step 1:** Write the failing spec `renders detail facts as plain rows`: two facts → two rows with label and value; no "Additional information" text.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the inbox specs. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(inbox): show detail facts as card rows`

### Task 8: Policy rules editor on

**Files:**
- Modify: `src/app/modules/settings/utils/clock-in-policy-form.utils.ts`:
  - `LATE_DEDUCTION_RULES_EDITABLE = true`
  - validation: minutes 1–480 and unique; amount > 0 and ≤ 10
- Modify: `clock-in-policy-form.component.ts/.html`:
  - section title "Late arrival & early leave deductions"
  - sentence: "If late or leaving early by [X] minutes, deduct [M]× those minutes from [type]"
  - type options from `LeaveTypeStore` (active types, `{ value: id, label: name }`)
- Tests: the existing form and utils specs

- [ ] **Step 1: Write the failing specs:**
  - The editor renders, with no disabled message.
  - The type options come from the leave types.
  - Validation rejects duplicate minutes, minutes 0 or 481, and an amount of 0 or 11.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the settings specs and `npm run check:warnings`. Expected: PASS, clean.
- [ ] **Step 5:** Commit: `feat(settings): enable late/early deduction rules with real time-off types`

### Task 9: Review + live check

- [ ] Whole-branch fresh review (opus) of both ranges. Fix Critical and Important findings, test first.
- [ ] Live check in Chrome:
  - Confirm `:7229` is listening first.
  - Set a policy row (15 min → 1× Annual leave) on dapi.
  - Run the materializer (job or a dev trigger), then confirm the case, the facts, the audit row and the balance.
  - Excuse it, then confirm the refund.
