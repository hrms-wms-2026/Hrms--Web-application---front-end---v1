# Sensitive Position Approval + Change Position Action Menu — Frontend Design

**Status:** Approved by user 2026-08-17, ready for implementation planning. Revised same day: the position-access-modal "Approving Position" picker from v1 is removed entirely (backend v2 uses a fixed `roles:manage` permission, not a per-position configurable approver) — replaced with a self-position-change block and an inline sensitivity reminder.

**Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-sensitive-position-approval-backend-design.md`.

**Origin:** brainstormed live with the user 2026-08-17, triggered by testing the just-shipped Change Position modal live.

## 1. Goal

Turn "Change Position" into a proper action menu (Promotion / Transfer / Offboarding-disabled) that's unavailable on your own record, shows a clear reminder when the target position is sensitive, and gives `roles:manage` holders an inbox to act on the resulting approval requests.

## 2. Current-state facts this design depends on

- `change-position-modal.component.ts` (built in the employee-detail-screen sub-project) already has the position-picker + effective-date form. It also has a live bug fixed during this session's manual testing: `pageSize: 200` exceeded the backend's max of 100 — already corrected, not otherwise touched by this spec beyond what's below.
- **No approving-position picker is needed anywhere** (v1's addition to `position-access-modal.component.ts` is dropped) — the backend companion's approver model is now a fixed permission, not configured per position.
- **No Approvals UI exists anywhere in the frontend today** — `PeopleApiService.approveAccessGrantRequest`/`rejectAccessGrantRequest` exist but have zero component callers (confirmed by repo-wide search). This spec builds that page from scratch.
- `employee-detail.component.ts` currently always renders the "Change Position" button when the caller holds `employees:write` on the route — it has no concept yet of "is this my own record," since self-service profile editing is a completely separate page (`/me` self-service, different component). This spec adds that check specifically to the Change Position button.

## 3. Change Position action menu

`employee-detail.component.ts`'s single "Change Position" button becomes a small dropdown menu (reuse whatever existing dropdown/menu UI component this app already has for similar cases — check `shared/ui/` before building a new one):

- **Promotion** — opens `change-position-modal` with `changeReason` locked to `"Promotion"`.
- **Transfer** — opens the same modal with `changeReason` locked to `"Transfer"`.
- **Offboarding** — visible but disabled, tooltip "Not yet available" (same explicit-unavailable pattern already used for Schedule/Shift in the Add Employee wizard).

**Self-position-change block:** the entire Change Position button/menu is hidden (not just disabled) when `employee.id` on the detail page equals the caller's own employee id. The caller's own employee id needs to be available client-side already (used by the self-service `/me` flows) — reuse whatever store/service already holds it (e.g. the auth/session store) rather than adding a new API call just for this check. This is a UX convenience only — §5's backend handler enforces the real rule regardless of what the frontend shows.

## 4. Sensitivity reminder

The position picker inside `change-position-modal.component.ts` already lists positions via `PositionApiService.listFlat` (backend companion §9 adds `requiresApproval` to that response). When the selected position has `requiresApproval: true`, the modal shows an inline notice above the Save button: *"This position requires approval. Your request will be sent to an approver and won't take effect until approved."* The Save button's label changes from "Save" to "Send for approval" in that state, so it's never ambiguous whether the action is immediate.

On submit, if the backend responds with the pending-request shape (§5, backend companion) rather than an immediate success, the modal closes with a distinct confirmation toast ("Sent for approval") instead of the current "Position updated" one.

## 5. Approvals inbox (new)

New route, `/people/approvals` (or wherever this app's existing nav groups admin-review surfaces — check `people.routes.ts`'s structure before picking a path), route-gated on `roles:manage` (matches the backend endpoint's gate exactly — no separate frontend-only permission invented). New feature component, `approvals-list.component.ts`, following `employee-list.component.ts`'s established shape (loading/error/empty/loaded states, `OnPush`, presentational child table).

Calls `GET /api/v1/onboarding/access-grant-requests/pending-for-me` (backend companion §8). Each row: employee name (or "New hire: {name}" for onboarding requests where `employeeId` is still null), target position, change reason (blank for onboarding rows), requested by, requested at, Approve/Reject buttons wired to the already-existing `PeopleApiService.approveAccessGrantRequest`/`rejectAccessGrantRequest` (finally getting real callers). Reject prompts for an optional note (`DecisionNote`, already a backend field). A caller viewing this page can never see their own submitted requests actionable here in a way that lets them approve them — enforced server-side (backend companion §6), but the row itself can still show if they're the requester so the UI isn't confusing (e.g. render Approve/Reject as disabled with "You submitted this request" instead of just letting the click fail).

Nav entry: add "Approvals" under the existing People section, gated the same as the route (`roles:manage`) — no separate visibility heuristic needed since the permission itself is now the complete gate.

## 6. Job Journey tab on Employee Detail

`employee-detail.component.ts` already has a manual-signal tab pattern (`activeTab = signal<'job'|'personal'|'emergency'|'payroll'>('job')`) — gains a fifth tab, `'journey'`. New presentational component, `employee-job-journey.component.ts`, following the existing section components' shape (`employee-job-info.component.ts` etc. — `input.required<...>()`, `OnPush`, no direct API access). Calls a new `PeopleApiService.getJobJourney(employeeId)` (backend companion §10) and renders a vertical timeline, oldest first: position name, department, date range (or "Present" when `effectiveTo` is null), the change reason as a small badge (nothing shown for the hire entry), and "Changed by {InitiatedByName}" plus, when present, "Approved by {ApprovedByName}".

## 7. Testing

Component specs for: the action-menu dropdown (each item opens the modal with the right locked `changeReason`, Offboarding stays disabled, menu is absent entirely when viewing own record), the modal's sensitivity reminder (shows/hides based on `requiresApproval`, Save label changes, pending-response leads to the distinct toast), `approvals-list.component.ts` (loading/empty/loaded, approve/reject call the right endpoint with the right id, own-submitted-request rows render disabled rather than actionable), and `employee-job-journey.component.ts` (renders entries oldest-first, hire entry has no reason badge, approved-by only shown when present).

## 8. Self-review

- No placeholders — every piece traces to either an existing component being extended or a named new one with a clear responsibility.
- v1's Approving-Position picker section is fully removed, not left dangling alongside the new model.
- Scope: the self-position-change block here is UX-only by design (§3 says so explicitly) — the real enforcement lives in the backend companion, called out so this isn't mistaken for the actual security boundary.
- §6 (Job Journey) was added after the user asked directly whether `ChangeReason` was actually visible anywhere — it was being captured but never shown; closed in this revision rather than deferred.
