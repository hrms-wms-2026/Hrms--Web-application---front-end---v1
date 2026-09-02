# WM Event Duration & Hybrid Membership — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Work Management UI for dated calendar Events with hybrid Module/Task membership: an event editor with a date range and a module-tree-with-expandable-tasks picker, a Project Calendar timeline that draws event bands and colours member module bars by their event (with partial-membership segments), removal of the "My Task" page, and a People filter on the Board and Backlog.

**Architecture:** Angular standalone components + `@ngrx/signals` stores. The calendar read DTO changes from a flat per-objective list to `{ modules: [...with events[]], bands: [...] }`. The event editor emits dates + `objectiveIds` + `taskIds`. Board/Backlog gain a client-side assignee filter alongside the existing module/sprint/category filters. "My Task" route, page, and nav tab are deleted; deep-links repoint to `board?assignee=<me>`.

**Tech Stack:** Angular (standalone, signals), `@ngrx/signals`, Tailwind utility classes + CSS custom properties, Jasmine/Karma specs.

**Spec:** `docs/superpowers/specs/next/2026-09-02-work-management-event-duration-and-hybrid-membership-design.md`. **Calendar timeline visual reference:** the approved mockup `Option B revised` — event band as translucent scenery behind normal per-module rows; a module in an event is drawn in the event's colour; a module in no event is neutral grey; a partial module shows a coloured "N/M in event" sub-segment with the remainder dashed-grey; a module in two events splits into two coloured segments.

## Global Constraints

