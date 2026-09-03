# Work Management — Backlog Sprint UI & Board Scoping (Part 4 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Part 3 being complete** (`part-3-frontend-settings-and-task-detail.md`) — reuses `SprintApiService`/`Sprint` model/`toSprint` mapper from Part 3 Task 1.

**Goal:** The Backlog tab gains Sprint management (create/edit/complete/achieve for the owner, a
sprint list scoped to Active-only for non-owner members, per spec's permission table), and the Board
tab's task list becomes scoped to only the Objective's currently-Active Sprint(s) — a behavior change
from today's "shows every task regardless of grouping."

**Architecture:** `TaskBoardStore` (shared by both Board and Backlog today) stays unchanged and
unfiltered — Backlog still needs every task regardless of sprint. Board-scoping is implemented as a
local computed filter inside `TaskBoardComponent` itself, using the objective's active-sprint IDs
(already fetched in Part 3 Task 2) intersected against `store.tasks()`. Sprint CRUD gets its own small
`SprintListStore`, kept separate from `TaskBoardStore` since sprints and tasks are different concerns
with different reload triggers.

**Tech Stack:** Angular (standalone components, signals, `@ngrx/signals`).

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-work-management-sprint-foundation-design.md`

## Global Constraints

- Work Management module only.
- Board shows tasks from **all** currently-Active sprints combined (not a single-sprint picker) —
  per the spec's explicit scope decision; do not add sprint selection UI to the Board tab in this plan.
- Non-owner members' Backlog Sprint list must only ever request `activeOnly=true` from
  `SprintApiService.getByObjective` — never fetch the full list and hide it client-side (a
  client-side-only restriction is not a real access boundary, and the backend doesn't enforce this
  distinction server-side either per Part 2's design, so getting this right in the client call itself
  matters).

---

### Task 1: Board scoped to Active Sprint(s) only

**Files:**
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts`
- Test: `src/app/modules/work/feature/task-board/task-board.component.spec.ts`

**Interfaces:**
- Consumes: `TaskBoardStore.statuses()`/`tasks()` (unchanged), the component's own `activeSprints()`
  signal (added in Part 3 Task 2).

- [ ] **Step 1: Write the failing test**

Read `task-board.component.spec.ts` first to match its existing fixture/mocking style, then add:

```typescript
  it('columnsWithTasks only includes tasks whose sprintId is one of the active sprints', () => {
    // Arrange: set store.tasks() (via whatever this file's existing test harness uses to seed the
    // store - a TestBed-provided store instance or a mock) to two tasks, one with sprintId matching
    // an entry in component.activeSprints(), one with a sprintId that doesn't (or null/undefined).
    // Act: read component.columnsWithTasks().
    // Assert: only the matching task appears in the result, across all columns.
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/task-board.component.spec.ts'`
Expected: FAIL — `columnsWithTasks` doesn't exist on the component yet (template currently reads
`store.columnsWithTasks()` directly).

- [ ] **Step 3: Add the scoped computed and switch the template to use it**

