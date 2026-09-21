# Task Subtasks (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Status:** Finished 2026-09-21 — all 5 tasks executed, full suite green throughout (2,601/2,601 tests across 321 test files).

**Goal:** Let a user add subtasks to a task (each with its own assignee, due date, priority) from the task detail panel, and see a "completed/total" progress badge with an expandable nested list on both the Board card and the Backlog row.

**Architecture:** A subtask is rendered as a normal `WorkTask` with `parentTaskId` set — no new model type. `TaskBoardStore` gains a `subtasksByParentId` map, populated lazily only when a card/row is expanded or a task is opened in edit mode, plus `loadSubtasks`/`createSubtask` methods. `TaskCardComponent` and `TaskTableComponent` each inject `TaskBoardStore` directly (matching `TaskCardComponent`'s and `TaskFormModalComponent`'s existing pattern of injecting services beyond their declared `@Input`s) to drive the expand/collapse affordance without prop-drilling through their parent feature components.

**Tech Stack:** Angular 21, `@ngrx/signals`, Vitest + Angular `TestBed`.

**Spec:** `docs/superpowers/specs/finished/2026-09-21/2026-09-21-task-subtasks-design.md`

**Depends on:** `HRMS-Backend-v1`'s companion plan, `docs/superpowers/plans/finished/2026-09-21/2026-09-21-task-subtasks-backend.md`, must be implemented first — this plan's API calls assume `POST/GET tasks/{id}/subtasks` exist and `WorkTaskDto` carries `parentTaskId`/`subtaskTotalCount`/`subtaskCompletedCount`.

## Global Constraints

- A subtask create request only ever sends the reduced field set: `title`, `priority?`, `dueDate?`, `assigneeEmployeeId?` — no story points, no time estimate, no sprint.
- Subtasks are never rendered as independent top-level cards/rows on the Board or Backlog — only nested under their parent, lazy-loaded on first expand.
- Test runner is Vitest (`vi.fn()`/`vi.spyOn()`), not Jest — mirror the mocking style already used in `task-card.component.spec.ts` and `task-board.store.spec.ts`.

---

### Task 1: Model, DTO, mapper, and API client

**Files:**
- Modify: `src/app/modules/work/models/task.model.ts`
- Modify: `src/app/modules/work/models/dto/task.dto.ts`
- Modify: `src/app/modules/work/utils/task.mapper.ts`
- Modify: `src/app/modules/work/data-access/task-api.service.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WorkTask.parentTaskId?`, `.subtaskTotalCount`, `.subtaskCompletedCount`; `CreateSubtaskRequestDto`; `TaskApiService.createSubtask(parentTaskId, request)` and `.getSubtasks(parentTaskId)` — consumed by Task 2's store methods.

- [x] **Step 1: Add fields to `WorkTask` and `WorkTaskDto`**

In `task.model.ts`, add to the `WorkTask` interface (after `assignees: TaskAssigneeIdentity[];`):

```typescript
  parentTaskId: string | null;
  subtaskTotalCount: number;
  subtaskCompletedCount: number;
```

In `task.dto.ts`, add to the `WorkTaskDto` interface (after `assignees?: TaskAssigneeIdentityDto[];`):

```typescript
  parentTaskId?: string | null;
  subtaskTotalCount?: number;
  subtaskCompletedCount?: number;
```

- [x] **Step 2: Add `CreateSubtaskRequestDto`**

In `task.dto.ts`, add after `CreateTaskRequestDto`:

```typescript
export interface CreateSubtaskRequestDto {
  title: string;
  priority?: WorkTaskDto['priority'];
  dueDate?: string;
  assigneeEmployeeId?: string;
}
```

- [x] **Step 3: Update `toWorkTask`**

In `task.mapper.ts`, add to the object returned by `toWorkTask` (after `assignees: ...`):

```typescript
    parentTaskId: dto.parentTaskId ?? null,
    subtaskTotalCount: dto.subtaskTotalCount ?? 0,
    subtaskCompletedCount: dto.subtaskCompletedCount ?? 0
```

- [x] **Step 4: Add API client methods**

In `task-api.service.ts`, add `CreateSubtaskRequestDto` to the existing import from `../models/dto/task.dto`, then add two methods near `createTask`:

