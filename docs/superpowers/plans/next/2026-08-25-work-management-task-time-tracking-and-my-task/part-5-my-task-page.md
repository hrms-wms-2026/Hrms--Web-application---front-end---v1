# Part 5: `MyTaskComponent` — the routed My Task page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The actual My Task page: fetches the caller's tasks for this project, offers a Board/List toggle,
a Sprint filter, a text search, wires up Create Task (existing approval-workflow modal, unchanged) and
task-detail click-through (existing modal, now carrying history/clock-widget from Part 4).

**Spec:** design spec §4-6

**Depends on:** Part 1 (route exists, still pointing at the placeholder), Part 2 (`getMyTasks`), Part 4
(the upgraded `TaskDetailModalComponent`).

## Architecture & Conventions

- **Reuse existing presentational components — do not rebuild board/list rendering from scratch.** Board
  view: `TaskBoardColumnComponent` (one instance per status, exactly like `TaskBoardComponent` already
  assembles `columnsWithTasks()` — read that component's full source, quoted in part during planning, and
  mirror its column-grouping `computed()` shape). List view: `TaskTableComponent` as-is (it already handles
  its own sort-on-click and status dropdown; passing it the my-tasks array is the only wiring needed).
- **This page is a `feature/` component, not a `ui/` one** — it owns a store/data-fetching, matching
  `TaskBoardComponent`/`TaskBacklogComponent`'s own `feature/` placement.
- Sprint filter: reuse `SprintListStore` (already injected in `TaskBacklogComponent` per the file read
  during planning) rather than re-fetching sprints separately.
- Default sort comes from the backend (Part 2's `getMyTasks` calls the already-sorted endpoint) — this
  component must **not** re-sort the fetched list before handing it to Board/List (Board's per-status
  grouping preserves each task's relative order within its column since `Array.filter` is stable; List's
  `TaskTableComponent` shows insertion order until a column header is clicked, which is exactly right).

## Global Constraints

- Text search is client-side only, over the already-fetched list (title/shortId substring match) — no new
  backend query param.
- "All Sprints" (the default) omits `sprintId` from the API call entirely, not an empty-string param.

---

### Task 1: `MyTaskComponent` skeleton — fetch, Board/List toggle, Sprint filter, search

**Files:**
- Create: `src/app/modules/work/feature/my-task/my-task.component.ts`
- Test: `src/app/modules/work/feature/my-task/my-task.component.spec.ts`

**Interfaces:**
- Produces: `MyTaskComponent`, routed at `work/:id/my-task` once Task 3 flips the route import.

- [ ] **Step 1: Write the failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MyTaskComponent } from './my-task.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';

const myTasks = [
  { id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'First', description: null, categoryId: 'c1', statusId: 's1', priority: 'high', storyPoints: null, dueDate: '2026-09-01', estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: 'sp1', assigneeEmployeeIds: ['e1'] },
  { id: 't2', objectiveId: 'o1', shortId: 'T-2', title: 'Second', description: null, categoryId: 'c1', statusId: 's1', priority: 'low', storyPoints: null, dueDate: '2026-09-05', estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: 'sp2', assigneeEmployeeIds: ['e1'] }
];

