# Milestone Cards, Tree View Page, and Edit/Achieve — Design

**Status:** Approved 2026-08-10 (brainstormed same day). No plan written yet. Spans both repos — see the backend-side addendum: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-10-milestone-ownership-and-subtree-access-design.md`.

## Problem

Project Detail's milestone section (`ProjectDetailComponent`) currently renders `My Project Milestones` as a flat read-only list — no card layout, no actions, and clicking a milestone expands its subtree tree inline on the same page (`2026-08-08-work-management-projects-milestones-design.md` explicitly scoped this as "read-only, no action buttons on any node this round").

## Requirement

1. Milestone section becomes a grid of cards, one per milestone.
2. Each card: **View** (always visible) and — only when the current user is that milestone's owner (Head) — **Edit** and **Achieve/Unachieve**.
3. **View** navigates to a dedicated Milestone Detail page showing the milestone's subtree as a tree.

## Backend dependency (blocking)

Two gaps found while checking existing APIs — both need the backend addendum spec above implemented first:
1. `GetMyProjectMilestones` doesn't tell the frontend which milestones the caller owns (no `userId` is exposed anywhere in the frontend's session state either) → backend adds a server-computed `isOwner: boolean`, same pattern as `Project.isLead`.
2. `GetObjectiveSubtree` (the tree endpoint) is Head-only today — a non-owner clicking View would get `403` → backend loosens it to the membership-fallback pattern already used by `GetObjective`/`GetObjectiveTree`.

## Component architecture (per `docs/core/ARCHITECTURE.md` §2/§4, `PROCESS_RULES.md` rule 6)

Follows the existing `feature → ui → state → data-access` layering exactly as `ProjectFormModalComponent`/`ProjectListComponent` already do — no new pattern introduced:

| Component | Layer | Responsibility |
|---|---|---|
| `MilestoneCardComponent` | `ui/` | Presentational. Inputs: `milestone: Milestone`. Outputs: `viewed`, `editRequested`, `achieveRequested`. No store injection, no API calls — mirrors `ProjectCardComponent`. |
| `MilestoneFormModalComponent` | `ui/` | Presentational. Inputs: `open`, `initialValue: MilestoneDetail \| null`, `submitting`, `errorMessage`. Output: `submitted` (payload), `closed`. Mirrors `ProjectFormModalComponent` exactly (signals for each field, effect-based prefill/reset). |
| `ProjectDetailComponent` | `feature/` | Smart container, unchanged role — now also renders `MilestoneCardComponent` grid instead of the flat list, owns the Edit-modal-open/Achieve-confirm-open local `signal()`s, wires card outputs to store methods. |
| `MilestoneDetailComponent` (new) | `feature/` | New route target. Reads `:projectId`/`:objectiveId` from `ActivatedRoute`, calls `store.loadMilestoneSubtree(objectiveId)` on init, renders header + existing `MilestoneTreeNodeComponent`. |
| `ProjectDetailStore` | `state/` | Gains `getMilestoneDetail(id)`, `editMilestone(id, payload)`, `achieveMilestone(id)`, `unachieveMilestone(id)`. Reuses existing `selectedSubtree`/`subtreeLoading`/`subtreeError` state as-is — no new store. |
| `ProjectApiService` | `data-access/` | Gains `getObjectiveById(id)`, `editObjective(id, payload)`, `achieveObjective(id)`, `unachieveObjective(id)` — mirrors the Project equivalents already there. |

## Screens

### Project Detail (`/work/:id`) — milestone section

Grid of `MilestoneCardComponent`: title, owner name, reporting manager name, dates, hours, achieved badge. **View** always shown, routes to `/work/:projectId/milestones/:objectiveId`. **Edit**/**Achieve**/**Unachieve** shown only when `milestone.isOwner` (new field from the backend addendum).

### Milestone Detail (`/work/:projectId/milestones/:objectiveId`) — new page

Header: title, dates, hours, achieved state. Below: `MilestoneTreeNodeComponent` rendering `store.selectedSubtree()`, fetched via the now-membership-gated `GetObjectiveSubtree`. Same four-state pattern (loading/error/empty/data) as the rest of the module (`ARCHITECTURE.md` §7.4).

### Milestone Form Modal (Edit only — no create; milestones aren't created standalone)

Opens from a card's Edit button. **Fetches the full Objective detail via `GetObjective` before opening** — the same fix just applied to Project's Edit flow for the identical class of bug (list-row data lacking `description`); `Milestone`/`GetMyProjectMilestones` also lacks `description`, so this must be done from the start here, not discovered as a bug later. Fields: title, description, start/end date, allocated hours. Submits via `EditObjective`; response is `200` (applied immediately) or `202` (pending change request routed to the Reporting Manager, since the milestone's Head isn't always its creator) — these render distinct messages, not both treated as "success."

### Achieve / Unachieve confirm modal

Reuses `ConfirmModalComponent`, same toggle pattern as `ProjectListComponent`'s existing achieve/unachieve. Surfaces the `400` ("a direct sub-milestone isn't yet Achieved") case inline, same as Achieve Project already does.

## Error handling

Nothing new beyond the module's existing error taxonomy (`ARCHITECTURE.md` §7) plus the two milestone-specific cases already covered above (Edit's `200`/`202` split, Achieve's `400`).

## Out of scope

- Milestone create/delete/member-management/transfer-head — not requested, existing endpoints untouched.
- Change-request approval UI (Reporting Manager approving a pending Edit/Achieve) — separate feature, not part of this ask.

## Testing

Standard TDD per component/store, matching existing conventions (Vitest + Angular TestBed), mirroring the test structure already in place for `ProjectFormModalComponent`/`ProjectListComponent`/`ProjectApiService`.