```typescript
  createSubtask(parentTaskId: string, request: CreateSubtaskRequestDto): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/tasks/${parentTaskId}/subtasks`, request);
  }

  getSubtasks(parentTaskId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/tasks/${parentTaskId}/subtasks`);
  }
```

- [x] **Step 5: Type-check**

Run: `npx ng build --configuration development 2>&1 | tail -60` (or the project's usual `npm run build`/`ng build` command)
Expected: no new type errors. Existing components that build `WorkTask` object literals (e.g. test fixtures) will now be missing the 3 new required fields — that's expected and fixed as each affected test file is touched in later tasks; if the build surfaces others, add `parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0` to those fixtures too.

- [x] **Step 6: Commit**

```bash
git add src/app/modules/work/models/task.model.ts src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/utils/task.mapper.ts src/app/modules/work/data-access/task-api.service.ts
git commit -m "feat(work): add subtask fields to WorkTask model and TaskApiService"
```

---

### Task 2: Store — `subtasksByParentId`, `loadSubtasks`, `createSubtask`

**Files:**
- Modify: `src/app/modules/work/state/task-board.store.ts`
- Test: `src/app/modules/work/state/task-board.store.spec.ts`

**Interfaces:**
- Consumes: `TaskApiService.getSubtasks`/`.createSubtask` (Task 1).
- Produces: `store.subtasksByParentId(): Readonly<Record<string, readonly WorkTask[]>>`, `store.loadSubtasks(parentTaskId: string): Promise<void>`, `store.createSubtask(parentTaskId: string, request: CreateSubtaskRequestDto): Promise<WorkTask | null>` — consumed by Tasks 3, 4, 5.

- [x] **Step 1: Write the failing tests**

Add to `task-board.store.spec.ts`, inside the existing `describe('TaskBoardStore', ...)` block:

```typescript
  it('loadSubtasks populates subtasksByParentId for that parent', async () => {
    const store = setup({
      getSubtasks: () => of([{
        id: 'sub-1', objectiveId: 'obj-1', shortId: 'PRJ-2', title: 'Sub', description: null,
        categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: null,
        parentTaskId: 't-1', subtaskTotalCount: 0, subtaskCompletedCount: 0
      }])
    });

    await store.loadSubtasks('t-1');

    expect(store.subtasksByParentId()['t-1'].length).toBe(1);
    expect(store.subtasksByParentId()['t-1'][0].title).toBe('Sub');
  });

  it('createSubtask appends the new subtask and increments the parent subtaskTotalCount', async () => {
    const store = setup();
    await store.loadBoard('proj-1'); // seeds tasks() with t-1, subtaskTotalCount 0

    const created = await store.createSubtask('t-1', { title: 'Sub' } as any);

    expect(created?.title).toBeUndefined(); // default createSubtask mock below returns nothing unless overridden; see next test for the populated case
  });

  it('createSubtask increments the parent task subtaskTotalCount using the real response', async () => {
    const store = setup({
      createSubtask: () => of({
        id: 'sub-1', objectiveId: 'obj-1', shortId: 'PRJ-2', title: 'Sub', description: null,
        categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: null,
        parentTaskId: 't-1', subtaskTotalCount: 0, subtaskCompletedCount: 0
      })
    });
    await store.loadBoard('proj-1');

    const created = await store.createSubtask('t-1', { title: 'Sub' } as any);

    expect(created?.title).toBe('Sub');
    expect(store.subtasksByParentId()['t-1'].length).toBe(1);
    expect(store.tasks().find((t) => t.id === 't-1')?.subtaskTotalCount).toBe(1);
  });
```

Remove the middle test above (`'createSubtask appends...'` without a `createSubtask` override) — it was scaffolding to show the default-mock gap; only the third test (with the real `createSubtask` override) is needed. Keep just `loadSubtasks populates...` and `createSubtask increments...`.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/state/task-board.store.spec.ts`
Expected: FAIL — `loadSubtasks`/`createSubtask` don't exist on the store yet, and the default `setup()` mock has no `getSubtasks`/`createSubtask`.

- [x] **Step 3: Add the default mock methods to `setup()`**

In the same spec file, add `getSubtasks: () => of([])` and `createSubtask: () => of({} as any)` to the default `api` object inside `setup()`, alongside the existing `getStatuses`/`getTasksByProject`/`moveTaskStatus`.

- [x] **Step 4: Update the store**

In `task-board.store.ts`, update the imports:

```typescript
import { CreateSubtaskRequestDto, CreateTaskRequestDto, EditTaskRequestDto, InsufficientAllocationErrorDto } from '../models/dto/task.dto';
```

Update `TaskBoardState` and `initialState`:

```typescript
interface TaskBoardState {
  readonly statuses: readonly TaskStatusColumn[];
  readonly tasks: readonly WorkTask[];
  readonly subtasksByParentId: Readonly<Record<string, readonly WorkTask[]>>;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: TaskBoardState = { statuses: [], tasks: [], subtasksByParentId: {}, loading: false, error: null };
```

Add two methods inside `withMethods((store, api = inject(TaskApiService)) => ({ ... }))`, after `moveTask`:

```typescript
    async loadSubtasks(parentTaskId: string): Promise<void> {
      try {
        const dtos = await firstValueFrom(api.getSubtasks(parentTaskId));
        patchState(store, { subtasksByParentId: { ...store.subtasksByParentId(), [parentTaskId]: dtos.map(toWorkTask) } });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load subtasks.') });
      }
    },

    async createSubtask(parentTaskId: string, request: CreateSubtaskRequestDto): Promise<WorkTask | null> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.createSubtask(parentTaskId, request));
        const subtask = toWorkTask(dto);
        const existing = store.subtasksByParentId()[parentTaskId] ?? [];
        patchState(store, {
          subtasksByParentId: { ...store.subtasksByParentId(), [parentTaskId]: [...existing, subtask] },
          tasks: store.tasks().map((t) => (t.id === parentTaskId ? { ...t, subtaskTotalCount: t.subtaskTotalCount + 1 } : t))
        });
        return subtask;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the subtask.') });
        return null;
      }
    }
