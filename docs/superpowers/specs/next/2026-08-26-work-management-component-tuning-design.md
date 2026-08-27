# Work Management: Approvals UI, Reusable Components, and Form Consolidation — design

**Status:** next. **Pairs with the backend plan:**
`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-26-work-management-completed-hours-cascade.md`
— that plan is backend-only and independent of everything in this doc; nothing here depends on it landing
first.

## 1. What this is

Confirmed via user conversation 2026-08-26, after auditing the current frontend against the intended
approval workflow. Two problems, one initiative:

1. **Approvals page is missing its write path.** It already lists everything the caller can act on
   (`WorkApprovalsComponent` — task creation, allocation, objective change, invitations — backed by
   `ListPendingForApproverAsync`, which is already global across every objective the caller approves for,
   not scoped to one module). What's missing: a way to *originate* a request from the page itself, and a
   way to adjust the requested hours before approving. `approval-request-row.component.ts:25` has a literal
   `TODO` for this: `<!-- TODO: wire POST /objectives/{myOwnObjectiveId}/allocation-requests once caller
   objective lookup exists -->` — the caller-objective-lookup endpoint this was waiting on already exists
   (`GET /work/projects/{projectId}/objectives/mine`), so this was always closeable, just never finished.
2. **Forms are duplicated or under-featured across the module tree, sprint, and member-management
   surfaces**, and Task detail is a modal when it should be a dedicated page. This is not a correctness bug
   in most cases (Task Create/Task Detail are already properly shared, see Part 3) — it's real duplication
   in three specific places (Part 4, Part 5, Part 6), plus a missing shared-component layer underneath all
   of it (Part 1) that the eventual consolidation should build on instead of repeating the same mistake.

Terminology note for whoever implements this: **"Module" is the display name for what the code and API
still call "Objective" or, in older files, "Milestone."** These are the same entity — a display-only rename
already shipped (see `f44cb5a`..`0211d5f` in git log). Do not create a second rename effort. New UI copy
should say "Module"; new component/file/variable names should keep following the existing code convention
(`objective`/`milestone` in code, per whichever the surrounding file already uses).

## 2. Why seven parts, and why in this order

Each part below ships and is testable independently — no part blocks on a later one. Suggested execution
order (not a hard dependency, but the sensible one): **B1 → B2 → B4 → B5 → B6 → B3 → B7**. B1 first because
B2/B4/B5/B6 all touch dropdowns/tabs/cards that B1 standardizes — doing them after B1 avoids re-touching the
same template twice. B3 (Task detail modal→page) is scoped last among the feature work because it's the
largest single change and touches the most call sites (4 trigger points). B7 (deep test pass) is last by
definition — it audits everything the other six parts touched.

## Part B1 — Reusable component foundation

**Problem, cited:** dropdowns exist three separate ways today — `shared/ui/select/select.component.ts`
(`app-select`, the real shared primitive), `modules/work/ui/work-dropdown/work-dropdown.component.ts`
(`app-work-dropdown`, a work-module-only reimplementation with icon variants, wrapped again by
`module-filter-select.component.ts` for the filter bar), and raw native `<select>` markup used directly
inside `task-create-modal` and `sprint-create-form`. There is no shared Tabs component anywhere in the
codebase (only an ad-hoc `preference-subtab.model.ts` local to `preferences-modal`). Cards are inconsistent:
`shared/ui/card/` (`app-card`) exists but `project-card`, `task-card`, and `project-explanation-card` are
all custom-styled and don't use it.

**Scope:**
- Pick one dropdown as canonical. Recommendation: extend `shared/ui/select/select.component.ts` (`app-select`)
  to cover `app-work-dropdown`'s icon-variant use case (check what visual variant work-dropdown actually
  needs beyond plain `app-select` before assuming a rewrite is required — it may just need an `icon` input
  added to the shared component). Migrate `module-filter-select`, `task-create-modal`, and
  `sprint-create-form` onto the resulting single component. Delete `work-dropdown.component.ts` once nothing
  references it.
- Add `shared/ui/tabs/tabs.component.ts` — a real shared Tabs primitive (label list + active index/value,
  content projection or a `[tabs]` input, matching how `shared/ui/` components are already structured, e.g.
  `card`/`modal`). Migrate `preferences-modal`'s ad-hoc sub-tab logic onto it as the first consumer, so B1
  ships with at least one proven usage, not just an unused component.
