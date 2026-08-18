# Work Management — Task Foundation (Task Board, Approvals, Notification) — Frontend Design

**Status:** Designed, pending implementation planning.

**Scope guardrail:** Work Management module only — `src/app/modules/work/**` plus the two genuinely-shared additions this design requires: the navbar notification bell (`layouts/main-layout/top-navbar/**`, currently a static non-functional button — no other module owns it, it's dead UI) and a new generic `core/services/notification-api.service.ts` (mirrors the backend's Shared-Platform placement of `notifications`/`notification_templates`). Do not touch any other feature module.

**Origin:** brainstormed live with the user 2026-08-16 via `superpowers:brainstorming`, companion to the backend design at `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-16-work-management-task-foundation-design.md` — read that first for the API contracts this UI consumes.

**Builds on:** the layered pattern established by `docs/superpowers/plans/finished/2026-08-10/2026-08-10-milestone-cards-and-tree-view/` (`data-access/*-api.service.ts` → `state/*.store.ts` NgRx Signal Store → `feature/*` smart pages → `ui/*` dumb components).

---

## 1. Current-state findings (verified against code)

- `work.routes.ts` already has route **stubs** for `milestones/:id/board` and `milestones/:id/backlog`, both currently `loadComponent`-ing the same placeholder `MilestoneComingSoonTabComponent`. This design's job for those two routes is to swap the `loadComponent` target to a real component — no new route paths needed.
- The milestone sub-menu (`ui/milestone-sub-menu/milestone-sub-menu.component.ts`) lists five tabs: Tree, Board, Backlog, My Task, List. This design adds a **sixth tab, Approvals**, plus a new route segment `milestones/:id/approvals`.
- No approvals/requests list page exists anywhere today — Objective invitations are shown inline on `ProjectListComponent` via `ui/my-invitations-panel/`, not as a routed page. This design's Approvals tab is the first dedicated approvals page in the app.
- The navbar bell (`top-navbar.component.html`) is a static button + badge with no click handler and no data binding — this design wires it up for real.
- No `@angular/cdk` dependency exists yet — required for Board drag-and-drop (`@angular/cdk/drag-drop`), added as a new `package.json` dependency.
- Design tokens: all new component styling must use `var(--color-...)` tokens from `shared/styles/theme-tokens.css` (dark/light theme compatibility is not optional), and follow the existing elevation levels (`docs/design/COMPONENT_SHADOWS_AND_ELEVATION.md`) for cards/columns/popups.

## 2. Board tab (`milestones/:id/board`)

Kanban board for one Objective's tasks, grouped by `task_statuses.display_order`.

- `data-access/task-api.service.ts` — wraps `GET .../task-statuses`, `GET .../tasks`, `PATCH .../tasks/{id}/status`.
- `state/task-board.store.ts` — NgRx Signal Store, `withState`/`withComputed`/`withMethods`, same `error: null` → try/catch → `extractError` pattern as the existing milestone store. Computed: `columnsWithTasks` (statuses joined with their tasks, ordered by `display_order`).
- `feature/task-board/task-board.component.ts` — smart page: loads statuses + tasks on init, renders one `ui/task-board-column/` per status.
- `ui/task-board-column/` — dumb component, hosts `cdkDropList` (one per column) + `ui/task-card/` per task, `cdkDrag`.
- `ui/task-card/` — dumb, shows title, priority, assignee avatar, due-date chip, estimated-hours chip.
- Drop handler in `task-board.component.ts` calls `store.moveTask(taskId, newStatusId)` → optimistic UI move + `PATCH .../tasks/{id}/status`, revert on error via existing toast service (`core/services/notification.service.ts` — the pre-existing ephemeral toast service, unrelated to and not renamed for the new persistent Notification feature in §5).
- `ui/task-create-modal/` — opened from a column's "+" button. Objective owner: submits directly (`POST .../tasks`); non-owner member: same form, submits to `POST .../task-creation-requests` instead — same modal component, the store method chosen based on `isObjectiveOwner` (already available from the existing objective-detail store). On `409 INSUFFICIENT_OBJECTIVE_ALLOCATION`, the modal shows the returned `availableSlackHours` and an inline "Request more allocation" link that opens `ui/allocation-extend-modal/` (§4) pre-filled with the shortfall.