```typescript
import { AfterViewChecked, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, TaskCreateModalComponent, TaskDetailModalComponent, ButtonComponent],
  template: `
    <div class="task-board__toolbar">
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <p class="task-board__error">{{ store.error() }}</p>
    } @else {
      <div class="task-board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            (taskDropped)="onTaskDropped($event)"
          />
        }
      </div>
    }

    @if (milestoneId()) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        [activeSprints]="activeSprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="createOpen.set(false)"
      />
      <app-task-detail-modal [open]="detailOpen()" [task]="selectedTask()" (closed)="detailOpen.set(false)" />
    }
  `,
  styles: [`
    .task-board__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .task-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .task-board__error { color: var(--color-danger); }
    :host ::ng-deep .task-card--highlighted {
      outline: 2px solid var(--color-focus-ring, var(--color-danger));
      outline-offset: 2px;
    }
  `]
})
export class TaskBoardComponent implements OnInit, AfterViewChecked {
  protected readonly store = inject(TaskBoardStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly sprintApi = inject(SprintApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly activeSprints = signal<Sprint[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  protected readonly columnsWithTasks = computed(() => {
    const activeSprintIds = new Set(this.activeSprints().map((s) => s.id));
    return this.store.columnsWithTasks().map((column) => ({
      status: column.status,
      tasks: column.tasks.filter((t) => activeSprintIds.has((t as WorkTask & { sprintId?: string }).sprintId ?? ''))
    }));
  });

  columnIds(): string[] {
    return this.columnsWithTasks().map((c) => c.status.id);
  }

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    this.highlightTaskId = this.route.snapshot.queryParamMap.get('highlightTaskId');
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void firstValueFrom(this.sprintApi.getByObjective(id, true)).then((dtos) => this.activeSprints.set(dtos.map(toSprint)));

    if (!fromList) {
      void this.projectStore.getMilestoneDetail(id).then((detail) => {
        if (detail) this.isObjectiveOwner.set(detail.isOwner);
      });
    }
  }

  ngAfterViewChecked(): void {
    if (!this.highlightTaskId || this.didScrollToHighlight || this.store.loading()) return;
    const el = document.querySelector(`[data-testid="task-card-${this.highlightTaskId}"]`) as HTMLElement | null;
    if (!el) return;
    this.didScrollToHighlight = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    el.classList.add('task-card--highlighted');
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }
}
```

Note: `WorkTask` doesn't have a `sprintId` field yet in the frontend model — Task 2 of this plan adds
it (it's needed by both this filtering logic and the Backlog Sprint grouping, so it's factored as its
own small task rather than duplicated inline here). This step's `(t as WorkTask & { sprintId?: string })`
cast is a **temporary** compile-time bridge only valid until Task 2 lands in the same PR/plan
execution — if Task 2 is done first, remove the cast and reference `t.sprintId` directly. Since this
plan executes tasks in order, do Task 2 before finishing this task's implementation, then come back
and remove the cast as this task's final cleanup step (see Step 5 below).

Also wire the task-detail popup's `viewed` output from `TaskBoardColumnComponent`/`TaskCardComponent`
into `selectedTask`/`detailOpen` here, per Part 3 Task 5 Step 7's description (that step described the
wiring in the abstract; this is the concrete component it applies to — implement it now as part of
this file's rewrite above, e.g. `(taskViewed)="onTaskViewed($event)"` on `app-task-board-column` and
an `onTaskViewed(task: WorkTask): void { this.selectedTask.set(task); this.detailOpen.set(true); }`
method).

