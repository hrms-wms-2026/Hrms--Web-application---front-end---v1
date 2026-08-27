# Work Management: Project Calendar (frontend) — design

**Status:** next. **Pairs with the backend spec:**
`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-25-work-management-project-calendar-design.md` — read
it first, this doc assumes its endpoint shapes.

## 1. What this is

A new project-level tab: every Objective ("module") in the project rendered as a start/end date bar on a
timeline. Users can drag a bar's edges (resize) or the whole bar (shift) to adjust an Objective's dates.
Users can select several bars and group them into a colored "Event" for visual correlation — grouped bars
take the event's color; ungrouped accessible bars use the theme accent color; bars the user can't edit are
grayed out and not draggable.

## 2. Routing — convert the existing "Calendar" stub to project-level

There is already a "Calendar" sub-menu tab (`work.routes.ts:41-46`, `MilestoneSubMenuComponent`'s
`BASE_TABS`), currently milestone-scoped (`milestones/:milestoneId/calendar`) and pointing at
`MilestoneComingSoonTabComponent`. **This feature converts it to project-level, exactly the way Board and
Backlog were already converted — commit `f74e9d5 feat: move board and backlog to project scope` is the
precedent to mirror, do not invent a different approach:**

1. `work.routes.ts`: remove the `calendar` child from under `milestones/:milestoneId`, add a new sibling
   route `calendar` directly under `:id` (alongside `board`/`backlog`/`settings`), `loadComponent` pointing
   at the new `ProjectCalendarComponent`.
2. `milestone-sub-menu.component.ts`: move the `{ label: 'Calendar', segment: 'calendar' }` entry from
   `BASE_TABS`'s milestone-scoped position to carry `projectLevel: true`, same as the `Board`/`Backlog`
   entries directly above it in that same array. Its icon (`@case ('calendar')`) already exists, keep it
   unchanged.
3. Update `work.routes.spec.ts` and `milestone-sub-menu.component.spec.ts` to match (same two files that
   commit `f74e9d5` touched for Board/Backlog — check that commit's diff for the exact assertion shape to
   mirror).

Do not touch or repurpose the frontend files for `MilestoneComingSoonTabComponent` itself — it's still used
by `my-task`/`list`, which stay stubs.

## 3. Backend contract this depends on

- `GET /api/v1/work/projects/{projectId}/calendar` → array of
  `{objectiveId, projectId, parentObjectiveId, title, startDate, endDate, isActive, isAchieved, canEdit,
  calendarEventId, calendarEventColor}` for **every** Objective in the project (not just ones the caller
  owns).
- `PUT /api/v1/work/objectives/{id}` (existing edit endpoint) for saving a drag — body must include the
  Objective's current `title`, `description`, `allocatedHours` alongside the new `startDate`/`endDate` (a
  full update, not a date-only patch — keep the full Objective object in the store, not just its dates).
  Response has an `applied: boolean` — `true` means the bar's new position is now real; `false` means the
  edit didn't apply (it queued as a pending change request per the backend's parent-containment rule) and
  the bar must **revert to its last-saved position**, with a message that this module's edit needs
  approval (not a generic error toast — the user specifically wants to know which module and why).
- `POST /api/v1/work/projects/{projectId}/calendar-events` `{name, color, objectiveIds}`.
- `PATCH /api/v1/work/calendar-events/{id}` `{name?, color?, objectiveIds?}`.
- `POST /api/v1/work/calendar-events/{id}/close`.

## 4. Folder structure (follow existing WM conventions exactly)

- `feature/project-calendar/project-calendar.component.ts(+.html/.spec.ts)` — the routed page.
- `ui/objective-timeline-bar/objective-timeline-bar.component.ts` — one bar: renders the date range,
  handles drag-resize (edges) and drag-shift (whole bar), shows gray/disabled when `!canEdit`.
- `ui/calendar-event-modal/calendar-event-modal.component.ts` — create/edit an Event: name, color picker,
  multi-select of visible Objectives (respects `canEdit`? No — grouping doesn't require edit rights, see
  backend spec §6; any Objective the user can *see* on the calendar can be added to an Event).
- `ui/calendar-event-legend/calendar-event-legend.component.ts` — list of active Events with their colors,
  a "Close" action per event.
- `data-access/calendar-api.service.ts` — `getProjectCalendar(projectId)`, `createEvent(...)`,
  `updateEvent(...)`, `closeEvent(id)`. Reuse the existing `objectiveApiService`'s edit method for date
  saves — don't duplicate it here.
- `state/project-calendar.store.ts` — `@ngrx/signals` store, same pattern as `project-detail.store.ts` /
  `task-board.store.ts`.

## 5. Drag interaction and color rules

- No calendar/Gantt/date-range library exists in this project (`package.json` has none) and
  `@angular/cdk`'s drag-drop (already used for the Kanban board) doesn't provide resizable date bars — the
  timeline bar needs custom pointer-event logic (`pointerdown`/`pointermove`/`pointerup` on the bar body for
  whole-bar shift, and on two small edge handles for resize), translating pixel delta to date delta based
  on the timeline's day-width. This is genuinely new code, not a library wire-up.
- **Immediate save per drag** (user's explicit choice, made specifically because batched saves would make
  it unclear which module's edit failed the parent-containment check). On `pointerup`, call the edit
  endpoint right away; while the request is in flight the bar shows a saving state; on `applied: false`,
  animate back to the last-saved position and surface a per-bar "pending approval" indicator (e.g. a small
  badge on that bar), not a page-level toast — the whole point is knowing exactly which module.
- Color precedence per bar, in order: (1) `!canEdit` → gray, disabled, no drag handles at all (backend
  already guarantees a drag would be rejected anyway — don't let the UI promise otherwise); (2)
  `calendarEventColor` set → that hex color; (3) otherwise → the app's existing theme accent color
  (`--color-accent` from `theme-tokens.css`), not a per-objective distinct color — there is no
  `Objective.Color` field and this feature doesn't add one.
- `isAchieved` Objectives: always non-draggable regardless of `canEdit` (mirrors the backend's own
  `EditObjectiveCommandHandler` guard) — show a distinct "achieved" affordance (e.g. a checkmark on the
  bar) rather than plain gray, so it doesn't read as "no access" when it's actually "done."

## 6. Testing

- `objective-timeline-bar.component.spec.ts`: renders correct color per the precedence in §5, disabled
  bars don't emit drag events, resize vs. shift produce the correct new date range, `applied:false`
  response reverts position.
- `project-calendar.store.spec.ts`: load populates state correctly including event colors, optimistic
  update + rollback on rejected drag.
- `calendar-event-modal.component.spec.ts`: create/edit flow, color input, objective multi-select.
- `work.routes.spec.ts` / `milestone-sub-menu.component.spec.ts`: updated per §2.
- Run `npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"` green before every commit.

## 7. Explicit non-goals

- Personal (per-user) calendar — deferred, not built.
- Any `Objective.Color` field or per-objective distinct coloring outside of Event membership.
- Task-level bars (`WorkTask` has no `startDate`).