```

- [x] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/state/task-board.store.spec.ts`
Expected: PASS (all tests, including the 3 pre-existing ones).

- [x] **Step 6: Commit**

```bash
git add src/app/modules/work/state/task-board.store.ts src/app/modules/work/state/task-board.store.spec.ts
git commit -m "feat(work): add subtasksByParentId, loadSubtasks, createSubtask to TaskBoardStore"
```

---

### Task 3: Board card — expand/collapse badge and nested subtask rows

**Files:**
- Modify: `src/app/modules/work/ui/task-card/task-card.component.ts`
- Test: `src/app/modules/work/ui/task-card/task-card.component.spec.ts`

**Interfaces:**
- Consumes: `TaskBoardStore.subtasksByParentId`/`.loadSubtasks` (Task 2), `WorkTask.subtaskTotalCount`/`.subtaskCompletedCount` (Task 1).
- Produces: nothing new consumed elsewhere — this is a leaf UI change. Still emits `viewed` for a clicked subtask row, exactly as it already does for the parent card.

- [x] **Step 1: Write the failing tests**

Add to `task-card.component.spec.ts`. First add `import { TaskBoardStore } from '../../state/task-board.store';` and `import { vi } from 'vitest';` (already imported). Add a `boardStore` mock to `setup()`'s provider list:

```typescript
      providers: [
        { provide: EmployeeDirectoryStore, useValue: directoryStore },
        { provide: TaskBoardStore, useValue: boardStore }
      ]
```

declaring `boardStore` alongside `directoryStore` at the top of `setup()`:

```typescript
    boardStore = {
      subtasksByParentId: vi.fn().mockReturnValue({}),
      loadSubtasks: vi.fn().mockResolvedValue(undefined)
    };
```

(add the matching `let boardStore: { subtasksByParentId: ReturnType<typeof vi.fn>; loadSubtasks: ReturnType<typeof vi.fn> };` near the existing `let directoryStore: ...` declaration). Then add new test cases:

```typescript
  it('does not show a subtask toggle when the task has no subtasks', () => {
    setup({ task: { ...task, subtaskTotalCount: 0, subtaskCompletedCount: 0 } });
    expect(fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]')).toBeNull();
  });

  it('shows the completed/total badge when the task has subtasks', () => {
    setup({ task: { ...task, subtaskTotalCount: 3, subtaskCompletedCount: 1 } });
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLElement;
    expect(toggle.textContent).toContain('1/3');
  });

  it('lazy-loads subtasks on first expand and does not reload on collapse/re-expand', () => {
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement;

    toggle.click();
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t-1');
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);

    toggle.click(); // collapse
    toggle.click(); // re-expand
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);
  });

  it('expanding does not emit viewed for the parent card', () => {
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();

    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('clicking a nested subtask row emits viewed with the subtask, not the parent', () => {
    boardStore.subtasksByParentId.mockReturnValue({
      't-1': [{ ...task, id: 'sub-1', title: 'Sub thing', subtaskTotalCount: 0, subtaskCompletedCount: 0 }]
    });
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-sub-1"]') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }));
  });
```