## 3. Backlog tab (`milestones/:id/backlog`)

Flat, filterable task table for the Objective (no Sprint concept — deferred per backend §1). Reuses `task-api.service.ts`/`task-board.store.ts` from §2 with a `view=backlog` query flag (matches the backend's single-endpoint, `view`-param shaping). `feature/task-backlog/task-backlog.component.ts` renders `ui/task-table/` (sortable columns: title, status, assignee, due date, estimated hours) instead of the Kanban layout. Same `ui/task-create-modal/` reused for the "+ Add task" action.

## 4. Approvals tab (`milestones/:id/approvals`) — new sixth sub-menu tab

- `ui/milestone-sub-menu/` — add the sixth `routerLink` entry.
- `data-access/work-approvals-api.service.ts` — wraps `GET /objectives/allocation-requests/mine`, `GET .../task-creation-requests` (pending, for objectives the caller owns), plus the existing (already-built) `GET /objectives/invitations/mine` and `GET .../objective-change-requests/mine` so this becomes the **one page** for every kind of Work Management approval, per the original ask.
- `state/work-approvals.store.ts` — loads all four lists in parallel on tab activation; `withComputed` for `pendingCount` (badge source, also feeds the navbar notification count if the caller wants a live total — out of scope to unify further in this slice).
- `feature/work-approvals/work-approvals.component.ts` — smart page, one section per request kind (Task Creation Requests / Allocation Requests / Objective Change Requests / Objective Invitations), each row using a shared `ui/approval-request-row/` (title/description, requester, Approve/Reject buttons, decision-comment field where required) so the four sections share one presentational component instead of four near-duplicates.
- Allocation-request rows: Approve action surfaces the backend's `409 APPROVER_INSUFFICIENT_SLACK` inline ("You don't have enough allocation yourself — request more from your manager first") with a link into `ui/allocation-extend-modal/` for the approver's *own* objective, rather than a generic error toast — this is the one place the cascading-approval UX (backend §4) becomes visible to the user.

## 5. Notification (navbar bell)

- `core/services/notification-api.service.ts` — new, generic (not under `modules/work/`): `GET /api/v1/notifications`, `GET .../unread-count`, `POST .../{id}/read`, `POST .../read-all`.
- `core/state/notifications.store.ts` — new, generic signal store: unread count (polled every 60s while the tab is open — no real-time/websocket infra exists or is being added in this slice) + recent list for the dropdown.
- `layouts/main-layout/top-navbar/notification-bell/` — new component replacing the static button: badge bound to `unreadCount()`, click opens a dropdown (`ui/notification-dropdown/`) listing recent notifications (title/body/relative-time, click-through via `related_entity_type`/`related_entity_id` to the Task/Approval it references — Task rows link into the Board tab with that task highlighted; request rows link into the Approvals tab), mark-as-read on open (per-item) and a "mark all read" action.

## 6. Out of scope / explicitly not this slice

- Any calendar UI — Work Management's only calendar-facing surface is the backend's `GET /my-deadlines`; no frontend page consumes it in this slice (the Calendar module, teammate-owned, is expected to consume it from its own UI later).
- Real-time notification push (websocket/SignalR) — polling only, matching the backend's non-implementation of `INotificationDispatcher`'s realtime-shaped interface (it's a DB-write today, not a live push).
- `task_approvals` status-transition-approval UI (drag bypass rules) — deferred with the backend.
- My Task / List tabs — unchanged, out of scope for this slice (they're separate existing stubs not touched here).
