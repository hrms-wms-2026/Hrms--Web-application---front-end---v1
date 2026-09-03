# Part 6: Wire the clock widget into Board and Backlog cards/rows; finish the My Task route

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `openClockSessionEmployeeId` to `WorkTaskDto`/`WorkTask`, wire `TaskClockWidgetComponent`
into `TaskCardComponent` (Board) and `TaskTableComponent` (Backlog and My Task's list view), and flip
`work.routes.ts`'s `my-task` route to actually load `MyTaskComponent` instead of the coming-soon
placeholder.

**Spec:** design spec §4 ("used on My Task cards/rows, Board cards, and Backlog rows — one component,
three call sites")

**Depends on:** backend plan Part 9 (`OpenClockSessionEmployeeId` on list responses), Part 3
(`TaskClockWidgetComponent`), Part 5 (`MyTaskComponent` exists).

## Architecture & Conventions

- `TaskCardComponent`/`TaskTableComponent` are both pure presentational components today (inputs/outputs
  only, no injected services) — read both in full (already reproduced during planning for `TaskCardComponent`;
  re-read `TaskTableComponent` in full before editing, only its header was seen during planning). Adding
  `TaskClockWidgetComponent` (which **does** inject `TaskApiService`, per Part 3) as a child keeps the
  parent presentational — the parent doesn't need its own `TaskApiService` injection, it just needs to pass
  `currentEmployeeId` down, same pattern as Part 4's `TaskDetailModalComponent` change.
- `isAssignee` for a card/row is `task.assigneeEmployeeIds.includes(currentEmployeeId)` — compute this
  as a `computed()` inside `TaskCardComponent`/`TaskTableComponent` itself now that they'll receive
  `currentEmployeeId` as an input, rather than requiring every parent (`TaskBoardComponent`,
  `TaskBacklogComponent`, `MyTaskComponent`) to precompute it per-card (that would triplicate the same
  logic three times across parents; computing it once inside the shared card/row component is the DRYer
  choice, and differs from Part 4's approach only because Part 4's modal isn't rendered in a loop).

## Global Constraints

- `openClockSessionEmployeeId` is `null` when no task in the list has an open session — the frontend
  must treat `null` and "matches nobody" identically, never coerce it to an empty string for comparison.

---

### Task 1: DTO/model field, and `toWorkTask` mapping

**Files:**
- Modify: `src/app/modules/work/models/dto/task.dto.ts`
- Modify: `src/app/modules/work/models/task.model.ts`
- Modify: `src/app/modules/work/utils/task.mapper.ts`
- Modify: `src/app/modules/work/utils/task.mapper.spec.ts` (if it exists — check before assuming; if not,
  this Task's assertion moves into whichever spec file already covers `toWorkTask`)

**Interfaces:**
- Produces: `WorkTaskDto.openClockSessionEmployeeId: string | null`,
  `WorkTask.openClockSessionEmployeeId: string | null`, mapped through unchanged (no transformation needed,
  it's already the right shape on the wire).

- [ ] **Step 1: Write the failing test**

```typescript
it('maps openClockSessionEmployeeId through unchanged', () => {
  const dto: WorkTaskDto = { ...baseDto, openClockSessionEmployeeId: 'e7' };
  expect(toWorkTask(dto).openClockSessionEmployeeId).toBe('e7');
});

it('maps a null openClockSessionEmployeeId as null, not undefined', () => {
  const dto: WorkTaskDto = { ...baseDto, openClockSessionEmployeeId: null };
  expect(toWorkTask(dto).openClockSessionEmployeeId).toBeNull();
});
```

(`baseDto` follows whatever fixture the existing `task.mapper.spec.ts` already uses — extend it with the
new field rather than building a parallel fixture.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Add the field to both interfaces**

```typescript
export interface WorkTaskDto {
  // ...existing fields...
  openClockSessionEmployeeId: string | null;
}
```

```typescript
export interface WorkTask {
  // ...existing fields...
  openClockSessionEmployeeId: string | null;
}
```

- [ ] **Step 4: Update `toWorkTask`**

Add `openClockSessionEmployeeId: dto.openClockSessionEmployeeId` to whatever object-literal mapping
`toWorkTask` already returns (read the file first — it was not opened in full during planning, only its
existence and usage were confirmed).

- [ ] **Step 5: Run the tests to verify they pass; then Step 6: commit**

```bash
git add src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/models/task.model.ts src/app/modules/work/utils/task.mapper.ts
git commit -m "feat(work): add openClockSessionEmployeeId to the task model and mapper"
```

---

### Task 2: Wire the widget into `TaskCardComponent`

**Files:**
- Modify: `src/app/modules/work/ui/task-card/task-card.component.ts`
- Modify: `src/app/modules/work/ui/task-card/task-card.component.spec.ts` (check for existence first)
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts` (pass `currentEmployeeId` down)

**Interfaces:**
- Produces: `TaskCardComponent` gains `currentEmployeeId: input('')`, renders `<app-task-clock-widget>`
  computing `isAssignee`/`hasOpenSessionMine`/`hasOpenSessionOtherEmployee` from
  `task().assigneeEmployeeIds` and `task().openClockSessionEmployeeId` vs. `currentEmployeeId()`.

- [ ] **Step 1: Write the failing tests**

```typescript
it('shows the clock widget when the caller is an assignee', () => {
  setup({ task: { ...baseTask, assigneeEmployeeIds: ['e1'] }, currentEmployeeId: 'e1' });
  expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeTruthy();
});

it('marks hasOpenSessionMine when the open session belongs to the caller', () => {
  setup({ task: { ...baseTask, assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: 'e1' }, currentEmployeeId: 'e1' });
  const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
  expect(widget.componentInstance.hasOpenSessionMine()).toBe(true);
});

it('marks hasOpenSessionOtherEmployee when a different employee holds the open session', () => {
  setup({ task: { ...baseTask, assigneeEmployeeIds: ['e1', 'e2'], openClockSessionEmployeeId: 'e2' }, currentEmployeeId: 'e1' });
  const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
  expect(widget.componentInstance.hasOpenSessionOtherEmployee()).toBe(true);
  expect(widget.componentInstance.hasOpenSessionMine()).toBe(false);
});
```

**Note:** `setup(...)`, `baseTask`, and whether `TaskCardComponent` currently has any spec file at all
follow whatever this plan's earlier Parts already established for this file, or — if
`task-card.component.spec.ts` doesn't exist yet — this is the first test file for this component; use
Part 3's `task-clock-widget.component.spec.ts` setup style as the template.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

Add the import and input:

```typescript
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
```

```typescript
  currentEmployeeId = input('');

  protected readonly isAssignee = computed(() => this.task().assigneeEmployeeIds.includes(this.currentEmployeeId()));
  protected readonly hasOpenSessionMine = computed(() => this.task().openClockSessionEmployeeId === this.currentEmployeeId() && this.currentEmployeeId() !== '');
  protected readonly hasOpenSessionOtherEmployee = computed(() => {
    const openBy = this.task().openClockSessionEmployeeId;
    return openBy !== null && openBy !== this.currentEmployeeId();
  });
```

Add `TaskClockWidgetComponent` to the `@Component`'s `imports` array. Add to the template, after
`.task-card__status`, stopping click-propagation so clicking the widget doesn't also open the detail modal
(matching the existing `.task-card__view-btn`'s `$event.stopPropagation()` pattern):

```typescript
      @if (isAssignee()) {
        <div (click)="$event.stopPropagation()">
          <app-task-clock-widget
            [task]="task()"
            [isAssignee]="isAssignee()"
            [hasOpenSessionMine]="hasOpenSessionMine()"
            [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
          />
        </div>
      }
```

**Note:** `TaskClockWidgetComponent`'s outputs (`clockedIn`, `pushed`) aren't bound here — a card
currently has no reactive way to refresh its own `task` input after a Clock In/Push (that's owned by the
parent's data-fetching, same as any other task mutation from this card). Bind both outputs to re-emit a
generic `taskChanged: output<void>()` from `TaskCardComponent`, and have `TaskBoardComponent` (Task 4)
call its own `reload()` in response — matching how `TaskBoardComponent.onTaskSaved()` already reloads
after a detail-modal edit.

Add:

```typescript
  taskChanged = output<void>();
```

and wire both widget outputs in the template:

```typescript
            (clockedIn)="taskChanged.emit()"
            (pushed)="taskChanged.emit()"
```

- [ ] **Step 4: Update `TaskBoardComponent` to pass `currentEmployeeId` and handle `taskChanged`**

In `task-board-column.component.ts`'s usage of `<app-task-card>`, add `[currentEmployeeId]` (threaded from
`TaskBoardColumnComponent`'s own new input, itself threaded from `TaskBoardComponent`) and
`(taskChanged)="taskChanged.emit()"` — this requires adding a pass-through input/output to
`TaskBoardColumnComponent` too (it currently only re-emits `taskViewed`, add the same pass-through pattern
for `currentEmployeeId`/`taskChanged`). In `TaskBoardComponent` itself, resolve `currentEmployeeId` the
same way Part 4 Task 2 already resolved it for the detail modal (reuse that exact lookup, don't
re-implement), and call `this.reload()` (or whatever the existing reload method is named) on `taskChanged`.

- [ ] **Step 5: Run all affected tests; then Step 6: commit**

Run: `npm test -- --include='**/task-card.component.spec.ts' --include='**/task-board-column.component.spec.ts' --include='**/task-board.component.spec.ts'`

```bash
git add src/app/modules/work/ui/task-card/ src/app/modules/work/ui/task-board-column/ src/app/modules/work/feature/task-board/
git commit -m "feat(work): add the clock widget to Board task cards"
```

---

### Task 3: Wire the widget into `TaskTableComponent` (Backlog and My Task's list view)

**Files:**
- Modify: `src/app/modules/work/ui/task-table/task-table.component.ts`
- Modify: `src/app/modules/work/ui/task-table/task-table.component.spec.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `src/app/modules/work/feature/my-task/my-task.component.ts`

**Interfaces:**
- Produces: `TaskTableComponent` gains the same `currentEmployeeId` input and `taskChanged` output as
  `TaskCardComponent` (Task 2), rendering the widget as a new table column.

- [ ] **Step 1: Read `TaskTableComponent` in full first** (only its header was seen during planning — its
  full row-rendering `<tr>` template, quoted in part above, needs a new `<td>` added between `Priority` and
  `View`, and its `<thead>` needs a matching new `<th>`).

- [ ] **Step 2: Write the failing tests, mirroring Task 2's three tests exactly**, adapted to query within
  a `<td>` instead of a bare card div (`fixture.debugElement.query(By.css('[data-testid="task-row-t1"]
  app-task-clock-widget'))` or equivalent, matching whatever row-scoping pattern this file's existing tests
  already use for per-row assertions).

- [ ] **Step 3: Run to verify failure**

- [ ] **Step 4: Implement** — same `isAssignee`/`hasOpenSessionMine`/`hasOpenSessionOtherEmployee`
  `computed()` trio as Task 2 (this is now duplicated across `TaskCardComponent` and `TaskTableComponent` —
  **acceptable duplication**, not worth extracting a shared helper for 3 one-line computed signals per the
  project's YAGNI convention, but flag it in code review if a third near-identical copy appears anywhere
  else later), a new `<th>Clock</th>` and `<td>` per row rendering `<app-task-clock-widget>` with the same
  bindings as Task 2, and a `taskChanged` output.

- [ ] **Step 5: Wire `TaskBacklogComponent` and `MyTaskComponent`'s `<app-task-table>` usage** to pass
  `[currentEmployeeId]` and handle `(taskChanged)="reload()"`, reusing each component's own existing
  `currentEmployeeId`/`reload` (My Task already has both from Part 5; Backlog needs the same
  `currentEmployeeId` lookup Task 2 established for Board, applied here).

- [ ] **Step 6: Run all affected tests; then Step 7: commit**

Run: `npm test -- --include='**/task-table.component.spec.ts' --include='**/task-backlog.component.spec.ts' --include='**/my-task.component.spec.ts'`

```bash
git add src/app/modules/work/ui/task-table/ src/app/modules/work/feature/task-backlog/ src/app/modules/work/feature/my-task/
git commit -m "feat(work): add the clock widget to Backlog and My Task's list view rows"
```

---

### Task 4: Flip the `my-task` route to load `MyTaskComponent`

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`

- [ ] **Step 1: Change the one import**

```typescript
      {
        path: 'my-task',
        loadComponent: () =>
          import('./feature/my-task/my-task.component').then((m) => m.MyTaskComponent)
      },
```

- [ ] **Step 2: Run the full route spec and a smoke build**

Run: `npm test -- --include='**/work.routes.spec.ts'` (should still pass — Part 1's test only asserts
`loadComponent` is truthy, not which component) and `ng build`.
Expected: PASS / succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/work/work.routes.ts
git commit -m "feat(work): route my-task to the real MyTaskComponent"
```

---

## Self-review checklist for this Part

- [ ] `TaskCardComponent`/`TaskTableComponent` still have zero injected services of their own — only
  `TaskClockWidgetComponent` (their new child) injects `TaskApiService`, keeping both parents
  presentational, per this Part's Architecture note.
- [ ] Every new click target inside a card/row (`TaskClockWidgetComponent`'s buttons, its push popup)
  stops propagation so it never also triggers the card/row's own `(click)="viewed.emit(...)"`.
- [ ] `currentEmployeeId` resolution is the same single lookup reused across `TaskDetailModalComponent`
  (Part 4), `TaskCardComponent`/`TaskBoardComponent` (Task 2), `TaskTableComponent`/`TaskBacklogComponent`/
  `MyTaskComponent` (Task 3/Part 5) — grep for how many distinct places in the diff call whatever store
  method resolves it; more than one distinct call pattern across these means it wasn't actually reused,
  fix that before considering this plan done.

---

## Frontend plan complete — final self-review across all 6 Parts

- [ ] **Spec coverage:** My Task page (routing, Board/List toggle, Sprint filter, search, create,
  detail click-through, sort) → Parts 1, 5. Shared clock widget → Parts 3, 6. Task detail history feed and
  percent/reason editing → Part 4. Data-access layer → Part 2.
- [ ] **Type consistency:** `WorkTaskDto`/`WorkTask`/DTOs in `task-history.dto.ts` field names match the
  backend's camelCase JSON exactly (re-verify against the backend plan's final Part 7/8/9 shapes, since
  Part 9 was added after this frontend plan's Part 2 was first drafted — confirm `openClockSessionEmployeeId`
  made it into both `task.dto.ts` and `task.model.ts`, not just one).
- [ ] Every `<app-task-detail-modal>` call site across the whole frontend passes `isAssignee` and
  `currentEmployeeId` (Part 4's two new required inputs) — a missed call site is a compile error, so a
  clean `ng build` at the very end of this plan is the real confirmation, run it as the last step before
  calling this plan done.