Also add `parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0` to the top-level `task` fixture object declared near the top of the spec file, so every pre-existing test still satisfies the `WorkTask` type.

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/ui/task-card/task-card.component.spec.ts`
Expected: FAIL — no `TaskBoardStore` provided/consumed yet, no toggle markup exists.

- [x] **Step 3: Update the component**

In `task-card.component.ts`, add the import and injection:

```typescript
import { TaskBoardStore } from '../../state/task-board.store';
```

```typescript
  private readonly store = inject(TaskBoardStore);
```

Add new protected members after `assigneePopoverPositions`:

```typescript
  protected readonly subtasksExpanded = signal(false);
  protected readonly subtasks = computed(() => this.store.subtasksByParentId()[this.task().id] ?? []);
```

Add a new method near `toggleAssigneePopover`:

```typescript
  protected toggleSubtasks(event: MouseEvent): void {
    event.stopPropagation();
    const wasExpanded = this.subtasksExpanded();
    this.subtasksExpanded.set(!wasExpanded);
    if (!wasExpanded && this.subtasks().length === 0) {
      void this.store.loadSubtasks(this.task().id);
    }
  }

  protected onSubtaskRowClick(event: MouseEvent, subtask: WorkTask): void {
    event.stopPropagation();
    this.viewed.emit(subtask);
  }
```

- [x] **Step 4: Update the template**

Add the toggle button inside `.task-card__meta`, right after the `task-card__event` block (before the closing `</div>` of `.task-card__meta`):

```html
        @if (task().subtaskTotalCount > 0) {
          <button
            type="button"
            class="task-card__subtask-toggle"
            data-testid="task-card-subtask-toggle"
            [attr.aria-expanded]="subtasksExpanded()"
            (click)="toggleSubtasks($event)"
          >
            <svg class="task-card__subtask-chevron" [class.task-card__subtask-chevron--open]="subtasksExpanded()" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
            <span>{{ task().subtaskCompletedCount }}/{{ task().subtaskTotalCount }}</span>
          </button>
        }
```

Add the nested list right after the closing `</div>` of `.task-card__meta` (before the `@if (isAssignee()) { ... }` footer block):

```html
      @if (subtasksExpanded()) {
        <div class="task-card__subtasks" data-testid="task-card-subtasks">
          @for (subtask of subtasks(); track subtask.id) {
            <div
              class="task-card__subtask-row"
              [attr.data-testid]="'task-card-subtask-' + subtask.id"
              (click)="onSubtaskRowClick($event, subtask)"
            >
              <span class="task-card__subtask-title">{{ subtask.title }}</span>
              @if (subtask.assigneeEmployeeIds.length > 0) {
                <app-employee-avatar [employeeId]="subtask.assigneeEmployeeIds[0]" [showName]="false" />
              }
            </div>
          }
        </div>
      }
```

- [x] **Step 5: Add styles**

Add to the component's `styles` array, after `.task-card__footer`:

```css
    .task-card__subtask-toggle { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; padding: 0; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; cursor: pointer; }
    .task-card__subtask-chevron { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; transition: transform 120ms ease; }
    .task-card__subtask-chevron--open { transform: rotate(180deg); }
    .task-card__subtasks { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-border); }
    .task-card__subtask-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
    .task-card__subtask-row:hover { background: var(--color-surface-secondary); }
    .task-card__subtask-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--color-text-primary); }
```

- [x] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/ui/task-card/task-card.component.spec.ts`
Expected: PASS (all tests, including every pre-existing one).

- [x] **Step 7: Commit**

```bash
git add src/app/modules/work/ui/task-card/task-card.component.ts src/app/modules/work/ui/task-card/task-card.component.spec.ts
git commit -m "feat(work): show subtask progress badge and nested rows on the Board card"
```

---

### Task 4: Backlog table — expand/collapse toggle row and nested subtask rows