- [ ] **Step 4: Add `sprintId` to the `WorkTask` model and DTO/mapper (pulled forward from Task 2 to unblock this task's compile)**

In `models/task.model.ts`, add `sprintId: string | null;` to the `WorkTask` interface.
In `models/dto/task.dto.ts`, add `sprintId: string | null;` to `WorkTaskDto`.
In `utils/task.mapper.ts`, add `sprintId: dto.sprintId,` to `toWorkTask`'s return object.

Now remove the temporary cast from Step 3's `columnsWithTasks` computed:
```typescript
      tasks: column.tasks.filter((t) => activeSprintIds.has(t.sprintId ?? ''))
```

- [ ] **Step 5: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/task-board.component.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/models/task.model.ts src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/utils/task.mapper.ts
git commit -m "feat(work): Board tab now shows only tasks from the Objective's currently-Active Sprint(s)"
```

---

### Task 2: `SprintListStore`

**Files:**
- Create: `src/app/modules/work/state/sprint-list.store.ts`
- Test: `src/app/modules/work/state/sprint-list.store.spec.ts`

**Interfaces:**
- Produces: a `signalStore` with `sprints: readonly Sprint[]`, `loading: boolean`, `error: string | null`,
  and methods `load(objectiveId, activeOnly)`, `create(objectiveId, request)`, `edit(sprintId, request)`,
  `complete(sprintId)`, `achieve(sprintId)` — each re-fetching the list after a successful mutation
  (simplest-correct approach; this module has no existing optimistic-sprint-update precedent to
  follow, unlike `moveTask`'s optimistic pattern in `TaskBoardStore`, so don't invent one here).

- [ ] **Step 1: Write the failing test**

Read `task-board.store.spec.ts` (if it exists — check via
`find src/app/modules/work/state -iname "*.spec.ts"`) first to match this module's store-testing
style, then write the equivalent for `SprintListStore`:

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SprintListStore } from './sprint-list.store';
import { SprintApiService } from '../data-access/sprint-api.service';
import { SprintDto } from '../models/dto/sprint.dto';

describe('SprintListStore', () => {
  let store: InstanceType<typeof SprintListStore>;
  let api: jasmine.SpyObj<SprintApiService>;

  const dto: SprintDto = { id: 's1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-09-01', endDate: '2026-09-14', status: 'active', completedAt: null, achievedAt: null };

  beforeEach(() => {
    api = jasmine.createSpyObj('SprintApiService', ['getByObjective', 'create', 'edit', 'complete', 'achieve']);
    api.getByObjective.and.returnValue(of([dto]));
    TestBed.configureTestingModule({ providers: [{ provide: SprintApiService, useValue: api }] });
    store = TestBed.inject(SprintListStore);
  });

  it('load populates sprints from the API', async () => {
    await store.load('o1', false);
    expect(store.sprints().length).toBe(1);
    expect(store.sprints()[0].name).toBe('Sprint 1');
  });

  it('complete re-fetches the list after succeeding', async () => {
    api.complete.and.returnValue(of(dto));
    await store.load('o1', false);
    await store.complete('s1', 'o1', false);
    expect(api.getByObjective).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/sprint-list.store.spec.ts'`
Expected: FAIL — `SprintListStore` doesn't exist.

- [ ] **Step 3: Implement the store**

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SprintApiService } from '../data-access/sprint-api.service';
import { toSprint } from '../utils/sprint.mapper';
import { Sprint } from '../models/sprint.model';
import { CreateSprintRequestDto, EditSprintRequestDto } from '../models/dto/sprint.dto';

interface SprintListState {
  readonly sprints: readonly Sprint[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: SprintListState = { sprints: [], loading: false, error: null };

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const SprintListStore = signalStore(
  { providedIn: 'root' },
  withState<SprintListState>(initialState),
  withMethods((store, api = inject(SprintApiService)) => ({
    async load(objectiveId: string, activeOnly: boolean): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dtos = await firstValueFrom(api.getByObjective(objectiveId, activeOnly));
        patchState(store, { sprints: dtos.map(toSprint), loading: false });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load sprints.'), loading: false });
      }
    },

    async create(objectiveId: string, request: CreateSprintRequestDto, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.create(objectiveId, request));
        await this['load'](objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the sprint.') });
        return false;
      }
    },

    async edit(sprintId: string, request: EditSprintRequestDto, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.edit(sprintId, request));
        await this['load'](objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to update the sprint.') });
        return false;
      }
    },

    async complete(sprintId: string, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.complete(sprintId));
        await this['load'](objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Every task in this sprint must be complete first.') });
        return false;
      }
    },

