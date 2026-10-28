# Attendance: late/early deductions and short-hours retirement — design

Date: 2026-10-20 · Repos: `HRMS-Backend-v1` + `Hrms--Web-application---front-end---v1`

## Why

Attendance cases today are noisy and unfair. Late clock-in / early clock-out fire at 1 minute (zero grace). "Short
hours" fires for any normal break, and for approved hourly time off. Meanwhile the clock-in policy already has
"late deduction rules" ("if late by X minutes, deduct … from <time-off type>") that are stored but **never applied**,
and their editor is switched off. The user wants lateness handled by the policy: below the policy's threshold
nothing happens; past it, the missing minutes are charged to leave, and a reviewer can excuse (refund) it.

## Decided by the user

1. **Multiplier of actual minutes.** A rule row is "if late by **X** min, deduct **M×** the late minutes from
   **type T**". The highest row whose X ≤ the minutes missing applies; the deduction is `minutes × M`, charged to T.
   Example: rows 15→1×, 60→2×; 10 min late → nothing; 30 min → 30 min; 75 min → 150 min.
2. **Same rows for late clock-in and early clock-out.** Leaving 20 min early is measured and charged exactly like
   arriving 20 min late. Late and early on the same day are two separate charges.
3. **Balance may go negative.** If T's balance can't cover it, the full amount is deducted.
4. **A charge still opens an inbox case.** The late / early attendance alert shows what was deducted; the reviewer
   can **Confirm** (keep) or **Excuse** (refund). An approved attendance correction that changes the times
   recalculates (refund, re-charge or nothing).
5. **Short hours is retired.** Late, early, over-break and time off cover the missing time; no short-hours cases.

## Goals

- Apply the clock-in policy's rows to late clock-ins and early clock-outs, charging leave with a full audit trail.
- Below the first row's minutes: no case, no charge.
- Approved time off is never late/early: lateness is measured from the end of time off that covers the start of the
  day, early leaving up to the start of time off that covers its end; a full-day leave day has no late/early at all.
- Excuse refunds; corrections recalculate; every charge and refund is a `LeaveBalanceAudit` row.
- Turn on the policy screen's rules editor with a real time-off type picker.
- Stop raising short-hours cases.

## Non-goals

- No change to absence, missing clock-out, off-schedule, over-break, location or idle alerts.
- No payroll export of deductions.
- No separate early-leave rule table (decision 2).
- No new tolerance setting; the policy's first row *is* the threshold.

## Anti-goals

- Charging someone for minutes covered by approved time off.
- A charge with no audit row, or a refund that doesn't reverse exactly what was charged.
- Charging twice for the same alert (job re-runs must be idempotent).
- Surprise mass back-charging of historic days when rules are first saved (see Calls).

## Behaviour

### Which policy applies

The employee's **effective clock-in policy for the work date**: active, `EffectiveFrom ≤ date ≤ EffectiveTo`, the
most specific scope that includes them — employee > position > department > full company (the scope membership
validator already prevents overlaps within a scope). No policy, or a policy with no active rows → **today's
behaviour** for late/early (alert at any minute, no charge).

### Minutes missing

- Late = clock-in − scheduled start, where scheduled start moves to the end of any approved time off that covers it.
- Early = scheduled end − clock-out, where scheduled end moves to the start of any approved time off that covers it.
- Breaks never count toward late/early (over-break has its own alert).
- Days with approved full-day leave, non-working days and missing clock-outs: no late/early charge.

### When it runs

In the existing daily `AttendanceAlertMaterializer` pass over finished days (it already re-evaluates the window
and drops open alerts that stop qualifying). For each late / early day at or past the first row:

- upsert the alert (as today) and its **deduction**: rule matched, minutes, multiplier, hours (`minutes × M / 60`,
  2 dp), time-off type, entitlement year (= work date year);
- if a deduction for this alert exists with the same hours → nothing; different hours → refund the old, charge the
  new; the alert no longer qualifies (correction, leave) → refund and remove as today.

A charge adds to `LeaveEntitlement.UsedHours` for (employee, type, year) and writes a `LeaveBalanceAudit`
(`ChangeType = deduction`, `HoursChanged = −hours`, reason "Late clock-in 19 Oct · 23 min × 1"). A refund subtracts it
back and writes an audit (`ChangeType = adjustment`, `+hours`, reason "Refund: late clock-in 19 Oct excused").

### Reviewer actions

The alert's existing **Resolve** action keeps its outcomes; for a charged alert:
- **Confirmed** — charge stays.
- **Excused** — refund now (audited), alert resolved.
Resolved alerts are never re-charged by the job.

### Inbox display

The attendance alert's ticket details facts gain **Late by** / **Left early by** and **Deducted** ("23 min from
Annual leave"), as plain fact rows (no prose, no "Additional information" block). Past cases rows are unchanged.

### Short hours retired

- The materializer stops raising `short_hours_days`; open never-resolved short-hours alerts drop out on the next
  pass (existing behaviour for no-longer-qualifying alerts). Resolved ones are kept as history.
- The employee overview "short-hours days" signal is removed.
- Clock-out stops setting the `short_hours` record status (new days are `clocked_out`); historic rows untouched.

### Policy screen

- `LATE_DEDUCTION_RULES_EDITABLE` on; section title "Late arrival & early leave deductions"; sentence
  "If late or leaving early by [X] minutes, deduct [M]× those minutes from [time-off type]".
- Time-off type options from `GET api/v1/leave/types` (active types).
- Validation: X 1–480 and unique per policy; M > 0 and ≤ 10; type required.

## Data

New table `attendance_alert_deductions` (one row per charged alert): tenant, alert id (unique), employee, leave type,
entitlement year, minutes, multiplier, hours, status (`pending` / `charged` / `refunded`), charged-at, refunded-at,
audit ids. New column `clock_in_policies.deduction_rules_changed_at`.
It makes re-runs idempotent and refunds exact.

## Calls made in this design (not explicitly decided by the user)

- Charges happen in the daily job on finished days, not live at clock-in (the day must be complete; corrections and
  leave are known).
- **No back-charging:** the policy gets `DeductionRulesChangedAt`, set only when the rule rows actually change (the
  update handler diffs the rows instead of relying on recreated rows' CreatedAt). Days before that date are never
  newly charged.
- **Charges are frozen at their rule.** Editing rules later never re-prices a charged day. Only the *minutes* can
  change a charge: a correction or approved leave that changes the minutes refunds and re-charges (or refunds fully).
- **Deductions reconcile independently of the alert's outcome.** The job re-checks every `charged` deduction in its
  window, Confirmed alerts included: if a correction/leave erased the lateness, the deduction is refunded (the
  resolved alert stays as history). Excused → already refunded, never touched again.
- **No entitlement row yet** for (employee, type, year): the deduction is saved as `pending` and applied on a later
  run once the entitlement exists. It never creates a 0-hour entitlement (that would block yearly generation,
  which skips existing rows). Pending deductions show "Deduction pending" in the inbox facts.
- **The threshold applies everywhere.** `AttendancePeriodCalculator` takes the employee's first-row minutes as the
  late/early grace (zero when no policy rows), so dashboards, day statuses and Overview widgets agree with the cases.
- **Window limit accepted:** the job's 35-day window bounds reconciliation; a correction or leave approved more than
  35 days after the day won't auto-refund (HR adjusts manually; the audit trail shows the charge).
- Only **approved** leave counts; leave approved after a charge is settled by the next job run.
- Policy precedence employee > position > department > company.
- Hours rounded to 2 decimals.
- Historic `short_hours` attendance records are left as they are.