describe('MyTaskComponent', () => {
  let fixture: ComponentFixture<MyTaskComponent>;
  let taskApiSpy: jasmine.SpyObj<TaskApiService>;

  beforeEach(async () => {
    taskApiSpy = jasmine.createSpyObj('TaskApiService', ['getMyTasks', 'getStatuses']);
    taskApiSpy.getMyTasks.and.returnValue(of(myTasks));
    taskApiSpy.getStatuses.and.returnValue(of([{ id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }]));

    await TestBed.configureTestingModule({
      imports: [MyTaskComponent],
      providers: [
        { provide: TaskApiService, useValue: taskApiSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'p1' } }, parent: { snapshot: { paramMap: { get: () => 'p1' } } } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(MyTaskComponent);
    fixture.detectChanges();
  });

  it('fetches my tasks for the current project on init', () => {
    expect(taskApiSpy.getMyTasks).toHaveBeenCalledWith('p1', undefined);
  });

  it('defaults to Board view', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-board-view"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-list-view"]')).toBeNull();
  });

  it('switches to List view on toggle click', () => {
    fixture.nativeElement.querySelector('[data-testid="my-task-view-toggle-list"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-list-view"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-board-view"]')).toBeNull();
  });

  it('filters the visible list by the search box, client-side', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="my-task-search"]');
    input.value = 'first';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredTasks().length).toBe(1);
    expect(fixture.componentInstance.filteredTasks()[0].title).toBe('First');
  });

  it('refetches with the selected sprintId when the Sprint filter changes', () => {
    fixture.componentInstance.setSprintFilter('sp1');
    expect(taskApiSpy.getMyTasks).toHaveBeenCalledWith('p1', 'sp1');
  });
});
```

**Note on test scaffolding:** the `ActivatedRoute` mock shape above assumes `MyTaskComponent` reads
`projectId` from the parent route's `:id` param, matching how `TaskBoardComponent`/`TaskBacklogComponent`
already resolve it (check their existing `ngOnInit`/constructor for the exact
`route.parent?.snapshot.paramMap.get('id')` call shape and mirror it exactly rather than guessing).

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { WorkTask, TaskStatusColumn } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { WorkDropdownComponent } from '../../ui/work-dropdown/work-dropdown.component';

@Component({
  selector: 'app-my-task',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskTableComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent, ErrorStateComponent, WorkDropdownComponent],
  template: `
    <div class="my-task__toolbar">
      <div class="my-task__view-toggle">
        <button data-testid="my-task-view-toggle-board" type="button" [class.my-task__view-toggle--active]="view() === 'board'" (click)="view.set('board')">Board</button>
        <button data-testid="my-task-view-toggle-list" type="button" [class.my-task__view-toggle--active]="view() === 'list'" (click)="view.set('list')">List</button>
      </div>
      <app-work-dropdown [options]="sprintOptions()" [selected]="sprintFilter() ?? 'all'" accessibleLabel="Sprint filter" leadingIcon="sprint" (selectionChanged)="setSprintFilter($event === 'all' ? null : $event)" />
      <input data-testid="my-task-search" type="text" placeholder="Search my tasks" (input)="search.set($any($event.target).value)" />
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (loading()) {
      <p>Loading…</p>
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="reload()" />
    } @else if (view() === 'board') {
      <div data-testid="my-task-board-view" class="my-task__board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="statuses().map(s => s.id)"
            [allStatuses]="statuses()"
            [employeeNames]="{}"
            (taskViewed)="onTaskViewed($event)"
          />
        }
      </div>
    } @else {
      <div data-testid="my-task-list-view">
        <app-task-table [tasks]="filteredTasks()" [statuses]="statuses()" (viewed)="onTaskViewed($event)" />
      </div>
    }

    @if (createOpen()) {
      <app-task-create-modal [open]="createOpen()" [projectId]="projectId()" (closed)="createOpen.set(false)" (created)="reload()" />
    }

    <app-task-detail-modal
      [open]="detailOpen()"
      [task]="selectedTask()"
      [projectId]="projectId()"
      [isObjectiveOwner]="false"
      [isAssignee]="true"
      [currentEmployeeId]="currentEmployeeId()"
      [statuses]="statuses()"
      (closed)="detailOpen.set(false)"
      (saved)="onTaskSaved()"
    />
  `,
  styles: [`
    .my-task__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 16px; }
    .my-task__view-toggle { display: flex; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
    .my-task__view-toggle button { padding: 6px 12px; background: var(--color-surface); border: none; font-size: 13px; }
    .my-task__view-toggle--active { background: var(--color-focus-ring); color: white; }
    .my-task__board { display: flex; gap: 12px; overflow-x: auto; }
  `]
})
export class MyTaskComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);
  private readonly sprintStore = inject(SprintListStore);

  view = signal<'board' | 'list'>('board');
  search = signal('');
  sprintFilter = signal<string | null>(null);
  tasks = signal<WorkTask[]>([]);
  statuses = signal<TaskStatusColumn[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  createOpen = signal(false);
  detailOpen = signal(false);
  selectedTask = signal<WorkTask | null>(null);
  currentEmployeeId = signal('');

  projectId = computed(() => this.route.parent?.snapshot.paramMap.get('id') ?? '');

  filteredTasks = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) return this.tasks();
    return this.tasks().filter((t) => t.title.toLowerCase().includes(term) || t.shortId.toLowerCase().includes(term));
  });

  columnsWithTasks = computed(() =>
    this.statuses()
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((status) => ({ status, tasks: this.filteredTasks().filter((t) => t.statusId === status.id) })));

  sprintOptions = computed(() => [
    { value: 'all', label: 'All Sprints' },
    ...this.sprintStore.sprints().map((s) => ({ value: s.id, label: s.name }))
  ]);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [taskDtos, statusDtos] = await Promise.all([
        firstValueFrom(this.taskApi.getMyTasks(this.projectId(), this.sprintFilter() ?? undefined)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId()))
      ]);
      this.tasks.set(taskDtos.map(toWorkTask));
      this.statuses.set(statusDtos);
    } catch {
      this.error.set('Failed to load your tasks.');
    } finally {
      this.loading.set(false);
    }
  }

  setSprintFilter(sprintId: string | null): void {
    this.sprintFilter.set(sprintId);
    void this.load();
  }

  reload(): void {
    void this.load();
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  onTaskSaved(): void {
    this.detailOpen.set(false);
    void this.load();
  }
}
```

**`currentEmployeeId` is left as an empty-string placeholder signal here** — resolve it from whichever
store/service already exposes the logged-in user's employee id elsewhere in this module (check
`EmployeeDirectoryStore`/an auth store, the same lookup Part 4 Task 2 needed for
`TaskBoardComponent`/`TaskBacklogComponent`) and wire it the same way in this component's constructor,
rather than leaving it empty. This plan intentionally leaves this one line as a clearly-marked gap because
the exact service call depends on Part 4's findings for that same lookup — resolve both together for
consistency, or resolve this one first and reuse the finding in Part 4.