    async achieve(sprintId: string, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.achieve(sprintId));
        await this['load'](objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to achieve the sprint.') });
        return false;
      }
    }
  }))
);
```

Note: calling `this['load'](...)` from within the same `withMethods` block is this codebase's
necessary workaround for `@ngrx/signals`' `withMethods` not exposing sibling methods via plain `this.load(...)`
during the same factory call in some versions — **check first** whether `task-board.store.ts` or any
other store in this module calls one of its own methods from within another (search
`grep -n "this\.\w*(" src/app/modules/work/state/*.store.ts`); if plain `this.load(...)` already works
elsewhere in this codebase's actual `@ngrx/signals` version, use that instead of the `this['load']`
bracket workaround — don't introduce an unnecessary pattern deviation if it isn't actually needed.

- [ ] **Step 4: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/sprint-list.store.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/sprint-list.store.ts src/app/modules/work/state/sprint-list.store.spec.ts
git commit -m "feat(work): SprintListStore"
```

---

### Task 3: Backlog Sprint list UI (create/edit/complete/achieve, owner vs. member visibility)

**Files:**
- Create: `src/app/modules/work/ui/sprint-list/sprint-list.component.ts`
- Create: `src/app/modules/work/ui/sprint-list/sprint-list.component.spec.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`

**Interfaces:**
- Consumes: `SprintListStore` (Task 2).
- Produces: `SprintListComponent { objectiveId: input.required<string>, isObjectiveOwner: input.required<boolean>, sprintSelected: output<Sprint | null> }` — emits when the owner/member picks a sprint to filter the backlog task list by (client-side filter, no new endpoint needed — Backlog already has every task via `TaskBoardStore`).

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SprintListComponent } from './sprint-list.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { signal } from '@angular/core';

describe('SprintListComponent', () => {
  let fixture: ComponentFixture<SprintListComponent>;

  function setup(isOwner: boolean): void {
    TestBed.configureTestingModule({ imports: [SprintListComponent] }).compileComponents();
    fixture = TestBed.createComponent(SprintListComponent);
    fixture.componentRef.setInput('objectiveId', 'o1');
    fixture.componentRef.setInput('isObjectiveOwner', isOwner);
    fixture.detectChanges();
  }

  it('owner sees a Create Sprint button', () => {
    setup(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Create sprint');
  });

  it('non-owner does not see a Create Sprint button', () => {
    setup(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Create sprint');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/sprint-list.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

```typescript
import { DatePipe } from '@angular/common';
import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { SprintListStore } from '../../state/sprint-list.store';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Sprint } from '../../models/sprint.model';

@Component({
  selector: 'app-sprint-list',
  standalone: true,
  imports: [DatePipe, InputComponent, ButtonComponent],
  template: `
    <div class="sprint-list">
      <div class="sprint-list__header">
        <h3 class="sprint-list__title">Sprints</h3>
        @if (isObjectiveOwner()) {
          <app-button variant="secondary" (pressed)="creating.set(!creating())">
            {{ creating() ? 'Cancel' : 'Create sprint' }}
          </app-button>
        }
      </div>

      @if (creating()) {
        <div class="sprint-list__create-form">
          <app-input label="Name" [value]="newName()" (valueChange)="newName.set($event)" />
          <app-input label="Start date" type="date" [value]="newStart()" (valueChange)="newStart.set($event)" />
          <app-input label="End date" type="date" [value]="newEnd()" (valueChange)="newEnd.set($event)" />
          <app-button variant="primary" (pressed)="submitCreate()">Save</app-button>
        </div>
      }

      @if (store.error()) {
        <p class="sprint-list__error" role="alert">{{ store.error() }}</p>
      }

      <ul class="sprint-list__items">
        @for (sprint of store.sprints(); track sprint.id) {
          <li class="sprint-list__item" [class.sprint-list__item--selected]="selectedId() === sprint.id">
            <button type="button" class="sprint-list__item-button" (click)="select(sprint)">
              <span class="sprint-list__item-name">{{ sprint.name }}</span>
              <span class="sprint-list__item-status" [attr.data-status]="sprint.status">{{ sprint.status }}</span>
              <span class="sprint-list__item-dates">{{ sprint.startDate | date: 'MMM d' }} – {{ sprint.endDate | date: 'MMM d' }}</span>
            </button>
            @if (isObjectiveOwner()) {
              <div class="sprint-list__item-actions">
                @if (sprint.status === 'active') {
                  <app-button variant="secondary" (pressed)="complete(sprint.id)">Complete</app-button>
                }
                @if (sprint.status !== 'achieved') {
                  <app-button variant="secondary" (pressed)="achieve(sprint.id)">Achieve</app-button>
                }
              </div>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .sprint-list__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .sprint-list__title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .sprint-list__create-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; }
    .sprint-list__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-list__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .sprint-list__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; }
    .sprint-list__item--selected { border-color: var(--color-focus-ring); }
    .sprint-list__item-button { flex: 1; display: flex; gap: 10px; align-items: center; background: none; border: none; text-align: left; cursor: pointer; color: var(--color-text-primary); font-size: 13px; }
    .sprint-list__item-status { font-size: 11px; text-transform: capitalize; color: var(--color-text-secondary); }
    .sprint-list__item-status[data-status="incomplete"] { color: var(--color-danger-text); }
    .sprint-list__item-dates { font-size: 11px; color: var(--color-text-secondary); }
    .sprint-list__item-actions { display: flex; gap: 6px; }
  `]
})
export class SprintListComponent implements OnInit {
  protected readonly store = inject(SprintListStore);

  objectiveId = input.required<string>();
  isObjectiveOwner = input.required<boolean>();
  sprintSelected = output<Sprint | null>();

  protected readonly creating = signal(false);
  protected readonly newName = signal('');
  protected readonly newStart = signal('');
  protected readonly newEnd = signal('');
  protected readonly selectedId = signal<string | null>(null);

  ngOnInit(): void {
    void this.store.load(this.objectiveId(), !this.isObjectiveOwner());
  }

  select(sprint: Sprint): void {
    const next = this.selectedId() === sprint.id ? null : sprint.id;
    this.selectedId.set(next);
    this.sprintSelected.emit(next ? sprint : null);
  }

  async submitCreate(): Promise<void> {
    const ok = await this.store.create(this.objectiveId(), {
      name: this.newName().trim(),
      startDate: this.newStart(),
      endDate: this.newEnd()
    }, !this.isObjectiveOwner());
    if (ok) {
      this.creating.set(false);
      this.newName.set('');
      this.newStart.set('');
      this.newEnd.set('');
    }
  }

  async complete(sprintId: string): Promise<void> {
    await this.store.complete(sprintId, this.objectiveId(), !this.isObjectiveOwner());
  }

  async achieve(sprintId: string): Promise<void> {
    await this.store.achieve(sprintId, this.objectiveId(), !this.isObjectiveOwner());
  }
}
```

Note `!this.isObjectiveOwner()` is passed as `activeOnly` throughout — an owner requests the full list
(`activeOnly=false`), a member requests only Active sprints (`activeOnly=true`), matching the spec's
permission table exactly.

- [ ] **Step 4: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/sprint-list.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Wire into `TaskBacklogComponent`**

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { SprintListComponent } from '../../ui/sprint-list/sprint-list.component';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskTableComponent, TaskCreateModalComponent, TaskDetailModalComponent, SprintListComponent, ButtonComponent],
  template: `
    <div class="task-backlog__toolbar">
      <app-button variant="primary" (pressed)="createOpen.set(true)">Create task</app-button>
    </div>

    @if (milestoneId()) {
      <app-sprint-list
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        (sprintSelected)="filterSprint.set($event)"
      />
    }

    @if (store.loading()) {
      <p>Loading backlog…</p>
    } @else if (store.error()) {
      <p class="task-backlog__error">{{ store.error() }}</p>
    } @else {
      <app-task-table [tasks]="visibleTasks()" [statusNames]="statusNames()" (viewed)="onTaskViewed($event)" />
    }

    @if (milestoneId()) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        [activeSprints]="activeSprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="createOpen.set(false)"
      />
      <app-task-detail-modal [open]="detailOpen()" [task]="selectedTask()" (closed)="detailOpen.set(false)" />
    }
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
    .task-backlog__error { color: var(--color-danger); }
  `]
})
export class TaskBacklogComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly sprintApi = inject(SprintApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly activeSprints = signal<Sprint[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly filterSprint = signal<Sprint | null>(null);

  protected readonly statusNames = computed(() =>
    Object.fromEntries(this.store.statuses().map((s) => [s.id, s.name]))
  );

  protected readonly visibleTasks = computed(() => {
    const filter = this.filterSprint();
    return filter ? this.store.tasks().filter((t) => t.sprintId === filter.id) : this.store.tasks();
  });

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void firstValueFrom(this.sprintApi.getByObjective(id, true)).then((dtos) => this.activeSprints.set(dtos.map(toSprint)));

    if (!fromList) {
      void this.projectStore.getMilestoneDetail(id).then((detail) => {
        if (detail) this.isObjectiveOwner.set(detail.isOwner);
      });
    }
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }
}
```

This requires `TaskTableComponent` to have gained a `viewed` output in Part 3 Task 5 — confirm that
landed before this step (it's a hard dependency, not optional).

- [ ] **Step 6: Run to verify, then full frontend regression**

Run: `npx ng test --watch=false --include='**/task-backlog.component.spec.ts'`
then `npx ng test --watch=false`
Expected: PASS across the board.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/ui/sprint-list/ src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): Backlog gains Sprint list UI (create/complete/achieve) and sprint-filtered task view"
```

---

### Task 4: `assignableMembers` real data source (closes the placeholder from Part 3)

**Files:**
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`

