# Sensitive Position Approval + Change Position Action Menu — Frontend Design

**Status:** Approved by user 2026-08-17, ready for implementation planning.

**Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-sensitive-position-approval-backend-design.md` (backend half — this document is the frontend consumer of that API).

**Origin:** brainstormed live with the user 2026-08-17, triggered by testing the just-shipped Change Position modal live.

## 1. Goal

Turn "Change Position" into a proper action menu (Promotion / Transfer / Offboarding-disabled), and give admins a way to configure and act on sensitive-position approval: an Approving-Position picker on the position access modal, and a new Approvals inbox for whoever currently occupies an approving position.

## 2. Current-state facts this design depends on

- `change-position-modal.component.ts` (built in the employee-detail-screen sub-project) already has the position-picker + effective-date form — this design adds a `ChangeReason` field to it and a bug already existed there (`pageSize: 200` exceeding the backend's max of 100, fixed live during this session's testing) — not otherwise touched by this spec.
- `position-access-modal.component.ts` (`modules/organization/ui/position-access-modal/`) is where `RequiresApproval` is already configured today — this is where the new Approving-Position picker is added, not a new modal.
- **No Approvals UI exists anywhere in the frontend today** — `PeopleApiService.approveAccessGrantRequest`/`rejectAccessGrantRequest` exist but have zero component callers (confirmed by repo-wide search). This spec builds that page from scratch.
- `PositionApiService` (`modules/organization/data-access/`) already has the `listFlat`/`getPosition` calls needed for an approving-position picker — reused as-is, same pattern `change-position-modal.component.ts` already established for its own position dropdown.

## 3. Change Position action menu

`employee-detail.component.ts`'s single "Change Position" button becomes a small dropdown menu (reuse whatever existing dropdown/menu UI component this app already has for similar cases — check `shared/ui/` before building a new one):

- **Promotion** — opens `change-position-modal` with `changeReason` locked to `"Promotion"`.
- **Transfer** — opens the same modal with `changeReason` locked to `"Transfer"`.
- **Offboarding** — visible but disabled, with a tooltip/label "Not yet available" (same explicit-unavailable pattern already used for Schedule/Shift in the Add Employee wizard — not a fake/dead option, an honest one).

`change-position-modal.component.ts` gains a hidden/locked `changeReason` value (set by which menu item opened it, not user-editable in the modal itself) and sends it in the `ChangePositionPayload` body. If the backend responds with "request created, pending approval" (§5) rather than an immediate success, the modal shows a distinct confirmation state ("Sent for approval") instead of the current "position updated" toast.

## 4. Approving-Position picker on the position access modal

`position-access-modal.component.ts`: the existing `RequiresApproval` checkbox gets a paired "Approving position" dropdown (same position-search/picker pattern the Change Position modal already uses via `PositionApiService.listFlat`), shown only when the checkbox is checked, and required — Save is disabled/blocked with an inline validation message if checked with no selection, matching the backend validator's same rule.

## 5. Approvals inbox (new)

New route, `/people/approvals` (or wherever this app's existing nav groups admin-review surfaces — check `people.routes.ts`'s existing structure before picking a path), gated by the same route-permission pattern every other People route already uses. New feature component, `approvals-list.component.ts`, following `employee-list.component.ts`'s established shape (loading/error/empty/loaded states, `OnPush`, presentational child table).

Lists pending `AccessGrantRequest`s where the current user is a valid approver (new `GET /api/v1/onboarding/access-grant-requests/pending-for-me` endpoint — backend companion needs this read endpoint added; not in the backend spec's original scope, flagged here as a dependency the backend spec must also cover). Each row shows: employee name (or "New hire: {name}" for onboarding requests where `EmployeeId` is still null), target position, requested by, requested at, and Approve/Reject buttons calling the already-existing `PeopleApiService.approveAccessGrantRequest`/`rejectAccessGrantRequest` (finally getting real callers). A rejection prompts for an optional note (`DecisionNote`, already a field on the backend entity).

Nav entry: add "Approvals" under the existing People section, visible only when the caller currently occupies at least one position configured as an `ApprovingPositionId` somewhere (or simpler: just gate it on the same permission/route pattern as everything else and let an empty list speak for itself — implementer's call, note it either way rather than leaving ungated).

## 6. Testing

Component specs for the action-menu dropdown (each item opens the modal with the right locked `changeReason`, Offboarding stays disabled), the Approving-Position picker (required-when-checked validation), and `approvals-list.component.ts` (loading/empty/loaded, approve/reject call the right endpoint with the right id, rejection note passed through).

## 7. Self-review

- No placeholders — every piece traces to either an existing component being extended or a named new one with a clear responsibility.
- Scope: explicitly flags that the backend needs one more endpoint (`pending-for-me`) than its own spec currently lists — surfaced here rather than silently assumed to exist, since this frontend design depends on it.