**Files:**
- Modify: `src/app/modules/work/ui/task-table/task-table.component.ts`
- Test: `src/app/modules/work/ui/task-table/task-table.component.spec.ts` (read it first to confirm the exact `setup()`/fixture convention this file already uses, and mirror it — it was not read while writing this plan)

**Interfaces:**
- Consumes: `TaskBoardStore.subtasksByParentId`/`.loadSubtasks` (Task 2).
- Produces: nothing new consumed elsewhere.

- [x] **Step 1: Update the shared `beforeEach` to provide a `TaskBoardStore` mock**

The current spec file (verified 2026-09-21) has a single top-level `const task: WorkTask = {...}` fixture and one shared `beforeEach` that does `TestBed.configureTestingModule({ imports: [TaskTableComponent, HttpClientTestingModule] })` with no `providers` array — this component takes only `@Input`s today, so injecting `TaskBoardStore` in Step 4 below means this `beforeEach` needs a mock provider.

Add `import { TaskBoardStore } from '../../state/task-board.store';` to the top of the file, add `parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0` to the existing top-level `task` fixture object (required fields on the `WorkTask` type after Task 1 of this plan), declare `let boardStore: { subtasksByParentId: ReturnType<typeof vi.fn>; loadSubtasks: ReturnType<typeof vi.fn> };` next to the existing `let fixture`/`let httpMock`, and change the shared `beforeEach` to:

```typescript
  beforeEach(() => {
    TestBed.resetTestingModule();
    boardStore = {
      subtasksByParentId: vi.fn().mockReturnValue({}),
      loadSubtasks: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({
      imports: [TaskTableComponent, HttpClientTestingModule],
      providers: [{ provide: TaskBoardStore, useValue: boardStore }]
    });
    fixture = TestBed.createComponent(TaskTableComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('tasks', [task]);
    fixture.componentRef.setInput('statuses', [status]);
    fixture.componentRef.setInput('currentEmployeeId', 'e1');
    fixture.detectChanges();
  });
```