Part 3 Task 2 Step 5 left `assignableMembers` as a signal populated from
`ObjectiveMemberApiService`, deferred to "read the file first." Do that now, in both components.

- [ ] **Step 1: Read the member API service**

Run: `cat src/app/modules/work/data-access/objective-member-api.service.ts`
Identify the exact method that lists an Objective's active members with a display name (e.g. a
`getMembers(objectiveId): Observable<ObjectiveMemberItemDto[]>` — the shape referenced in the earlier
research pass's `objective-invitation.dto.ts` findings had `employeeId` but no display name on
`ObjectiveMemberItemDto` directly; if no display-name field exists on whatever this returns, check
whether `ICallerIdentityResolver`'s frontend equivalent or a people/employee lookup service already
exists in this module to resolve a name for each `employeeId` — do not fabricate a name field that
isn't actually available; if none exists, populate `assignableMembers` with `employeeId` as both the
value and the visible label as an honest fallback, and note this as a known display gap rather than
inventing a fake name source.

- [ ] **Step 2: Wire the real call in both `ngOnInit` methods**

Replace the still-empty `assignableMembers = signal<{ employeeId: string; name: string }[]>([]);`
initialization in both `TaskBoardComponent` and `TaskBacklogComponent` with a real fetch in
`ngOnInit`, following whatever the actual member-listing method from Step 1 turns out to be — e.g.:

```typescript
    void firstValueFrom(this.memberApi.getMembers(id)).then((members) =>
      this.assignableMembers.set(members.map((m) => ({ employeeId: m.employeeId, name: m.displayName ?? m.employeeId })))
    );
```

Adjust field names to match Step 1's actual findings exactly — this is illustrative of the wiring
shape, not a literal method/field name to copy blindly.

- [ ] **Step 3: Run full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): wire real Objective member data into the task-create modal's assignee select"
```

---

## End of Part 4

Part 4 is complete when all 4 tasks are committed and `npx ng test --watch=false` is fully green. At
this point the whole Sprint Foundation feature (backend Parts 1-2, frontend Parts 3-4) is functionally
complete: Task Status Public/Private governance with a default template and an owner-only Settings
page, the full 5-state Sprint lifecycle with a background job, the Objective-Achieve gate, task
detail popups, create-then-assign chaining, Backlog Sprint management, and Board scoped to Active
Sprints. Manually verify end-to-end in the browser before considering this feature done: create a
sprint, create a task into it, move it through statuses as both owner and a non-owner member (confirm
the Public/Private gate), complete the sprint, achieve it, confirm its tasks are frozen, and confirm
an Objective can't be achieved until all its sprints are Complete/Achieved.