- Audit `project-card`/`task-card`/`project-explanation-card` against `app-card`'s API; migrate what
  reasonably fits, document (in this spec's follow-up plan, not here) any case where a card's layout
  genuinely can't fit `app-card`'s slot structure rather than silently leaving it un-migrated.
- This part does **not** touch `app-button`, `app-input`, `app-modal`, `app-avatar`, `app-date-picker`,
  `app-progress-bar/-ring`, `app-empty-state`, `app-error-state`, `app-loader`, `app-toast`,
  `app-page-header`, `app-breadcrumb-header`, `app-popover`, or `app-confirm-modal` — those are already
  centralized in `shared/ui/` and already reused correctly; there is no gap to close there.

## Part B2 — Approvals page: Create Approval + inline hour edit

**Scope:**
- Add a "Create Approval" button to `work-approvals.component.ts`. Clicking it opens a form (reuse
  `app-modal`) with: a module picker (the B1 canonical dropdown, populated from
  `GET /work/projects/{projectId}/objectives/mine` scoped to the current project — this already returns
  every module the caller belongs to, no new backend query needed), an hours field, and a description field.
  Submits to the existing `POST /objectives/{objectiveId}/allocation-requests` endpoint (already backed by
  `RequestAllocationExtensionCommandHandler` — confirmed unchanged, no backend gap here: requester must be
  the module's owner, per explicit user decision 2026-08-26 to keep allocation-extension requests
  owner-only, not opened to all members).
- Finish the `approval-request-row.component.ts:25` TODO: replace the dead link with a working "Request more
  allocation for my objective" action wired to the same flow as the Create Approval button above (same
  endpoint, pre-filled to the approver's own objective — this is the caller-objective-lookup the TODO was
  waiting on, which already exists).
- Add inline hour-editing to `approval-request-row.component.ts` for `kind === 'allocation_extend'` rows:
  an editable hours field (defaulting to the requested amount) shown next to Approve/Reject, so the approver
  can adjust the granted amount before approving. Confirm at implementation time whether
  `ApproveObjectiveChangeRequestCommandHandler`'s `ExtendAllocation` branch needs a new optional
  "approved hours" field on its command (it currently always grants exactly
  `extendPayload.RequestedAdditionalHours`) — if the approver should be able to grant a different amount
  than requested, this needs a small backend command change; if editing is only meant to let the approver
  correct an unreasonable ask *before* the requester's original request is stored (i.e. edit happens
  pre-submission on the requester's side, not post-submission on the approver's side), no backend change is
  needed. Resolve this ambiguity with the user before writing the implementation plan for this part — it
  changes which repo the work lands in.

## Part B3 — Task detail: modal → dedicated page, plus context-aware auto-fill

**Current state, cited:** `task-create-modal.component.ts` and `task-detail-modal.component.ts` are each
already a single shared component reused identically across all four trigger surfaces (Board, Backlog, Tree,
My Task) — this is not duplicated today, no consolidation needed on that front. What's missing:
- `work.routes.ts` has no per-task route. Add one (e.g. `task/:taskId` under the project scope, following
  the same project-level pattern the My Task/Board/Backlog routes already use — see git commit `f74e9d5`
  for the precedent on converting a milestone-scoped route to project-scoped, and the time-tracking design
  doc's §2 for the exact steps that conversion took).
- Convert `task-detail-modal.component.ts`'s content into the new page's template (dashboard-style: task
  metadata, description, status, clock widget, history feed all visible and inline-editable on one page,
  autosaving each field change rather than requiring a save button per field — confirm autosave-on-blur vs
  autosave-on-change with the user before implementing, it changes the API call pattern). Keep the modal
  version only if a genuinely modal-appropriate quick-view is still wanted somewhere (e.g. a lightweight
  hover-preview) — do not keep two full copies of the same field set.
- Context-aware auto-fill: when Task Create is triggered from inside a specific module's tree node (already
  the case in `milestone-tree-tab.component.ts`), the module field must be pre-filled and non-editable (or
  editable but pre-populated), not left blank for the user to re-select what they already navigated into.
  Audit every trigger point (Board, Backlog, Tree, My Task) for what context is already known at click time
  (module, sprint, category) and pre-fill accordingly — this is a per-trigger-point audit, not a single
  code change, since each surface knows different context.
