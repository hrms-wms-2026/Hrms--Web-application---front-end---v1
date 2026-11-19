# Leave Policy Cleanup — Part 3: Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave type form shows only the kind of leave; the policy wizard creates one-leave-type policies with "N hours every month/year", carry-forward-all default, one "new joiners" control, rules and assignment; editing saves a dated version; the employee Employment tab shows and changes the person's policy per leave type; over-balance requests are allowed and flagged.

**Architecture:** Same module layout as today (`modules/leave/{data-access,models,state,ui,feature}`); the existing wizard/modal/table components are rewritten in place, plus one new people-module card and one popup. All selects use the shared `app-select`, tables `app-data-table`, popups `app-modal` with the `.ui-popup-header` style.

**Tech Stack:** Angular 21 (standalone, signals), Vitest via `ng test` (use `vi.fn()`, mirror neighbouring specs' mock-store style), Tailwind + component CSS.

**Spec:** `C:\onevoNew\HRMS-Backend-v1\docs\superpowers\specs\next\2026-10-20-leave-type-policy-cleanup-design.md`. **Backend contract:** Part 1 Task 3/4/6 and Part 2 Task 6 Interfaces blocks in `C:\onevoNew\HRMS-Backend-v1\docs\superpowers\plans\next\2026-10-20-leave-policy-cleanup\` — TypeScript models mirror those records in camelCase.

## Global Constraints

- Current branch, no worktrees, shared working tree: stage only your own files.
- Test: `npx ng test --watch=false --include="src/app/modules/leave/**"` (and `modules/people/**` for Task 4). Build: `npx ng build`.
- Copy: amounts always say **hours** ("h" in compact cells, e.g. `8 h / month`, `112 h / year`); notice says days. The words "accrual", "proration", "category", "days per year" must not appear anywhere in the leave module UI (`grep -rni "accrual\|proration\|days per year\|category" src/app/modules/leave --include=*.html --include=*.ts` → only unrelated hits, e.g. inbox filter categories).
- Approval mode labels: `any_one` "Any one approver", `all_must_approve` "All approvers", `in_order` "Approvers in order", `none` "No approval needed".
- Eligibility labels: "Right away", "After probation", "After [N] months".
- Source badge labels: `employee` "Employee", `position` "Position", `department` "Department", `legal_entity` "Company".
- Repo `CLAUDE.md` applies: zero warnings — run `npm run check:warnings` before every commit; never suppress diagnostics; specs mock HTTP and use a fixed clock (`vi.useFakeTimers().setSystemTime(new Date('2026-10-20T09:00:00'))`) for apply-from / "today" logic.
- Changing an employee's policy is visible only with `leave:manage` or `leave:create` (`PermissionService.hasAnyPermission`).

## Review Focus

- **Tenant with exactly one legal entity** — "Whole company" checkbox is pre-ticked and hidden; with several, all shown unticked. Test in Task 2.
- **Assignment conflict response** — wizard shows "Sales department already uses 'Sick · standard' for Sick leave. Replace it?" and resubmits with `replaceConflicts: true` only after confirm. Test in Task 2.
- **Apply-from date in the past** — date picker min = today; Save disabled otherwise. Test in Task 3.
- **Employee with a leave type that has no policy** — row shows "No policy" and (with permission) "Assign" instead of "Change". Test in Task 4.
- **Over-balance in the request wizard** — submit is still enabled; a warning line "This is 24 h more than your balance. If approved, your balance goes negative." appears. Test in Task 5.

---

### Task 1: Models + API services

**Files:**
- Rewrite: `src/app/modules/leave/models/leave-type.model.ts`, `leave-policy.model.ts`; modify `leave-balance.model.ts` (add `policyName`, `amountHours`, `amountPeriod`), `leave-request.model.ts` (add `exceedsBalanceByHours`)
- Modify: `src/app/modules/leave/data-access/leave-type-api.service.ts`, `leave-policy-api.service.ts` (+ specs)
- Create: `src/app/modules/leave/data-access/employee-leave-policy-api.service.ts` (+ spec)
- Modify: `src/app/modules/leave/state/leave-type.store.ts`, `leave-policy.store.ts` (+ specs)

**Interfaces:**
- Produces: `LeaveType`, `LeavePolicyRules`, `LeavePolicyListItem`, `LeavePolicyDetail`, `LeavePolicyVersion`, `LeavePolicyAssignment`, `LeavePolicyAssignmentConflict`, `EmployeeLeavePolicyRow` (camelCase of the backend records). Policy API: `list(includeInactive)`, `get(id)`, `create(body)`, `addVersion(id, {applyFrom, rules})`, `deleteVersion(id, versionId)`, `setAssignments(id, {assignments, replaceConflicts})`, `setActive(id, isActive)`, `clone(id, name)`. Conflicts surface as a typed error `{ code: 'leave_policy.assignment_conflict', conflicts: LeavePolicyAssignmentConflict[] }` (parse in the service). Employee API: `list(employeeId)`, `set(employeeId, leaveTypeId, policyId)`, `reset(employeeId, leaveTypeId)`. Store methods mirror the API and expose `conflicts` signal.
- Helper (in `src/app/modules/leave/utils/leave-amount.ts`): `formatAmount(hours: number, period: 'month' | 'year'): string` → `"8 h / month"`; `formatHours(hours: number): string` → `"8 h"`, `"-4.5 h"`.

- [ ] **Step 1:** failing specs — URL/verb per API method; conflict error parsed; `formatAmount(8,'month') === '8 h / month'`, `formatHours(-4.5) === '-4.5 h'`. **Step 2:** run — fail. **Step 3:** implement. **Step 4:** run — PASS. **Step 5:** commit `feat(leave): models and API for per-type versioned policies`.

### Task 2: Leave type modal + policy wizard (create)

**Files:**
- Rewrite: `src/app/modules/leave/ui/leave-type-form-modal/*` — fields: Name, Code (locked on edit), Description, Colour (swatch row of 8 preset colours + hex input), Paid leave (checkbox), Who can take it (`app-select`: All employees / Men only / Women only), Requires a document (checkbox) → "after [N] hours" + accepted types.
- Modify: `src/app/modules/leave/ui/leave-type-list-table/*` / `feature/leave-types-management/*` — cards: colour dot, name, code, Paid/Unpaid chip, "N policies"; no amount.
- Rewrite: `src/app/modules/leave/ui/leave-policy-form-wizard/*` — 3 steps:
  1. **Basics** — Leave type (`app-select`, required, disabled in edit), Policy name, Description.
  2. **Amount** — inline sentence "Gives [hours input] hours every [app-select month/year]"; Carry forward: radio "Carry over all unused hours" (default) / "Carry over up to [N] hours"; checkbox "Carried hours expire after [N] months"; "New joiners can use it" `app-select` Right away / After probation / After [N] months (number input shown only for the last).
  3. **Rules & assignment** — Minimum notice (days), Shortest request (hours, default 1), Longest request (hours, blank = no limit), Maximum team absence %, Approval (`app-select`), Blackout dates (existing control), **Assign to**: "Whole company" (legal-entity checkboxes; one entity → pre-ticked and hidden), Departments (multi `app-select`), Positions (multi `app-select`) — load options from the existing org/department/position API services already used elsewhere (search `modules/organization/data-access`).
  On a conflict error show the inline confirm (copy in Review Focus) and resubmit with `replaceConflicts: true`.
- Modify: `src/app/modules/leave/ui/leave-policy-list-table/*` — columns: Policy, Leave type (colour dot), Amount (`formatAmount`), Assigned to (summary joined with " · "), Version ("v2 · next on 1 Nov" when `nextVersionEffectiveFrom`), Status.

- [ ] **Step 1: Failing specs:** type modal emits payload without any numeric amount fields and with `color`; wizard step 2 invalid when hours ≤ 0; switching carry radio to "up to" requires the cap; "After N months" requires N; single-entity tenant pre-ticks the company; conflict error shows confirm text and second submit sends `replaceConflicts: true`; final payload equals the backend `CreateLeavePolicyCommand` shape (assert the whole object for one filled example: Annual, 8 h/month, carry all, after probation, notice 7, min 1, max 40, any_one, whole company).
- [ ] **Step 2:** run — fail. **Step 3:** implement. **Step 4:** run — PASS. **Step 5:** commit `feat(leave): kind-only leave type form and single-type policy wizard`.

### Task 3: Edit as new version + detail panel history

**Files:**
- Modify: `leave-policy-form-wizard` — edit mode: prefilled from the version in force (or the future one if it exists, with a note "Editing the change scheduled for 1 Nov"), step 3 ends with **Apply from** (`app-date-picker`, min today, default today); submit calls `addVersion` then `setAssignments` if assignments changed.
- Modify: `src/app/modules/leave/ui/leave-policy-detail-panel/*` — sections: current rules (plain fact rows, no sentences), Assigned to list, **Versions** list (v number, "From 1 Nov 2026", created by/at, "Scheduled" chip for future, Delete action on future versions only). Deactivate shows the backend's `leave_policy.has_assignments` message as "Unassign this policy everywhere before turning it off."

- [ ] **Step 1: Failing specs:** apply-from earlier than today disables Save; edit submit calls `addVersion` with `applyFrom` and rules, not `create`; detail panel lists versions newest first and shows Delete only where `isFuture`. **Step 2:** run — fail. **Step 3:** implement. **Step 4:** PASS. **Step 5:** commit `feat(leave): policy edits save dated versions with history`.

### Task 4: Employee detail → leave policies card

**Files:**
- Create: `src/app/modules/people/ui/employee-leave-policies/employee-leave-policies.component.{ts,html,css,spec.ts}`
- Create: `src/app/modules/people/ui/employee-leave-policies/change-leave-policy-dialog.component.{ts,spec.ts}`
- Modify: `src/app/modules/people/feature/employee-detail/employment-tab.component.ts` — add the card below Reporting Structure (or the last card group in that tab).

**Interfaces:**
- Consumes: `EmployeeLeavePolicyApiService` (Task 1), `LeavePolicyApiService.list()` filtered by `leaveTypeId` and `isActive`.
- Produces: `<app-employee-leave-policies [employeeId]="…" />`.

Card "Leave policies": one row per `EmployeeLeavePolicyRow` — colour dot + leave type, policy name (or "No policy" muted), source badge, amount (`formatAmount`). With permission: "Change" (or "Assign" when no policy) opens the dialog; rows with `isOverride` also show "Reset to inherited" (confirm via shared `confirm-modal`, then `reset`). Dialog: header "Change {leave type} policy", read-only leave type line, `app-select` of that type's active policies (each option label `"{name} — {formatAmount}"`), current one preselected, Save → `set` → reload card + toast "Policy updated".

- [ ] **Step 1: Failing specs:** rows render source badge text per kind; no-permission user sees no Change/Assign/Reset; "No policy" row shows "Assign"; dialog only lists policies of that leave type; Save calls `set(employeeId, leaveTypeId, policyId)`; Reset calls `reset` after confirm. **Step 2:** run `--include="src/app/modules/people/**"` — fail. **Step 3:** implement. **Step 4:** PASS. **Step 5:** commit `feat(people): employee leave policies card with per-type change`.

### Task 5: Over-balance in request wizard + balances wording

**Files:**
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.ts` (+ html/spec) — remove any client-side block on insufficient balance; for paid types show the warning line (Review Focus copy) when requested hours > remaining; option label `"{type} - {formatHours(remaining)} left"`; only list leave types the employee has a balance row for.
- Modify: `src/app/modules/leave/ui/leave-balance-list-table/*`, `feature/my-balances/*`, `ui/leave-entitlement-list-table/*`, `utils/leave-balance-csv.ts`, `modules/people/ui/overview-time-off-widget/*` — show negative remaining in the danger colour with a minus sign; add "Policy" column/line (`policyName`, `formatAmount`) where a balance row is shown in tables; replace any "days" amount wording with hours.

- [ ] **Step 1: Failing specs:** wizard with remaining 16 and 40 h requested → warning visible and submit enabled; unpaid type → no warning; balance table renders `-8 h` with the danger class. **Step 2:** run — fail. **Step 3:** implement. **Step 4:** run leave + people specs and `npx ng build` — PASS, and the copy grep in Global Constraints is clean. **Step 5:** commit `feat(leave): over-balance requests allowed with warning; hours wording`.

### Task 6: Live check (needs Part 2 Task 7's API running)

- [ ] Confirm the API on :7229 is listening, open the frontend in the browser for the Dapi tenant and walk: Leave Types → create "Casual" (no numbers visible) → Leave Policies → New policy (Casual, 8 h every month, carry all, right away, assign Engineering department) → policy list shows "8 h / month · Engineering" → edit, change to 10 h, apply from tomorrow → list shows "v1 · next on <date>", detail shows v2 Scheduled → People → an Engineering employee → Employment tab → Leave policies shows Casual from Department → Change to another Casual policy → shows Employee + Reset → Reset returns to Department → as that employee, request more hours than the balance → warning shown, submit works → as approver, inbox item shows "Over balance" fact. Screenshot each key screen; any mismatch is a bug to fix before reporting done.
