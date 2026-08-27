# Work Management: Task Clock-in/Push Time Tracking, Edit/Status History, and My Task page (frontend) — design

**Status:** next. **Pairs with the backend spec:**
`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-25-work-management-task-time-tracking-and-my-task-design.md`
— read it first, this doc assumes its endpoint shapes.

## 1. What this is

- A new project-level **My Task** tab: tasks assigned to the current employee, with an internal Board/List
  view toggle, a Sprint filter, and a task-name search — sorted nearest-deadline-first by default.
- A shared **Clock-in/Push widget**, surfaced on My Task, Board, and Backlog task cards/rows alike.
- An extended **task detail** view showing the merged edit/status/clock/percentage history feed, visible to
  every project member (not owner-gated).

## 2. Routing — convert the `my-task` stub to project-level, retire the separate `list` stub

Same conversion Board/Backlog/Calendar already went through — **commit `f74e9d5 feat: move board and
backlog to project scope`** is the precedent to mirror, do not invent a different approach:

1. `work.routes.ts`: remove both the `my-task` and `list` children from under `milestones/:milestoneId`
   (lines 30–40). Add one new sibling route `my-task` directly under `:id`, alongside `board`/`backlog`/
   `calendar`/`settings`, `loadComponent` pointing at the new `MyTaskComponent`. Do not add a separate
   `list` route — the approved design merges List into My Task's internal view toggle.
2. `milestone-sub-menu.component.ts`: `My Task` tab (`BASE_TABS` line 16) gets `projectLevel: true`, same
   as Board/Backlog/Calendar directly above/below it. **Remove the `List` tab entry (line 17) entirely** —
   its icon `@case ('list')` block (lines 58–63) can stay unused in the switch (harmless dead case) or be
   removed; removing it is cleaner and matches how this file has no other unused cases.
3. Update `work.routes.spec.ts` and `milestone-sub-menu.component.spec.ts` — same two files
   `f74e9d5` touched for Board/Backlog, check that commit's diff for the exact assertion shape to mirror.
   Also check for any spec asserting the `list` tab currently exists/renders and remove or update it.
4. As of this spec, `work.routes.ts` only points `MilestoneComingSoonTabComponent` at `my-task` and
   `list` (lines 30–40) — both are being removed by step 1, which leaves the component with zero
   remaining routes. Re-check `work.routes.ts` at implementation time in case another tab started using it
   in the meantime; if it's genuinely unused, deleting the component file is in scope for this plan (not a
   separate cleanup) since this plan is what orphans it.

## 3. Backend contract this depends on

- `GET /api/v1/work/projects/{projectId}/my-tasks?sprintId={guid?}` → `WorkTaskResponse[]`, already sorted
  nearest-deadline-first (do not re-sort client-side; do apply the client-side task-name text filter here,
  it has no server param).
- `GET /api/v1/work/tasks/{id}/history` → merged timeline feed (edit / status-change / clock-session /
  percentage-change entries, push-sourced percentage entries pre-nested under their session — see backend
  spec §6).
- `POST /api/v1/work/tasks/{id}/clock-in` → 204, or 409 if the task already has an open session or is
  locked at 100%.
- `POST /api/v1/work/tasks/{id}/push` `{percent, reason?}` → 200 with the updated `WorkTaskResponse`, or
  400 if `percent` isn't strictly greater than the task's current percentage.
- `PATCH /api/v1/work/clocking-sessions/{id}/reason`, `PATCH /api/v1/work/percentage-log/{id}/reason` —
  the after-the-fact optional note, both `{reason: string}` → 204.
- `PATCH /api/v1/work/tasks/{id}` (existing `EditTaskCommand` route) — payload gains an optional
  `progressPercent`; this is how a task gets unlocked after hitting 100%, and how a reviewer adjusts %
  without a clock session. Also gains an optional `reason` string.