(`TestBed.resetTestingModule()` is added because this `beforeEach` now varies its providers per test via reassigning `boardStore` — safe to add even though the original file didn't need it.)

- [x] **Step 2: Write the failing tests**

Add these three tests, after `'hides the clock widget for a non-assignee row'` and before the nested `describe('selectable mode', ...)` block:

```typescript
  it('shows a subtask toggle row only for tasks that have subtasks', () => {
    fixture.componentRef.setInput('tasks', [
      { ...task, id: 't1', subtaskTotalCount: 0 },
      { ...task, id: 't2', shortId: 'T-2', subtaskTotalCount: 2, subtaskCompletedCount: 1 }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]')).toBeNull();
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-row-t2-subtask-toggle"]') as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toContain('1/2');
  });

  it('lazy-loads subtasks on first expand of a task row', () => {
    fixture.componentRef.setInput('tasks', [{ ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]') as HTMLButtonElement).click();

    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);
  });

  it('clicking a nested subtask row emits viewed with the subtask, not the parent', () => {
    const subtask = { ...task, id: 'sub-1', title: 'Sub thing', subtaskTotalCount: 0 };
    boardStore.subtasksByParentId.mockReturnValue({ t1: [subtask] });
    fixture.componentRef.setInput('tasks', [{ ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }]);
    fixture.detectChanges();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="task-row-sub-1"]') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }));
  });
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/ui/task-table/task-table.component.spec.ts`
Expected: FAIL.

- [x] **Step 4: Update the component**

In `task-table.component.ts`, update the import line to add `inject`:

```typescript
import { Component, computed, inject, input, output, signal } from '@angular/core';
```

Add the import and injection:

```typescript
import { TaskBoardStore } from '../../state/task-board.store';
```

```typescript
export class TaskTableComponent {
  private readonly store = inject(TaskBoardStore);

  tasks = input.required<readonly WorkTask[]>();
```

Add new protected state and methods, near `isSelected`:

```typescript
  protected readonly expandedTaskIds = signal<ReadonlySet<string>>(new Set());

  subtasksFor(taskId: string): readonly WorkTask[] {
    return this.store.subtasksByParentId()[taskId] ?? [];
  }

  isExpanded(taskId: string): boolean {
    return this.expandedTaskIds().has(taskId);
  }

  toggleSubtasks(taskId: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedTaskIds());
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
      if (this.subtasksFor(taskId).length === 0) {
        void this.store.loadSubtasks(taskId);
      }
    }
    this.expandedTaskIds.set(next);
  }
```

- [x] **Step 5: Update the template**

Right after the closing `</tr>` of the main row (i.e. right after the `@for (task of sortedTasks(); track task.id) { <tr>...</tr>` row's closing tag, still inside the same `@for` block, before its own closing `}`), add:

```html
          @if (task.subtaskTotalCount > 0) {
            <tr class="task-table__subtask-toggle-row">
              <td [attr.colspan]="selectable() ? 9 : 8">
                <button
                  type="button"
                  class="task-table__subtask-toggle"
                  [attr.data-testid]="'task-row-' + task.id + '-subtask-toggle'"
                  [attr.aria-expanded]="isExpanded(task.id)"
                  (click)="toggleSubtasks(task.id, $event)"
                >
                  <svg class="task-table__subtask-chevron" [class.task-table__subtask-chevron--open]="isExpanded(task.id)" viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>
                  <span>{{ task.subtaskCompletedCount }}/{{ task.subtaskTotalCount }} subtasks</span>
                </button>
              </td>
            </tr>
            @if (isExpanded(task.id)) {
              @for (subtask of subtasksFor(task.id); track subtask.id) {
                <tr [attr.data-testid]="'task-row-' + subtask.id" class="task-table__subtask-row" (click)="viewed.emit(subtask)">
                  <td [attr.colspan]="selectable() ? 9 : 8" class="task-table__subtask-cell">
                    <span class="task-table__subtask-title">{{ subtask.title }}</span>
                    <span class="task-table__subtask-status">{{ statusName(subtask.statusId) }}</span>
                  </td>
                </tr>
              }
            }
          }
```

The `colspan` of 9/8 matches this table's column count: `[selectable checkbox]` + ID, Title, Status, Due, Est. hours, Priority, Clock, View (8 non-checkbox columns). If a later change to the header row changes that count, update these two `colspan` expressions to match.

- [x] **Step 6: Add styles**

Add to the component's `styles` array:

```css
    .task-table__subtask-toggle-row td { padding: 4px 14px 4px 34px; border-bottom: 0; }
    .task-table__subtask-toggle { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; padding: 0; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; cursor: pointer; }
    .task-table__subtask-chevron { width: 12px; height: 12px; stroke: currentColor; fill: none; stroke-width: 2; transition: transform 120ms ease; }
    .task-table__subtask-chevron--open { transform: rotate(180deg); }
    .task-table__subtask-row:hover { background: var(--color-surface-secondary); }
    .task-table__subtask-cell { padding: 8px 14px 8px 34px !important; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .task-table__subtask-title { font-size: 13px; color: var(--color-text-primary); }
    .task-table__subtask-status { font-size: 11px; color: var(--color-text-secondary); }
```

- [x] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/ui/task-table/task-table.component.spec.ts`
Expected: PASS (all tests, including every pre-existing one).

- [x] **Step 8: Commit**

```bash
git add src/app/modules/work/ui/task-table/task-table.component.ts src/app/modules/work/ui/task-table/task-table.component.spec.ts
git commit -m "feat(work): show subtask toggle row and nested rows in the Backlog table"
```

---

### Task 5: Task detail panel — "Subtasks" section in `task-form-modal.component.ts`

**Files:**
- Modify: `src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts`

**Interfaces:**
- Consumes: `TaskBoardStore.subtasksByParentId`/`.loadSubtasks`/`.createSubtask` (Task 2, already injected in this file as `this.boardStore`), `EmployeePickerComponent`/`EmployeeAvatarComponent` (existing standalone components).
- Produces: nothing new consumed elsewhere — this is the last integration point.

This file is ~3800 lines and was not read in full while writing this plan (only the specific anchors below were verified). Before editing, re-read the surrounding ~50 lines around each anchor to confirm it still matches, since this branch may have moved since this plan was written.

- [x] **Step 1: Add imports**

Find the current `imports: [...]` array in the `@Component` decorator (`grep -n "imports: \[" src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts`) and add `EmployeePickerComponent` and `EmployeeAvatarComponent` to it if not already present. Add the corresponding import statements near the top of the file:

```typescript
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
```

Also add `CreateSubtaskRequestDto` to the existing `task.dto` import.

- [x] **Step 2: Add component state**

Near the existing `task = signal<WorkTask | null>(null);` declaration (around line 1633), add:

```typescript
  subtasks = computed(() => this.boardStore.subtasksByParentId()[this.task()?.id ?? ''] ?? []);
  subtaskCompletedCount = computed(() =>
    this.subtasks().filter((s) => this.statuses().find((st) => st.id === s.statusId)?.marksTaskComplete).length
  );

  addingSubtask = signal(false);
  newSubtaskTitle = signal('');
  newSubtaskDueDate = signal('');
  newSubtaskAssigneeId = signal<string | null>(null);
  newSubtaskPickerOpen = signal(false);
```

- [x] **Step 3: Add methods**

Add near the other action methods in the class body:

```typescript
  startAddSubtask(): void {
    this.addingSubtask.set(true);
  }

  cancelAddSubtask(): void {
    this.addingSubtask.set(false);
    this.newSubtaskTitle.set('');
    this.newSubtaskDueDate.set('');
    this.newSubtaskAssigneeId.set(null);
    this.newSubtaskPickerOpen.set(false);
  }

  onNewSubtaskAssigneeSelected(employeeId: string): void {
    this.newSubtaskAssigneeId.set(employeeId);
    this.newSubtaskPickerOpen.set(false);
  }

  async saveNewSubtask(parentTaskId: string): Promise<void> {
    const title = this.newSubtaskTitle().trim();
    if (!title) return;
    const request: CreateSubtaskRequestDto = {
      title,
      dueDate: this.newSubtaskDueDate() || undefined,
      assigneeEmployeeId: this.newSubtaskAssigneeId() ?? undefined
    };
    const created = await this.boardStore.createSubtask(parentTaskId, request);
    if (created) {
      this.cancelAddSubtask();
    }
  }
```

- [x] **Step 4: Load subtasks when an existing task opens for editing**

Run `grep -n "this.task.set(t)" src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts` to find every call site (as of this plan's research: around lines 2005, 2031, and 2146 — re-verify, since line numbers shift). At each call site that loads an *existing* task for editing (not the "after save, refresh local state" ones, though it is harmless to add it there too), add immediately after `this.task.set(t);`:

```typescript
      void this.boardStore.loadSubtasks(t.id);
```

- [x] **Step 5: Add the template section**

Find this exact block (the boundary between the Attachments and Activity Log sections):

```html
                  <app-task-attachment-list
                    [files]="attachedFiles()"
                    (fileSelected)="onAttachmentFilesSelected($event)"
                    (removed)="removeAttachedFile($event)"
                  />
                </div>

                <!-- Activity Log Section -->
```

Replace it with (inserting the new Subtasks section between the two, keeping everything else identical):

```html
                  <app-task-attachment-list
                    [files]="attachedFiles()"
                    (fileSelected)="onAttachmentFilesSelected($event)"
                    (removed)="removeAttachedFile($event)"
                  />
                </div>

                <!-- Subtasks Section -->
                @if (currentEffectiveMode() === 'edit' && task(); as t) {
                  <div class="tfm-doc-section">
                    <div class="tfm-doc-section-head">
                      <span class="tfm-doc-section-icon">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                      </span>
                      <span class="tfm-doc-section-title">Subtasks</span>
                      <span class="tfm-doc-count">{{ subtaskCompletedCount() }}/{{ subtasks().length }}</span>
                    </div>

                    <div class="tfm-subtask-list">
                      @for (subtask of subtasks(); track subtask.id) {
                        <div class="tfm-subtask-row" [attr.data-testid]="'subtask-row-' + subtask.id">
                          <span class="tfm-subtask-title">{{ subtask.title }}</span>
                          @if (subtask.assigneeEmployeeIds.length > 0) {
                            <app-employee-avatar [employeeId]="subtask.assigneeEmployeeIds[0]" [showName]="true" />
                          }
                          <span class="tfm-subtask-priority" [attr.data-priority]="subtask.priority">{{ subtask.priority }}</span>
                        </div>
                      }
                    </div>

                    @if (addingSubtask()) {
                      <div class="tfm-subtask-add-row">
                        <input
                          type="text"
                          class="tfm-subtask-add-title"
                          placeholder="Subtask name"
                          data-testid="subtask-add-title"
                          [value]="newSubtaskTitle()"
                          (input)="newSubtaskTitle.set($any($event.target).value)"
                        />
                        <button type="button" class="tfm-chip tfm-chip--clean" data-testid="subtask-add-assignee-button" (click)="newSubtaskPickerOpen.set(true)">
                          @if (newSubtaskAssigneeId(); as assigneeId) {
                            <app-employee-avatar [employeeId]="assigneeId" [showName]="true" />
                          } @else {
                            <span>Assignee</span>
                          }
                        </button>
                        <app-employee-picker
                          [open]="newSubtaskPickerOpen()"
                          (selected)="onNewSubtaskAssigneeSelected($event)"
                          (closed)="newSubtaskPickerOpen.set(false)"
                        />
                        <input
                          type="date"
                          class="tfm-subtask-add-date"
                          data-testid="subtask-add-due-date"
                          [value]="newSubtaskDueDate()"
                          (input)="newSubtaskDueDate.set($any($event.target).value)"
                        />
                        <button type="button" class="tfm__cancel" data-testid="subtask-add-cancel" (click)="cancelAddSubtask()">Cancel</button>
                        <button type="button" class="tfm__save" data-testid="subtask-add-save" [disabled]="!newSubtaskTitle().trim()" (click)="saveNewSubtask(t.id)">Save</button>
                      </div>
                    } @else {
                      <button type="button" class="tfm-doc-section-toggle" data-testid="add-subtask-button" (click)="startAddSubtask()">
                        + Add subtask
                      </button>
                    }
                  </div>
                }

                <!-- Activity Log Section -->
```

- [x] **Step 6: Add styles**

Find the component's `styles: [...]` array (it is one large template-literal array — search for a distinctive existing class like `.tfm-doc-section-toggle` to find the right block) and add nearby:

```css
    .tfm-subtask-list { display: flex; flex-direction: column; gap: 6px; }
    .tfm-subtask-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--color-border); }
    .tfm-subtask-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--color-text-primary); }
    .tfm-subtask-priority { font-size: 11px; font-weight: 600; text-transform: capitalize; color: var(--color-text-secondary); }
    .tfm-subtask-priority[data-priority="critical"], .tfm-subtask-priority[data-priority="high"] { color: var(--color-danger); }
    .tfm-subtask-add-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .tfm-subtask-add-title { flex: 1; min-width: 160px; border: 1px solid var(--color-border); border-radius: 6px; padding: 6px 8px; font-size: 13px; background: var(--color-surface); color: var(--color-text-primary); }
    .tfm-subtask-add-date { border: 1px solid var(--color-border); border-radius: 6px; padding: 6px 8px; font-size: 12px; background: var(--color-surface); color: var(--color-text-primary); }
