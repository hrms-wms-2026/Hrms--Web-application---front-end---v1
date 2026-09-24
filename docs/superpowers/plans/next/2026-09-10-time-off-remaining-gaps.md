# Time Off remaining gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the product gaps on the existing Time Off screens (wizard review, calendar filters, request-from-day) without starting hourly-ledger or a new files module.

**Architecture:** Frontend-only. Reuse `LeaveCalendarStore.setDepartmentFilter` / `getMonth` query params, and the existing `NewLeaveRequestWizard` + `LeaveRequestStore`. No new API contracts.

**Tech Stack:** Angular 21 standalone, NgRx signalStore, Vitest.

**Out of scope:** Hourly ledger (`2026-09-09-leave-hourly-ledger/`, needs backend Parts 1+3). Multipart document upload (no generic files UI/API in this frontend). Policy Country/Job level (intentionally removed).

---

## File map

- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.ts`
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.html`
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.css`
- Modify: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.spec.ts`
- Modify: `src/app/modules/leave/state/leave-calendar.store.ts`
- Modify: `src/app/modules/leave/state/leave-calendar.store.spec.ts`
- Modify: `src/app/modules/leave/feature/team-calendar/team-calendar.component.ts`
- Modify: `src/app/modules/leave/feature/team-calendar/team-calendar.component.html`
- Modify: `src/app/modules/leave/feature/team-calendar/team-calendar.component.css`
- Modify: `src/app/modules/leave/feature/team-calendar/team-calendar.component.spec.ts`
- Modify: `src/app/modules/leave/ui/leave-calendar-day-detail/leave-calendar-day-detail.component.ts`
- Modify: `src/app/modules/leave/ui/leave-calendar-day-detail/leave-calendar-day-detail.component.html`
- Modify: `src/app/modules/leave/ui/leave-calendar-day-detail/leave-calendar-day-detail.component.spec.ts`

---

### Task 1: New Request wizard — review shows names, step chrome, honest document copy

**Files:** wizard `.ts` / `.html` / `.css` / `.spec.ts`

- [x] **Step 1: Failing tests** — review text contains leave type name; document note is hidden when the type does not require a document.

- [x] **Step 2: Implement** `selectedLeaveType()`, `selectedLeaveTypeName()`, step kicker `Step N of 5 · {label}`, review rows (Type name, Dates, Half day, Total, Balance), document copy only when `requiresDocument`.

- [x] **Step 3: Run** `npx ng test --no-watch --include=src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.spec.ts`

- [x] **Step 4: Commit** `fix(leave): show leave type name on request review`

---

### Task 2: Team Calendar — department filter + include pending

**Files:** `leave-calendar.store.ts` + spec, `team-calendar.component.*`

- [x] **Step 1: Failing tests** — `setIncludeTentative(true)` reloads with `includeTentative=true`; calendar page exposes a department select and a pending checkbox.

- [x] **Step 2: Implement** `includeTentative` on the store and pass it from `load()`. Calendar toolbar: department `<select>` from unique `departmentId`/`departmentName` on the loaded month, calling `store.setDepartmentFilter`. Checkbox calls `setIncludeTentative`.

- [x] **Step 3: Run** store + team-calendar specs.

- [x] **Step 4: Commit** `feat(leave): filter team calendar by department and pending`

---

### Task 3: Request leave from a calendar day

**Files:** day-detail component, team-calendar feature

- [x] **Step 1: Failing tests** — day detail emits `requestLeave` with the day date; calendar opens the existing wizard with start/end prefilled.

- [x] **Step 2: Implement** `requestLeave` output + "Request leave" button. Team calendar hosts `NewLeaveRequestWizard` with `initialStartDate`/`initialEndDate` inputs, loads leave types + my balances + request store (same as Balances).

- [x] **Step 3: Run** day-detail + team-calendar + wizard specs.

- [x] **Step 4: Commit** `feat(leave): start a leave request from a calendar day`

---

### Not this plan

- Hourly leave (days → hours) — blocked on backend.
- File upload for sick notes — blocked on a files module.
- Playwright golden-path expansion — after Tasks 1–3 if time remains.
