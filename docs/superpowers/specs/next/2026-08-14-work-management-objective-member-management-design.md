# Work Management — Objective Member Management (Invite/Accept) — Frontend Design

**Status:** Designed, pending implementation planning. Depends on the backend slice landing first (or alongside) — see `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-14-work-management-objective-member-management-design.md`.

**Scope guardrail:** `src/app/modules/work/**` only. Do not touch `organization`, `layouts/main-layout`, `public`, or any admin/platform module — a teammate owns those. The existing `GET /api/v1/employees` (Core HR) is consumed read-only as the people-picker source; no Core HR file is touched.

**Origin:** brainstormed live with the user 2026-08-14 via `superpowers:brainstorming`.

---

## 1. Goal

Give the Work Management module a real member-management UI: a "Member" button on the objective/milestone card (top corner, per the user's mockup) opening a popup for add/remove/leader-transfer, "Request pending" tags for anything not yet accepted, and a members/leader picker at objective-creation time. Consumes the new backend endpoints from the linked backend design.

## 2. New data-access

New `objective-member-api.service.ts` in `work/data-access/`, alongside the existing `project-api.service.ts` (not merged into it — distinct resource, matches this module's one-service-per-resource convention already seen with `project-category-api.service.ts`):

- `getObjectiveMembers(objectiveId)` → `GET /objectives/{id}/members`
- `addObjectiveMember(objectiveId, userId)` → `POST /objectives/{id}/members`
- `removeObjectiveMember(objectiveId, userId)` → `DELETE /objectives/{id}/members/{userId}` (backend handles the real-member-vs-pending-invite branch; frontend doesn't need to know which case it is)
- `transferObjectiveHead(objectiveId, newHeadUserId)` → `POST /objectives/{id}/transfer` (existing endpoint, unchanged call shape)
- `acceptInvitation(invitationId)` / `rejectInvitation(invitationId)` → the two new invitation-decision endpoints
- `getMyInvitations()` → `GET /objectives/invitations/mine`

`project-api.service.ts`'s `createObjective()` payload type gains the optional `memberInvitations: { userId: string; type: 'member' | 'leader' }[]` field.

## 3. New models/DTOs

- `ObjectiveMemberDto` (real): `userId`, `name`, `avatarUrl`, `isHead`, `joinedAt`.
- `ObjectiveInvitationDto` (pending): `invitationId`, `userId`, `name`, `avatarUrl`, `inviteType`, `invitedAt`, `pending: true`.
Both render in the same list; pending ones get the "Request pending" tag from `inviteType`/`pending`, not a separate list.

## 4. New UI components (`work/ui/`)

- **`member-button`** — small icon button pinned to the card's top corner (per the uploaded mockup), opens the members popup. Optional count badge.
- **`objective-members-popup`** — lists real members (head gets a "Leader" badge) + pending invites ("Request pending" tag). Actions: Add member (opens the people-picker against `GET /api/v1/employees`, read-only use of the Core HR API), Remove/Cancel per row (single action, backend disambiguates), Transfer leadership (sub-picker → `transferObjectiveHead`).
- **`my-invitations-panel`** (placement TBD — see open item below) — surfaces the caller's own pending invitations from `getMyInvitations()`, with Accept/Reject actions.

## 5. Objective creation flow

Extend the existing `create-sub-module-modal` component with an optional members/leader picker step, wired to `memberInvitations` on the create payload. Creator becomes owner immediately (backend rule, unchanged); the picker only queues invitations, it never grants immediate access.

## 6. State

Extend `project-detail.store.ts` (or add a dedicated members slice if the store is getting large — call this at implementation-plan time by checking current file size) with `members`, `pendingInvitations`, and actions `addMember`, `removeMember`, `transferHead`, `acceptInvitation`, `rejectInvitation`.

**Known gap to avoid repeating:** the existing `editMilestone()` action already returns `{ success, pending }`, but `project-detail.component.ts` (`onMilestoneSettingsSaved`) only checks `success` and silently drops `pending` — so a user editing a milestone into a pending-approval state gets no different feedback than an immediate save. For this feature, `pending` is the *expected, common* outcome (every add/leader-transfer starts pending), not an edge case — the UI must surface it explicitly (the "Request pending" tag *is* that surfacing), so this mistake is structurally harder to repeat here, but call it out during implementation review on this component specifically.

## 7. Testing

Match existing `*.spec.ts` conventions per component/store: 202-pending path, 204 no-op path (already-active member), 409 conflict (duplicate invite), remove-vs-cancel branching, accept for `member` vs `leader` type, reject no-op (current head unchanged).

## 8. Placement decision — `my-invitations-panel`

A top-nav notification bell is outside Work Management's scope (shared shell, not this module). Default: a small bell/badge icon in the Work module's own toolbar on the Project List page (`work/feature/project-list`), opening a slide-over panel listing pending invitations with Accept/Reject actions — entirely inside module boundaries, no shared-shell changes. Revisit only if the user wants it surfaced somewhere more global later.