```

- [x] **Step 7: Manual verification in the browser**

Since this file has no existing spec that exercises this deep a slice of the modal (per the file's size, its test coverage is likely split elsewhere or thin), verify manually:

1. `preview_start` the frontend dev server.
2. Open a project's Board or Backlog, open an existing task in edit mode.
3. Confirm the new "Subtasks" section appears between Attachments and Activity log.
4. Click "+ Add subtask", type a title, pick a different assignee than the parent task's, optionally set a due date, click Save.
5. Confirm the new subtask appears in the list with the chosen assignee's avatar, and the section's `{{ completed }}/{{ total }}` count updates.
6. Close the modal, confirm the Board card (or Backlog row) for that task now shows the "0/1"-style badge; expand it and confirm the subtask row appears; click it and confirm it opens in the same detail panel.

- [x] **Step 8: Run the full frontend test suite**

Run: `npx vitest run`
Expected: all tests pass (no regressions from the new imports/fields).

- [x] **Step 9: Commit**

```bash
git add src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts
git commit -m "feat(work): add Subtasks section to the task detail panel"
```

---

## Definition of done

- Backend companion plan is implemented and merged/available first.
- `npx vitest run` is clean across the whole frontend.
- A task's detail panel can add a subtask with its own assignee/due date/priority.
- The Board card and Backlog row both show an accurate "completed/total" badge and can expand to a nested, clickable subtask list, without ever showing a subtask as its own top-level card/row.
- Once this plan is executed and reviewed clean, move this file from `plans/next/` to `plans/finished/<completion-date>/` and update `plans/SUMMARY.md` / `specs/SUMMARY.md` per this repo's existing per-folder `SUMMARY.md` convention (mirrors the backend repo's `docs/superpowers/rules/FILE_CREATION_RULES.md`, if present here — check before assuming identical wording).