**`[isObjectiveOwner]="false"`** is intentionally hardcoded here, not a bug — My Task's own list is always
"tasks assigned to me," and this modal's owner-vs-request edit branch should follow the caller's actual
Objective-ownership status, not always "false." **Fix this before considering this task done**: compute a
real `isObjectiveOwner` the same way `TaskBoardComponent` does (`objectiveOwners()[selectedTask()!.objectiveId]`),
requiring this component to also load the objective-ownership map — check whether `ProjectDetailStore`
already exposes it project-wide (likely, since `TaskBoardComponent` gets it from a store already injected
project-wide, not fetched per-task) and reuse that store here too.

- [ ] **Step 4: Run the tests to verify they pass; then Step 5: commit**

Run: `npm test -- --include='**/my-task.component.spec.ts'`

```bash
git add src/app/modules/work/feature/my-task/
git commit -m "feat(work): add MyTaskComponent with Board/List toggle, Sprint filter, and search"
```

---

### Task 2: Sort/filter fixes and empty state

**Files:**
- Modify: `src/app/modules/work/feature/my-task/my-task.component.ts`
- Modify: `src/app/modules/work/feature/my-task/my-task.component.spec.ts`

**Interfaces:**
- Produces: an explicit empty-state message when `filteredTasks()` is empty (distinguishing "no tasks
  assigned to you" from "no results match your search").

- [ ] **Step 1: Write the failing test**

```typescript
it('shows an empty state distinguishing no-tasks from no-search-results', () => {
  taskApiSpy.getMyTasks.and.returnValue(of([]));
  fixture = TestBed.createComponent(MyTaskComponent);
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain('No tasks assigned to you');
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

Add to the template, inside both the board and list branches (or as a shared condition wrapping both):

```typescript
    } @else if (filteredTasks().length === 0) {
      <p class="my-task__empty">{{ tasks().length === 0 ? 'No tasks assigned to you in this project.' : 'No tasks match your search.' }}</p>
    } @else if (view() === 'board') {
      ...
```

(Insert this branch between the `error()` check and the `view() === 'board'` check in the existing
`@if`/`@else if` chain from Task 1.)

- [ ] **Step 4: Run the tests to verify they pass; then Step 5: commit**

```bash
git add src/app/modules/work/feature/my-task/
git commit -m "feat(work): distinguish empty-project-tasks from empty-search-results in My Task"
```

---

## Self-review checklist for this Part

- [ ] `currentEmployeeId` and `isObjectiveOwner` are both resolved from real stores, not left as the
  Task 1 placeholders — grep the final file for `signal('')` on `currentEmployeeId` and `false` hardcoded
  on `isObjectiveOwner` and confirm neither remains.
- [ ] The Sprint filter's "All Sprints" option omits `sprintId` from the API call (`undefined`, not
  `'all'` or `''`) — confirmed by Task 1's first test.
- [ ] Search filtering never mutates `tasks()` — it only affects `filteredTasks()`, so switching Board/List
  views after searching keeps the same filtered set in both.