- `POST /api/v1/work/tasks/{taskId}/edit-requests` (existing) — payload also gains `progressPercent` for
  the non-owner path.

## 4. Folder structure (follow existing WM conventions exactly)

- `feature/my-task/my-task.component.ts(+.html/.spec.ts)` — the routed page. Holds the Board/List toggle
  state, Sprint filter, and search input; fetches via a new `getMyTasks(projectId, sprintId?)` method on
  the existing `task-api.service.ts` (same service Board/Backlog already use, don't create a parallel
  service).
- Board view: reuse `TaskBoardComponent`'s column-rendering internals if it's structured to accept a task
  list as an input (check before assuming — if it currently self-fetches project-wide tasks internally, it
  needs a small refactor to accept a pre-filtered list, since My Task's board must show only the caller's
  tasks grouped by status, not everyone's). List view: new, modeled on `TaskBacklogComponent`'s row
  layout.
- `ui/task-clock-widget/task-clock-widget.component.ts` — the shared Clock-in/Push control. Inputs:
  `task: WorkTaskResponse`, `hasOpenSessionMine: boolean`, `isLockedAt100: boolean`. Emits `clockIn`/`push`
  events; the Push action opens a small inline percentage-entry popup (not a full modal — matches "popup"
  in the requirement) validating `percent > task.progressPercent` client-side before calling the API (the
  backend re-validates regardless). Disabled/greyed state when `isLockedAt100` (with a tooltip explaining
  why), and when another employee currently holds the task's open session (task-level lock, not
  employee-level — show whose session it is if the API exposes it, otherwise just "in progress"). Used on
  My Task cards/rows, `TaskBoardComponent` cards, and `TaskBacklogComponent` rows — one component, three
  call sites.
- `ui/task-history-feed/task-history-feed.component.ts` — renders the merged history from §3's `.../history`
  endpoint inside `task-detail-modal.component.ts`. Four row-kinds (edit/status-change/clock-session/
  percentage-change), timestamp + actor name + a one-line summary per kind; percentage-change rows show
  the optional reason if present, with an inline "add a note" affordance if it's missing and the viewer
  was the one who caused that entry (calls the `PATCH .../reason` endpoints from §3).
- `task-detail-modal.component.ts` — add the history feed section, and (if the task's caller is an
  assignee) the clock widget, matching where the Priority/DueDate/EstimatedHours fields already render.

## 5. Sort/filter behavior

- Default list order matches the backend's `DueDate ascending NULLS LAST, Priority descending` — do not
  add a client-side secondary sort that could disagree with it.
- Sprint filter: dropdown sourced from the same sprint list Backlog's filter bar already loads for this
  project (reuse the store, don't refetch) — "All Sprints" (default, omits `sprintId` from the query) plus
  one entry per sprint.
- Task search: plain client-side substring filter over `title`/`shortId` on the already-fetched list — no
  new backend param, matches how Board/Backlog's existing search-if-any behaves (check their filter bar
  for the existing pattern before adding a new one).

## 6. Edge cases in UI

- Clock-in button disabled with explanation when: task locked at 100%, task's open session belongs to
  someone else, or caller isn't one of the task's assignees (My Task's own list can't produce this case,
  but the same widget renders on Board/Backlog where it can).
- Push popup blocks submission client-side when the entered percent isn't strictly greater than current
  (mirrors the backend's 400), with the current percent shown for reference.
- A 409 from Clock-in (race: someone else's session opened between page load and click) surfaces as a
  toast and refreshes that one card's state, not a full page reload.
- History feed empty-state: "No changes yet" rather than blank, since this section is new on every
  existing task the first time this ships.

## 7. Explicitly out of scope

- A project-wide (not "mine") task list — no standalone `list` route, per §2.
- Any visual/theme pass beyond matching existing Board/Backlog/Calendar component styling (Plan A, the
  separate WM-wide visual redesign, is still not started and unrelated to this work).