- **Branch:** `feature/wm-event-duration-hybrid-membership`, cut from `feature/wm-approval-hours-and-component-tuning`. Do not push.
- **Depends on the backend plan** (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-09-02-...-backend.md`) being merged/available: the reshaped `GET /work/projects/{id}/calendar` payload and the dated event create/update contracts. Do not start Tasks 2–5 until the backend endpoints return the new shapes (Task 1 and Task 6 have no backend dependency).
- **No dev-server runs, no push, no process kills** (standing project rules). Verify via `npm test` (Karma headless) only.
- Work-module code lives under `src/app/modules/work/`. Follow the existing standalone-component + signal-store patterns already in that folder.
- Every component/store change ships with its `.spec.ts` updated in the **same commit**. One commit per task.
- Per the same-commit doc rule, update `docs/core/ARCHITECTURE.md`'s `work/` component list in the task that adds/removes a component.
- End every commit message with:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- Colour input rule unchanged: `^#[0-9A-Fa-f]{6}$`. Event name ≤ 255.

---

## Task 1: Remove the "My Task" page + repoint deep-links

**No backend dependency.** Do this first.

**Files:**
- Delete: `src/app/modules/work/feature/my-task/my-task.component.ts`
- Delete: `src/app/modules/work/feature/my-task/my-task.component.spec.ts`
- Modify: `src/app/modules/work/work.routes.ts` (remove the `my-task` route)
- Modify: `src/app/modules/work/work.routes.spec.ts` (drop the my-task assertion)
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts` (remove the `My Task` tab + its `@case ('my-task')` icon block)
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts` (grep for `my-task` — remove any tab wiring)
- Keep: `src/app/modules/work/data-access/task-api.service.ts` `getMyTasks(...)` **only if** something else still calls it — grep first; if `my-task.component.ts` was the sole caller, delete `getMyTasks` and its `.spec` expectations too.
- Grep the whole repo for `routerLink` / `navigate` targets containing `my-task` (dashboard widgets, notification navigation) and repoint them to `['..', 'board']` with `queryParams: { assignee: <currentEmployeeId> }`.

**Interfaces:**
- Produces: no `my-task` route; `board` route accepts an optional `?assignee=<employeeId>` query param (consumed in Task 6).

- [ ] **Step 1: Grep every reference**

```bash
cd src/app && grep -rn "my-task\|MyTask\|getMyTasks\|my_task" --include=*.ts --include=*.html .
```
List every hit. Anything outside `feature/my-task/` and `milestone-sub-menu` and `work.routes` is a deep-link to repoint or a shared API method to check.

- [ ] **Step 2: Delete the feature folder**

```bash
git rm src/app/modules/work/feature/my-task/my-task.component.ts \
       src/app/modules/work/feature/my-task/my-task.component.spec.ts
```

- [ ] **Step 3: Remove the route**

In `work.routes.ts` delete the whole `{ path: 'my-task', loadComponent: ... }` object.

- [ ] **Step 4: Remove the nav tab**

In `milestone-sub-menu.component.ts` delete the line
`{ label: 'My Task', segment: 'my-task', projectLevel: true },` from `BASE_TABS`
and the entire `@case ('my-task') { ... }` block inside the icon `@switch`.

- [ ] **Step 5: Repoint deep-links**

For each deep-link found in Step 1 (e.g. a dashboard "my tasks" card, `getWorkNotificationNavigation` mapping), change the target to the board route with the assignee query param. Example pattern:
```typescript
this.router.navigate(['/work', projectId, 'board'], { queryParams: { assignee: this.currentEmployee.id() } });
```

- [ ] **Step 6: Update specs**

`work.routes.spec.ts` — remove the test asserting a `my-task` child route exists (or invert it to assert it does **not**). `milestone-sub-menu.component.spec.ts` — drop `My Task` from the expected tab labels. If `getMyTasks` was deleted, remove its `task-api.service.spec.ts` case.

- [ ] **Step 7: Run the affected specs**

```bash
npm test -- --include='**/work.routes.spec.ts' --watch=false
npm test -- --include='**/milestone-sub-menu.component.spec.ts' --watch=false
```
Expected: PASS. Then a full `npm test -- --watch=false` to catch dangling imports.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/modules/work docs/core/ARCHITECTURE.md
git commit -m "feat: remove My Task page, repoint deep-links to board filtered by assignee"
```

---

## Task 2: Calendar DTOs + API service for the new payload shape

**Depends on backend Task 4.**

**Files:**
- Modify: `src/app/modules/work/models/dto/calendar.dto.ts`
- Modify: `src/app/modules/work/data-access/calendar-api.service.ts`
- Modify: `src/app/modules/work/data-access/calendar-api.service.spec.ts` (if present; else create)

**Interfaces:**
- Produces:
  ```typescript
  export interface ProjectCalendarEventLinkDto {
    eventId: string; eventName: string; eventColor: string;
    eventStartDate: string; eventEndDate: string;
    membership: 'whole' | 'partial';
    tasksInEventCount: number; taskTotalCount: number;
  }
  export interface ProjectCalendarModuleDto {
    objectiveId: string; projectId: string; parentObjectiveId: string | null;
    title: string; startDate: string; endDate: string;
    isActive: boolean; isAchieved: boolean; canEdit: boolean;
    events: ProjectCalendarEventLinkDto[];
    description?: string | null; allocatedHours?: number;
  }
  export interface ProjectCalendarEventBandDto {
    eventId: string; name: string; color: string;
    startDate: string; endDate: string; canEdit: boolean;
  }
  export interface ProjectCalendarDto {
    modules: ProjectCalendarModuleDto[];
    bands: ProjectCalendarEventBandDto[];
  }
  export interface CalendarEventDto {
    id: string; projectId: string; name: string; color: string;
    status: 'active' | 'archived' | string;
    startDate: string; endDate: string;
    objectiveIds: string[]; taskIds: string[];
    createdAt?: string; archivedAt?: string | null;
  }
  export interface CreateCalendarEventRequestDto {
    name: string; color: string; startDate: string; endDate: string;
    objectiveIds: string[]; taskIds: string[];
  }
  export interface UpdateCalendarEventRequestDto {
    name?: string; color?: string; startDate?: string; endDate?: string;
    objectiveIds?: string[]; taskIds?: string[];
  }
  ```
  Keep `CalendarDateChange` / `CalendarDateSaveResult` unchanged (still used for module-bar drag → `editObjective`).

- [ ] **Step 1: Rewrite `calendar.dto.ts`** to the interfaces above. Delete `ProjectCalendarItemDto` (replaced by `ProjectCalendarModuleDto`).

- [ ] **Step 2: Update `calendar-api.service.ts`** — `getProjectCalendar` returns `Observable<ProjectCalendarDto>`:
```typescript
getProjectCalendar(projectId: string): Observable<ProjectCalendarDto> {
  return this.http.get<ProjectCalendarDto>(`${this.projectsBase}/${projectId}/calendar`);
}
```
`createEvent` / `updateEvent` signatures are unchanged (payload types widened above).

- [ ] **Step 3: Spec** — update/create `calendar-api.service.spec.ts` with an `HttpTestingController` expectation that `getProjectCalendar` GETs `/work/projects/:id/calendar` and deserialises a `{ modules, bands }` fixture. Add a create-event expectation asserting the POST body carries `startDate`, `endDate`, `taskIds`.

- [ ] **Step 4: Run** `npm test -- --include='**/calendar-api.service.spec.ts' --watch=false` — expect PASS (compile-only if no assertions changed behaviour).

- [ ] **Step 5: Commit**
```bash
git add src/app/modules/work/models/dto/calendar.dto.ts src/app/modules/work/data-access/calendar-api.service.ts src/app/modules/work/data-access/calendar-api.service.spec.ts
git commit -m "feat: calendar DTOs for dated events, hybrid membership, module/band read shape"
```

---

## Task 3: `ProjectCalendarStore` — hold modules + bands, dated event create/update

**Depends on Task 2.**

**Files:**
- Modify: `src/app/modules/work/state/project-calendar.store.ts`
- Modify: `src/app/modules/work/state/project-calendar.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectCalendarDto`, `CalendarEventDto`, `Create/UpdateCalendarEventRequestDto` (Task 2).
- Produces (store state + methods):
  - state: `modules: readonly ProjectCalendarModuleDto[]`, `bands: readonly ProjectCalendarEventBandDto[]`, `events: readonly CalendarEventDto[]` (derived from bands for the modal's edit list), plus the existing `loading/saving/error/pendingObjectiveIds/approvalMessages`.
  - `load(projectId)` — sets `modules` + `bands` from the payload; `events` built from `bands` (`id/name/color/status:'active'/startDate/endDate`; `objectiveIds`/`taskIds` filled from `modules[].events` where `membership==='whole'` → objectiveIds, and from a new `moduleTaskLinks` note — see Step 3).
  - `createEvent(payload: CreateCalendarEventRequestDto): Promise<boolean>`
  - `updateEvent(id, payload: UpdateCalendarEventRequestDto): Promise<boolean>`
  - `closeEvent(id): Promise<boolean>` — unchanged behaviour (drop the event from `bands` + mark archived).
  - `saveDates(change)` — **unchanged** (module-bar drag still calls `editObjective`).
  - new: `saveEventDates(eventId, startDate, endDate): Promise<boolean>` — event-band drag → `updateEvent(eventId, { startDate, endDate })`.

- [ ] **Step 1: Failing spec**

Rewrite `project-calendar.store.spec.ts` load test to feed a `{ modules, bands }` fixture and assert `store.modules().length`, `store.bands().length`, and that `activeEvents()` reflects the bands. Add:
```typescript
it('saveEventDates PATCHes the event start/end and refreshes the band', async () => {
  // arrange calendarApi.updateEvent spy returning a dated CalendarEventDto
  await store.saveEventDates('evt-1', '2026-03-05', '2026-04-02');
  expect(calendarApi.updateEvent).toHaveBeenCalledWith('evt-1', { startDate: '2026-03-05', endDate: '2026-04-02' });
  expect(store.bands().find(b => b.eventId === 'evt-1')!.endDate).toBe('2026-04-02');
});

it('createEvent sends dates + taskIds and reloads the calendar', async () => {
  await store.createEvent({ name: 'R', color: '#112233', startDate: '2026-03-01', endDate: '2026-03-31', objectiveIds: ['m1'], taskIds: ['t9'] });
  expect(calendarApi.createEvent).toHaveBeenCalled();
  // simplest correctness guarantee: store calls load(projectId) again after a successful create
  expect(calendarApi.getProjectCalendar).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Rewrite the store**

- Replace `ProjectCalendarState.items` with `modules`; add `bands`.
- `load()`:
  ```typescript
  const payload = await firstValueFrom(calendarApi.getProjectCalendar(projectId));
  patchState(store, {
    modules: payload.modules,
    bands: payload.bands,
    events: bandsToEvents(payload),
    loading: false
  });
  ```
  where `bandsToEvents(payload)` maps each band to a `CalendarEventDto` and fills `objectiveIds` = modules whose `events` contains this band with `membership==='whole'`. `taskIds` cannot be reconstructed from the read payload (it only has counts) — set `taskIds: []` here; the modal re-fetches exact task ids on open (Task 4 Step 4). Document this with a comment.
- `createEvent` / `updateEvent`: after a successful API call, **call `this.load(projectId)`** to refresh `modules` + `bands` rather than hand-patching membership (the old `replaceEventMembership` helper cannot express partial/whole/2-event states — delete it and `eventFromItems`). Keep optimistic `error` clearing.
- Add `saveEventDates(eventId, startDate, endDate)` calling `updateEvent(eventId, { startDate, endDate })`.
- `editableItems` computed → rename to `editableModules`, filter `modules().filter(m => m.canEdit && !m.isAchieved)`.
- Keep `saveDates`, `clearApprovalMessage`, `pendingSet` as-is (module date drag path unchanged).

- [ ] **Step 4: Run — expect PASS.** `npm test -- --include='**/project-calendar.store.spec.ts' --watch=false`

- [ ] **Step 5: Commit**
```bash
git add src/app/modules/work/state/project-calendar.store.ts src/app/modules/work/state/project-calendar.store.spec.ts
git commit -m "feat: calendar store holds modules and event bands, dated event create/update"
```

---

## Task 4: Event editor — date range + hybrid Module/Task picker

**Depends on Tasks 2–3.**

**Files:**
- Modify: `src/app/modules/work/ui/calendar-event-modal/calendar-event-modal.component.ts`
- Modify: `src/app/modules/work/ui/calendar-event-modal/calendar-event-modal.component.spec.ts`
- Modify: `src/app/modules/work/data-access/task-api.service.ts` — reuse `getTasks(objectiveId)` (exists: `GET /work/objectives/:id/tasks`) to load a module's tasks on expand.
- Reference (read before editing): the approved mockup behaviour in this plan's header.

**Interfaces:**
- Consumes: `getTasks(objectiveId)` → `WorkTaskDto[]` (has `id`, `title`, `dueDate`).
- Inputs: `event: CalendarEventDto | null`, `modules: readonly ProjectCalendarModuleDto[]`.
- Output `save`: `CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto` — now includes `startDate`, `endDate`, `objectiveIds` (whole-module ticks), `taskIds` (individual ticks).

- [ ] **Step 1: Failing spec**

In `calendar-event-modal.component.spec.ts`:
```typescript
it('requires a start and end date and end >= start', () => {
  component.name.set('R'); component.color.set('#112233');
  component.startDate.set('2026-03-31'); component.endDate.set('2026-03-01');
  expect(component.valid()).toBeFalse();
  component.endDate.set('2026-04-01');
  component.selectedObjectiveIds.set(new Set(['m1']));
  expect(component.valid()).toBeTrue();
});

it('emits objectiveIds for whole-module ticks and taskIds for individual ticks', () => {
  component.name.set('R'); component.color.set('#112233');
  component.startDate.set('2026-03-01'); component.endDate.set('2026-03-31');
  component.selectedObjectiveIds.set(new Set(['m1']));
  component.selectedTaskIds.set(new Set(['t7', 't8']));
  const spy = spyOn(component.save, 'emit');
  component.submit();
  expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
    startDate: '2026-03-01', endDate: '2026-03-31',
    objectiveIds: ['m1'], taskIds: ['t7', 't8']
  }));
});

it('locks a module’s task checkboxes when the whole module is ticked', () => {
  component.selectedObjectiveIds.set(new Set(['m1']));
  expect(component.isTaskLocked('m1')).toBeTrue();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Rebuild the component state**

Replace `selectedIds` with:
```typescript
readonly startDate = signal('');
readonly endDate = signal('');
readonly selectedObjectiveIds = signal<Set<string>>(new Set());
readonly selectedTaskIds = signal<Set<string>>(new Set());
readonly expanded = signal<Set<string>>(new Set());            // module ids whose task list is open
readonly moduleTasks = signal<Record<string, WorkTaskDto[]>>({}); // lazy-loaded per module

readonly valid = () =>
  this.name().trim().length > 0 &&
  /^#[0-9A-Fa-f]{6}$/.test(this.color()) &&
  !!this.startDate() && !!this.endDate() && this.endDate() >= this.startDate() &&
  (this.selectedObjectiveIds().size > 0 || this.selectedTaskIds().size > 0);

isTaskLocked = (objectiveId: string) => this.selectedObjectiveIds().has(objectiveId);
```
Methods: `toggleObjective(id)`, `toggleTask(id)`, `toggleExpand(objectiveId)` (on first expand, call `taskApi.getTasks(objectiveId)` and store in `moduleTasks`), `moduleCheckState(objectiveId): 'checked' | 'indeterminate' | 'unchecked'` (indeterminate when some but not all of that module's loaded tasks are in `selectedTaskIds` and the module itself isn't ticked).

- [ ] **Step 4: Populate on edit**

In the `effect` that reacts to `event()`: set `startDate`/`endDate` from the event; set `selectedObjectiveIds` from `event.objectiveIds`. Because the read payload can't supply exact `taskIds` (Task 3 Step 3), when `event()` is non-null call the calendar API once for the full event (`taskIds` come back on `CalendarEventDto` from create/update responses; for an event opened cold, fetch via a new `calendarApi.getEvent(id)` **only if** the backend exposes one — if not, accept that editing an existing event starts with its task ticks empty and document this as a known limitation to revisit).

- [ ] **Step 5: Template**

- Add a two-column date row (`<input type="date">` bound to `startDate` / `endDate`).
- Replace the flat "Objectives" checkbox list with a module tree: each module row = expand chevron + checkbox (`moduleCheckState`) + title. Expanded rows render their `moduleTasks()[objectiveId]` as indented task rows with a checkbox each, `disabled` when `isTaskLocked(objectiveId)`.
- Keep it inside the existing `max-h-56 overflow-y-auto` container; bump to `max-h-72`.
- Error text updated: "Enter a name, a valid #RRGGBB colour, a start and end date, and select at least one module or task."

- [ ] **Step 6: `submit()`**

```typescript
const payload = {
  name: this.name().trim(),
  color: this.color().toUpperCase(),
  startDate: this.startDate(),
  endDate: this.endDate(),
  objectiveIds: [...this.selectedObjectiveIds()],
  taskIds: [...this.selectedTaskIds()]
};
this.save.emit(payload);
```

- [ ] **Step 7: Surface backend 409s**

The parent (`project-calendar.component`) already funnels store `error()` to a banner. Ensure the modal keeps rendering `error()` (from an `@Input()` or the store) so R1/R2/R3 messages ("Task(s) fall outside the event window…") show near the actions. No new logic — just verify the wiring after Task 5.

- [ ] **Step 8: Run — expect PASS.** `npm test -- --include='**/calendar-event-modal.component.spec.ts' --watch=false`

- [ ] **Step 9: Commit**
```bash
git add src/app/modules/work/ui/calendar-event-modal docs/core/ARCHITECTURE.md
git commit -m "feat: event editor gains date range and hybrid module/task picker"
```

---

## Task 5: Project Calendar timeline — event bands + event-coloured module bars

**Depends on Tasks 2–4.**

**Files:**
- Modify: `src/app/modules/work/feature/project-calendar/project-calendar.component.ts`
- Modify: `src/app/modules/work/feature/project-calendar/project-calendar.component.spec.ts`
- Modify: `src/app/modules/work/ui/objective-timeline-bar/objective-timeline-bar.component.ts` (+ `.spec` if present)
- Modify: `src/app/modules/work/ui/calendar-event-legend/calendar-event-legend.component.ts`
- Modify: `src/app/modules/work/utils/calendar-tree.utils.ts` + `.spec.ts` (ordering helper — now also needs to emit band rows / group order)
- Modify: `src/app/modules/work/utils/calendar-date.utils.ts` + `.spec.ts` (add a "does date-range A intersect B" + "clamp range to window" helper for the coloured sub-segment)
- Reference: the mockup behaviour in this plan's header.

**Interfaces:**
- Consumes: `store.modules()`, `store.bands()` (Task 3).
- Produces: `calendar-date.utils` gains `intersectRanges(aStart, aEnd, bStart, bEnd): { start: string; end: string } | null` and `rangeToPercent(start, end, windowStart, windowEnd): { leftPct: number; widthPct: number }`.

- [ ] **Step 1: Failing utils spec**

`calendar-date.utils.spec.ts`:
```typescript
it('intersectRanges returns the overlap or null', () => {
  expect(intersectRanges('2026-03-01','2026-03-31','2026-03-20','2026-04-10'))
    .toEqual({ start: '2026-03-20', end: '2026-03-31' });
  expect(intersectRanges('2026-03-01','2026-03-10','2026-03-20','2026-03-25')).toBeNull();
});
```

- [ ] **Step 2: Implement the utils, run — expect PASS.**

- [ ] **Step 3: Failing component spec**

`project-calendar.component.spec.ts`: feed a store with one band + three modules (whole / partial / none) and assert:
```typescript
it('renders one band row per active event', () => {
  // bands: [A, B]  -> expect 2 elements [data-testid="calendar-event-band"]
});
it('colours a whole-member module bar with the event colour', () => {
  // module m1 events:[{eventId:A, membership:'whole', eventColor:'#111111'}]
  // expect the bar host style / class to carry #111111
});
it('renders a partial module as a coloured sub-segment plus a dashed remainder', () => {
  // module m2 events:[{membership:'partial', tasksInEventCount:2, taskTotalCount:5, eventColor:'#222222'}]
  // expect a [data-testid="calendar-bar-segment"] with width from intersectRanges and a "2/5" label
});
it('leaves a module in no event neutral grey', () => { /* m3 events: [] */ });
```

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Implement the rendering**

- `project-calendar.component.ts`: iterate `store.modules()` for the per-module rows (unchanged row source — module dates still drive bar position). Behind them, for each `store.bands()` entry, draw a translucent rectangle spanning `rangeToPercent(band.startDate, band.endDate, windowStart, windowEnd)` tinted `band.color` at ~12% alpha, labelled `band.name`, with a drag handle that calls `store.saveEventDates(band.eventId, newStart, newEnd)` (reuse the existing drag maths from the module-bar drag; only the commit call differs). Gate the handle on `band.canEdit`.
- `objective-timeline-bar.component.ts`: accept the module's `events: ProjectCalendarEventLinkDto[]`. Rendering rules:
  - `events` empty → current neutral style (grey).
  - one `whole` link → paint the whole bar `event.eventColor`.
  - `partial` link(s) → base bar dashed-grey; overlay a coloured segment per link positioned by `intersectRanges(module.startDate, module.endDate, link.eventStartDate, link.eventEndDate)` then `rangeToPercent(...)`, filled `link.eventColor`, with a small `{{link.tasksInEventCount}}/{{link.taskTotalCount}}` label.
  - multiple links → stack/segment them along the bar, each in its own `eventColor` (no blending).
- `calendar-event-legend.component.ts`: legend entries now come from `store.bands()` (name + colour swatch), plus a static "No event" grey swatch.
- `calendar-tree.utils.ts`: `buildCalendarTreeOrder()` keeps ordering modules by tree position; add nothing for bands (they render in `bands` array order = event `createdAt`). Adjust its spec to the `ProjectCalendarModuleDto` shape.

- [ ] **Step 6: Wire the modal inputs**

`project-calendar.component.ts` passes `[modules]="store.modules()"` to `app-calendar-event-modal` (was `[items]`), and on `save` calls `store.createEvent(...)` / `store.updateEvent(id, ...)` with the now-dated payload. On failure the store sets `error()`, already shown.

- [ ] **Step 7: Run — expect PASS.**
```bash
npm test -- --include='**/project-calendar.component.spec.ts' --include='**/calendar-date.utils.spec.ts' --include='**/calendar-tree.utils.spec.ts' --watch=false
```

- [ ] **Step 8: Commit**
```bash
git add src/app/modules/work/feature/project-calendar src/app/modules/work/ui/objective-timeline-bar src/app/modules/work/ui/calendar-event-legend src/app/modules/work/utils/calendar-date.utils.ts src/app/modules/work/utils/calendar-date.utils.spec.ts src/app/modules/work/utils/calendar-tree.utils.ts src/app/modules/work/utils/calendar-tree.utils.spec.ts docs/core/ARCHITECTURE.md
git commit -m "feat: project calendar draws event bands and event-coloured module bars"
```

---

## Task 6: People filter on Board + Backlog

**No hard backend dependency** — filtering is client-side, consistent with the existing module/sprint/category filters. (Backend plan Task 7 adds a server-side `assigneeEmployeeIds` param; this plan does not require it. Keep Task 7 only if another client needs server-side filtering.)

**Files:**
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/work/ui/people-filter-select/people-filter-select.component.ts` (+ `.spec.ts`) — a multi-select dropdown of project members. Model it on `ui/module-filter-select/` but multi-select (checkbox list in a popover; emits `string[]`).
- Reference: `ui/module-filter-select/module-filter-select.component.ts`, `ui/employee-picker/employee-picker.component.ts` (member list source), `ui/employee-avatar/`.
- Modify: `docs/core/ARCHITECTURE.md`.

**Interfaces:**
- `PeopleFilterSelectComponent`: `options = input<{ employeeId: string; name: string }[]>()`, `selected = input<string[]>()`, `selectionChanged = output<string[]>()`.
- Board/Backlog: new `assigneeFilter = signal<string[]>([])`; a task passes when `assigneeFilter().length === 0 || task.assigneeEmployeeIds.some(id => assigneeFilter().includes(id))`.

- [ ] **Step 1: Build `PeopleFilterSelectComponent`**

Standalone component: a button showing "People" / "People (n)"; on click opens a checkbox list of `options()`; each toggle emits the new `string[]`. Reuse `employee-avatar` for rows if convenient. Spec: toggling two options emits `['a','b']`; clearing emits `[]`.

- [ ] **Step 2: Failing board spec**

`task-board.component.spec.ts`:
```typescript
it('filters columns by selected assignees', () => {
  // store.tasks(): t1 assignee A, t2 assignee B, t3 unassigned
  component.setAssigneeFilter(['A']);
  const ids = component.columnsWithTasks().flatMap(c => c.tasks.map(t => t.id));
  expect(ids).toEqual(['t1']);
});
it('empty assignee filter shows all tasks', () => {
  component.setAssigneeFilter([]);
  expect(component.columnsWithTasks().flatMap(c => c.tasks).length).toBe(3);
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement on Board**

- Add `assigneeFilter = signal<string[]>([])` and `setAssigneeFilter(ids: string[]) { this.assigneeFilter.set(ids); }`.
- Fold the assignee test into the existing `columnsWithTasks()` / filtered-tasks computed alongside `objectiveFilter` / `sprintFilter` / `categoryFilter`.
- Add `<app-people-filter-select [options]="memberOptions()" [selected]="assigneeFilter()" (selectionChanged)="setAssigneeFilter($event)" />` to `.task-board__toolbar`. `memberOptions()` from the project members already available to the board (grep `assignableMembers` / `EmployeeDirectoryStore`).
- **Deep-link:** in `ngOnInit`, read `this.route.snapshot.queryParamMap.get('assignee')`; if present, `this.assigneeFilter.set([thatId])` so the repointed My-Task links land pre-filtered.

- [ ] **Step 5: Implement on Backlog**

Same `assigneeFilter` signal + control in `.task-backlog__toolbar`; fold into the sprint/table task filtering computed(s). Same `?assignee=` deep-link read.

- [ ] **Step 6: Run — expect PASS.**
```bash
npm test -- --include='**/task-board.component.spec.ts' --include='**/task-backlog.component.spec.ts' --include='**/people-filter-select.component.spec.ts' --watch=false
```

- [ ] **Step 7: Commit**
```bash
git add src/app/modules/work/feature/task-board src/app/modules/work/feature/task-backlog src/app/modules/work/ui/people-filter-select docs/core/ARCHITECTURE.md
git commit -m "feat: people filter on board and backlog, honours ?assignee deep-link"
```

---

## Task 7: Task "in event" chip (read-only)

**Depends on backend Task 5 (`WorkTaskResponse.activeEventId` / `activeEventName`).**

**Files:**
- Modify: `src/app/modules/work/models/dto/task.dto.ts` + `src/app/modules/work/models/task.model.ts` + `src/app/modules/work/utils/task.mapper.ts` — carry `activeEventId?: string | null`, `activeEventName?: string | null`.
- Modify: `src/app/modules/work/ui/task-card/task-card.component.ts` and/or `src/app/modules/work/ui/task-table/task-table.component.ts` — render a small chip `{{ task.activeEventName }}` when `activeEventName` is set.
- Modify the matching `.spec.ts` files.

- [ ] **Step 1: Add the fields** to the DTO, model, and mapper (pass-through, default `null`).
- [ ] **Step 2: Failing spec** — a task with `activeEventName: 'Release 2.1'` renders an element `[data-testid="task-event-chip"]` containing that text; a task without it renders none.
- [ ] **Step 3: Implement the chip** in `task-card` (board) and `task-table` (backlog/list). Style with a neutral pill using `--color-surface-secondary`.
- [ ] **Step 4: Run the affected specs — expect PASS.**
- [ ] **Step 5: Commit**
```bash
git add src/app/modules/work/models src/app/modules/work/utils/task.mapper.ts src/app/modules/work/ui/task-card src/app/modules/work/ui/task-table
git commit -m "feat: show an in-event chip on task card and task table rows"
```

---

## Task 8: Full verification

- [ ] **Step 1:** `npm run lint` (if configured) — fix any new violations in touched files only.
- [ ] **Step 2:** `npm test -- --watch=false` — entire suite green. Record the pass count.
- [ ] **Step 3:** `npm run build` — production build succeeds with no new type errors.
- [ ] **Step 4: Manual browser pass (user-run, not agent).** Provide the user this checklist:
  - Create an event with a start/end date, one whole module + two tasks from another module → saves; appears as a band on the calendar; member module bars carry the event colour; the partial module shows "2/5".
  - Drag the event band → dates update; drag it so a member task falls outside → `409` banner.
  - Board + Backlog: pick two people in the People filter → only their cards show; open the repointed old My-Task link → board opens pre-filtered to the current user.
  - `work/:id/my-task` → 404 / redirect (route gone); no "My Task" tab in the sub-menu.
- [ ] **Step 5:** After the user signs off, move both plan files `next/ → finished/` in each repo and update the `plans/next/SUMMARY.md` files.

---

## Self-review notes (author)

- **Spec coverage:** §6.1 → T1; §7.1 editor → T4; §7.2 timeline → T5 (+ DTO/store in T2/T3); §6.2 frontend → T6; §7.3 task chip → T7. §7.3 doc updates folded into each task's ARCHITECTURE.md edit.
- **Known limitations flagged in-plan:** T4 Step 4 — editing a cold-opened existing event starts with empty task ticks unless the backend exposes `GET /work/calendar-events/{id}` (not in the backend plan; add there if this matters). T3 Step 3 — the calendar read payload carries counts, not task ids, so the store cannot reconstruct exact `taskIds`; create/update responses do carry them.
- **Deliberate divergence from spec §6.2:** the People filter is client-side (matches every sibling filter on Board/Backlog); backend Task 7 is therefore optional. Called out for the reviewer.
- **Type consistency:** `ProjectCalendarModuleDto` / `ProjectCalendarEventLinkDto` / `ProjectCalendarEventBandDto` defined in T2, consumed unchanged in T3–T5. `intersectRanges` / `rangeToPercent` defined in T5 Step 2, used in T5 Step 5.
