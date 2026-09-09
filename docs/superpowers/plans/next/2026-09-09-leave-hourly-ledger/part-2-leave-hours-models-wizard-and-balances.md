# Leave hourly ledger — Frontend Part 2: Models, wizard, balances

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Time Off UI speaks hours and From/To datetimes. AM/PM is gone. Types/policies still show day fields.

**Architecture:** DTOs match backend Part 3 exactly. Wizard draft replaces `halfDayPeriod` with `startAt`/`endAt` (ISO UTC). Empty times default to the signed-in employee’s legal-entity work window (already on general settings store if loaded; otherwise load `LegalEntityStore` current settings). My Balances / history / approvals / calendar copy uses hours.

**Tech Stack:** Angular 21, `@ngrx/signals`, Vitest.

**Spec:** `docs/superpowers/specs/next/2026-09-09-leave-hourly-ledger-design.md` §§ UI, Request model. **Depends on:** backend Part 3 shipped (API will 400 old `startDate`/`halfDayPeriod` bodies).

**Global constraints:** Do not rename policy `annualEntitlementDays` or type `defaultDaysPerYear`. Display hours with two decimals max; do not round in state. Reuse `app-time-picker` and `app-date-picker`.

## DTO map (verbatim backend)

| Old TS | New TS |
|---|---|
| `startDate` / `endDate` / `halfDayPeriod` on requests | `startAt: string` / `endAt: string` (ISO) |
| `totalDays` / `paidDays` / `unpaidDays` | `totalHours` / `paidHours` / `unpaidHours` |
| `entitledDays` / `annualDays` / `carriedForwardDays` / `usedDays` / `pendingDays` / `remainingDays` | `*Hours` twins |
| `currentRemainingDays` etc. | `currentRemainingHours` / `pendingAfterSubmitHours` / `remainingAfterSubmitHours` |
| generate/manual `totalDays` | `totalHours` |
| audit `daysChanged` | `hoursChanged` |

---

### Task 1: Models + API payloads

**Files:**
- Modify: `src/app/modules/leave/models/leave-request.model.ts`
- Modify: `src/app/modules/leave/models/leave-balance.model.ts`
- Modify: `src/app/modules/leave/models/leave-entitlement.model.ts`
- Modify: `src/app/modules/leave/models/leave-calendar.model.ts`
- Modify: matching `*.spec.ts` fixtures

`SubmitLeaveRequestRequest`:

```typescript
export interface SubmitLeaveRequestRequest {
  leaveTypeId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  fileRecordIds: string[] | null;
}
```

On-behalf adds `employeeId`. Delete `halfDayPeriod`, `startDate`, `endDate`.

`LeaveBalanceResponse` hours fields only (no remainingDays). Secondary “days at Xh/day” is computed in the component from `entitledHours / workDayHours` when work hours are known — not a backend field.

Grep `halfDayPeriod` and `totalDays` under `src/app/modules/leave` and apply the map. `ng test` will fail until later tasks catch up — keep going in this part.

- [ ] **Commit** after models + specs compile:

```
git add src/app/modules/leave/models src/app/modules/leave/data-access
git commit -m "feat(leave): align leave DTOs to hourly StartAt/EndAt contract"
```

---

### Task 2: New Request wizard

**Files:**
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.ts`
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.html`
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.spec.ts`

Draft:

```typescript
export interface LeaveRequestDraft {
  leaveTypeId: string;
  startDate: string; // yyyy-MM-dd for the date picker
  startTime: string; // HH:mm, '' means default work start
  endDate: string;
  endTime: string;   // '' means default work end
  reason: string | null;
}
```

New `@Input() workStartTime: string | null` and `workEndTime: string | null` from My Balances / Entitlements (legal entity settings).

Combine to ISO UTC in `toSubmitPayload()` using the entity timezone already used by calendar (`store.myTimezone` pattern or settings timezone). Empty startTime → `workStartTime` (required; if null, disable Continue and show “Set work start and end in General Settings first.”). Overnight: if `endTime <= startTime` and dates are equal, end date is next calendar day before conversion.

Delete the Half day `<select>`. Step 1 remaining copy: `{{ remainingHoursFor(type.id) }} hours remaining`.

Preview step: `Total leave hours: {{ previewResult.totalHours }}`. Review balance: `currentRemainingHours → remainingAfterSubmitHours`.

Wizard spec: emit payload `{ startAt, endAt, ... }` with **no** `halfDayPeriod`. Afternoon fixture: date 2026-09-09, times 14:00–18:00.

- [ ] **Run**

```
npm test -- --include='**/new-leave-request-wizard.component.spec.ts' --watch=false
```

- [ ] **Commit**

```
git add src/app/modules/leave/ui/new-leave-request-wizard
git commit -m "feat(leave): request wizard From/To datetimes in hours"
```

---

### Task 3: My Balances, history, team, entitlements, approvals, calendar

**Files (modify each that still prints days as duration):**
- `src/app/modules/leave/feature/my-balances/my-balances.component.html` — subtitle “remaining hours”; pass work times into wizard
- `src/app/modules/leave/ui/leave-balance-list-table/` — column headers Entitled/Used/Pending/Remaining hours; optional subtitle `{{ entitledHours / workDayHours }} days at {{ workDayHours }}h/day` only if `workDayHours` input is set
- `src/app/modules/leave/ui/leave-request-history-table/` — show formatted `startAt → endAt` and `totalHours`h; drop half-day
- `src/app/modules/leave/feature/team-balances/`
- `src/app/modules/leave/feature/entitlements-management/` generate preview columns hours; manual/adjust forms `totalHours` (HR still thinks in days on **policy** screens only)
- `src/app/modules/leave/feature/pending-approvals/` and `requests-list/`
- `src/app/modules/leave/ui/leave-calendar-grid/` + day detail — use `startAt`/`endAt`
- `src/app/modules/leave/ui/leave-cancel-confirm-dialog/` — `totalHours`

Empty states stay (still need generate). Year dropdown stays.

My Balances must load general settings (or a slim work-window from session/legal entity) so the wizard defaults work. If already available via `GeneralSettingsStore`, inject it; do not duplicate HTTP.

- [ ] **Run leave specs**

```
npm test -- --include='**/leave/**/*.spec.ts' --watch=false
```

Expected: PASS. Fix remaining `totalDays` / `halfDayPeriod` fixtures.

- [ ] **Commit**

```
git add src/app/modules/leave
git commit -m "feat(leave): show hours and datetime ranges across Time Off UI"
```