- This part also carries the "Create" vs "Create Request" button-label gating already correctly implemented
  on the backend (`CreateTaskCommandHandler` blocks non-owners with a clear message; non-owners must use
  `CreateTaskCreationRequestCommandHandler`) — confirm the frontend already branches on this (check whether
  `task-create-modal` calls a different endpoint/shows a different button label depending on
  `IsEffectiveManagerAsync`-equivalent caller state) and close the gap if it doesn't. Same for the "child
  module has no allocated hours, suggest editing the module instead" case — the backend already returns a
  slack amount in `InsufficientAllocationResponse` on both create and approve; confirm the frontend surfaces
  that as an actionable suggestion (a link/button into the module's edit form) rather than a bare error.

## Part B4 — Sprint Create/Edit merge

**Problem, cited:** `sprint-create-form.component.ts` ("Create sprint": module + name/date fields) and
`sprint-edit-form.component.ts` ("Edit sprint": name/start/end date only) are two separately-coded
components with overlapping fields. Merge into one component parameterized by a `mode: 'create' | 'edit'`
input (or an `sprint: Sprint | null` input where `null` means create-mode), matching the "Expand Edit"
wording from the original request. Both current call sites (`task-backlog.component.ts`,
`milestone-tree-tab.component.ts`) get updated to the single component.

## Part B5 — Sub-module (Objective) Create/Edit merge

**Problem, cited:** `create-sub-module-modal.component.ts` ("Create sub Module": title/description/start
date/end date/allocated hours) and `milestone-settings-modal.component.ts` ("Module settings": identical
field set plus an Achieved checkbox) are near-duplicates sharing the same primitives (`ModalComponent`,
`InputComponent`, `ButtonComponent`) and differing only by the Achieved toggle and which DTO they post
(`CreateObjectiveRequestDto` vs `EditObjectiveRequestDto`). Merge into one component parameterized the same
way as B4, with the Achieved toggle conditionally shown only in edit mode. Both are used only from
`milestone-tree-tab.component.ts`/`.html`; update that call site to the single component.

## Part B6 — Member management popup merge

**Problem, cited:** `project-members-popup.component.ts` and `objective-members-popup.component.ts` already
correctly merge "view members" and "add member" into one popup each (the add-member concern from the
original request is already solved) — the actual duplication is that there are **two** separately-coded
popups for the same list+add UI, one project-scoped (uses `AvatarComponent`/`ProjectMemberAvatar`) and one
objective-scoped (uses `EmployeeAvatarComponent`/`EmployeeDirectoryStore`/`ObjectiveMemberItemDto`). Merge
into one component parameterized by scope (`project` vs `objective`) or by a shared member-list shape both
DTOs get mapped to before the component sees them. `member-button.component.ts` (the icon+badge trigger) and
`employee-picker.component.ts` (the add-member picker) are already correctly shared between both contexts —
no change needed there. Per the original request, this component's dropdown/select usage should be the B1
canonical dropdown, matching what the filter bar already uses.

## Part B7 — Deep test-and-fix pass

Every form touched by B2–B6, plus the new B3 task page, gets an explicit per-component test-and-manual-
verification checklist as its own plan part — not folded into B2–B6's own plans, so it isn't skipped under
time pressure the way a bundled "and write tests" step tends to be. Follow the same shape as the backend
side's existing "Part 10: mandatory deep test-coverage audit for every command handler" precedent
(`HRMS-Backend-v1` git commit `f7d74f97`) — a literal per-component checklist, each item resolved to a
pass/fail with a note, not a generic "tested and works." Include, at minimum: Create Approval end-to-end
(request → approve with edited hours → module's allocated hours actually increases), the completion-hours
cascade from the paired backend plan surfacing correctly in the module tree UI, every merged form (B4/B5/B6)
in both create and edit mode, and the new Task page's autosave behavior including a failed-save case (does
the user see the error, does the field revert or stay in an edited-but-unsaved state).

## 3. Backend contracts this depends on (all already exist — confirmed 2026-08-26, no new backend work
required for B1–B7 except the possible B2 ambiguity flagged above)

- `GET /work/projects/{projectId}/objectives/mine` — every module the caller belongs to in a project
  (owner or member, any role) — powers B2's module picker.
- `POST /objectives/{objectiveId}/allocation-requests` — existing `RequestAllocationExtensionCommandHandler`,
  owner-only requester, routes to `ReportingManagerId` (parent module's owner).
- `GET /objectives/change-requests/mine` — existing `ListMyObjectiveChangeRequestsQueryHandler`, already
  global across every objective the caller approves for via `ListPendingForApproverAsync`. Confirms the
  Approvals page's "view all requests" requirement is already met at the data layer; the only real gap is
  the write path covered by B2.
- `POST /objectives/change-requests/{requestId}/approve` / `/reject` — existing, used as-is unless B2's
  approver-can-edit-amount ambiguity resolves to "yes, change the backend."
- `GET /work/task-creation-requests/mine`, `POST .../approve`, `POST .../reject` — existing, unchanged.
