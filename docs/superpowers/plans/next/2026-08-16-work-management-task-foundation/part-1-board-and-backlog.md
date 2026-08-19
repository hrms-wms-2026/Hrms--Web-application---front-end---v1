# Work Management — Task Foundation, Part 1: Board and Backlog Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `board` and `backlog` route stubs (currently both pointing at `MilestoneComingSoonTabComponent`) with a real Kanban board and a real flat task table, backed by the backend endpoints from `HRMS-Backend-v1`'s companion plan Part 1.

**Architecture:** Same layered pattern as the existing Milestone Cards/Tree View feature: `data-access/*-api.service.ts` (HTTP) → `state/*.store.ts` (NgRx Signal Store, `signalStore`/`withState`/`withMethods`, `patchState`, `firstValueFrom` + `extractError`) → `feature/*` smart pages → `ui/*` dumb components.

**Tech Stack:** Angular (standalone components, signal inputs), `@ngrx/signals`, RxJS (`firstValueFrom` only, no Observables held in templates), `@angular/cdk/drag-drop` (new dependency).

**Spec:** `Hrms--Web-application---front-end---v1/docs/superpowers/specs/next/2026-08-16-work-management-task-foundation-design.md` §2, §3. Backend contract: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-16-work-management-task-foundation-design.md` §5 (this plan assumes those endpoints exist — coordinate with or wait for the backend plan's Part 1 before wiring real HTTP calls; use a mocked `HttpTestingController` response shape matching that spec section for all tests in this plan, which do not require the real backend running).

## Global Constraints

- Every new color/border/shadow uses `var(--color-...)` tokens from `shared/styles/theme-tokens.css` — no hardcoded hex values (`docs/design/COMPONENT_DESIGN_RULES.md`).
- Styling-only changes must never touch `.ts` logic/signals/stores (`COMPONENT_DESIGN_RULES.md`) — keep template/CSS edits and store/component-logic edits in separate steps where the task allows.
- `@angular/cdk` is not yet a dependency — Task 1 adds it before anything else in this plan needs it.
- Route paths do not change — only the `loadComponent` targets for `milestones/:milestoneId/board` and `.../backlog` in `src/app/modules/work/work.routes.ts` change.

---

### Task 1: Add `@angular/cdk` dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the package**

Run: `npm install @angular/cdk@^19`

(Match the major version to the installed `@angular/core` version — check `package.json`'s current `@angular/core` version first and use the same major.)

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(work): add @angular/cdk for Kanban drag-and-drop"
```

### Task 2: Models, DTOs, mappers for Task/TaskStatus

**Files:**
- Create: `src/app/modules/work/models/dto/task.dto.ts`
- Create: `src/app/modules/work/models/task.model.ts`
- Create: `src/app/modules/work/utils/task.mapper.ts`

**Interfaces:**
- Produces: `WorkTaskDto`, `TaskStatusDto` (raw API shapes, matching backend spec §5's `WorkTaskResponse`/`TaskStatusResponse` field names exactly, camelCased per the existing DTO convention — check `src/app/modules/work/models/dto/milestone.dto.ts` for the exact casing convention used elsewhere before writing this file), `WorkTask`, `TaskStatusColumn` (app-facing models), `toWorkTask(dto: WorkTaskDto): WorkTask`, `toTaskStatusColumn(dto: TaskStatusDto): TaskStatusColumn`.

- [ ] **Step 1: Read `src/app/modules/work/models/dto/milestone.dto.ts` and `src/app/modules/work/utils/project.mapper.ts` in full to confirm the exact DTO-to-model naming/casing convention (camelCase DTO fields, PascalCase-free TypeScript interfaces) before writing this task's files.**

- [ ] **Step 2: Write the DTO file**

```typescript
// src/app/modules/work/models/dto/task.dto.ts
export interface TaskStatusDto {
  id: string;
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  approverId: string | null;
  marksTaskComplete: boolean;
}

export interface WorkTaskDto {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  taskType: 'task' | 'bug' | 'story' | 'feature';
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: string | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
}

export interface CreateTaskRequestDto {
  title: string;
  description?: string;
  taskType: WorkTaskDto['taskType'];
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
}

export interface EditTaskRequestDto {
  title: string;
  description?: string;
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
}

/** Shape of a 409 INSUFFICIENT_OBJECTIVE_ALLOCATION error body (backend spec §3.2). */
export interface InsufficientAllocationErrorDto {
  availableSlackHours: number;
  suggestedAction: 'extend_allocation';
}
```

- [ ] **Step 3: Write the model file**

```typescript
// src/app/modules/work/models/task.model.ts
export interface TaskStatusColumn {
  id: string;
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  marksTaskComplete: boolean;
}

export interface WorkTask {
  id: string;
  objectiveId: string;
  shortId: string;
  title: string;
  description: string | null;
  taskType: 'task' | 'bug' | 'story' | 'feature';
  statusId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  storyPoints: number | null;
  dueDate: Date | null;
  estimatedHours: number | null;
  completedHours: number;
  progressPercent: number;
}
```

- [ ] **Step 4: Write the mapper**

```typescript
// src/app/modules/work/utils/task.mapper.ts
import { TaskStatusDto, WorkTaskDto } from '../models/dto/task.dto';
import { TaskStatusColumn, WorkTask } from '../models/task.model';

export function toTaskStatusColumn(dto: TaskStatusDto): TaskStatusColumn {
  return {
    id: dto.id, name: dto.name, displayOrder: dto.displayOrder,
    requiresApproval: dto.requiresApproval, marksTaskComplete: dto.marksTaskComplete
  };
}

export function toWorkTask(dto: WorkTaskDto): WorkTask {
  return {
    id: dto.id, objectiveId: dto.objectiveId, shortId: dto.shortId, title: dto.title,
    description: dto.description, taskType: dto.taskType, statusId: dto.statusId,
    priority: dto.priority, storyPoints: dto.storyPoints,
    dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    estimatedHours: dto.estimatedHours, completedHours: dto.completedHours,
    progressPercent: dto.progressPercent
  };
}
```

- [ ] **Step 5: No unit test for this task (pure type/mapping files with no branching logic — matches the codebase's existing convention of not unit-testing simple 1:1 mapper functions; `project.mapper.ts` has no dedicated spec file either, confirmed in Step 1's read).**

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/models/task.model.ts src/app/modules/work/utils/task.mapper.ts
git commit -m "feat(work): Task/TaskStatus DTOs, models, mappers"
```

### Task 3: `TaskApiService` (data-access layer)

**Files:**
- Create: `src/app/modules/work/data-access/task-api.service.ts`
- Test: `src/app/modules/work/data-access/task-api.service.spec.ts`

**Interfaces:**
- Consumes: `WorkTaskDto`, `TaskStatusDto`, `CreateTaskRequestDto`, `EditTaskRequestDto` (Task 2).
- Produces: `TaskApiService.{getStatuses, getTasks, createTask, editTask, moveTaskStatus, assignTask, unassignTask}`.

- [ ] **Step 1: Read `src/app/modules/work/data-access/project-api.service.ts` in full to match its exact `HttpClient` injection style, base-URL constant convention, and method-return-type convention (`Observable<T>`, not `Promise<T>` — the store layer wraps with `firstValueFrom`, confirmed in the Project Detail Store read above) before writing this file.**

- [ ] **Step 2: Write the failing test** (HttpTestingController pattern — match the exact test setup style from `project-api.service.spec.ts`, read that file too if one exists before writing this):

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TaskApiService } from './task-api.service';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';

describe('TaskApiService', () => {
  let service: TaskApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getTasks fetches tasks for an objective', (done) => {
    const objectiveId = 'obj-1';
    const mockTasks: WorkTaskDto[] = [{
      id: 't-1', objectiveId, shortId: 'PRJ-1', title: 'Do it', description: null,
      taskType: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0
    }];

    service.getTasks(objectiveId).subscribe((tasks) => {
      expect(tasks).toEqual(mockTasks);
      done();
    });

    const req = httpMock.expectOne(`/api/v1/work/objectives/${objectiveId}/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush(mockTasks);
  });

  it('getStatuses fetches task statuses for an objective', (done) => {
    const objectiveId = 'obj-1';
    const mockStatuses: TaskStatusDto[] = [{
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false
    }];

    service.getStatuses(objectiveId).subscribe((statuses) => {
      expect(statuses).toEqual(mockStatuses);
      done();
    });

    const req = httpMock.expectOne(`/api/v1/work/objectives/${objectiveId}/task-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatuses);
  });
});
```

- [ ] **Step 3: Run test, verify FAIL.**

- [ ] **Step 4: Write the service** (base URL / `HttpClient` injection pattern must match `project-api.service.ts` exactly — the sketch below assumes the common pattern seen across this codebase's other API services; adjust the constructor/injection style to match Step 1's read precisely):

```typescript
// src/app/modules/work/data-access/task-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaskStatusDto, WorkTaskDto, CreateTaskRequestDto, EditTaskRequestDto } from '../models/dto/task.dto';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/work';

  getStatuses(objectiveId: string): Observable<TaskStatusDto[]> {
    return this.http.get<TaskStatusDto[]>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses`);
  }

  getTasks(objectiveId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/objectives/${objectiveId}/tasks`);
  }

  createTask(objectiveId: string, request: CreateTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/objectives/${objectiveId}/tasks`, request);
  }

  editTask(taskId: string, request: EditTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.patch<WorkTaskDto>(`${this.baseUrl}/tasks/${taskId}`, request);
  }

  moveTaskStatus(taskId: string, newStatusId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/tasks/${taskId}/status`, { newStatusId });
  }

  assignTask(taskId: string, employeeId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/assignments`, { employeeId });
  }

  unassignTask(taskId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${taskId}/assignments/${employeeId}`);
  }
}
```

- [ ] **Step 5: Run test, verify PASS. Step 6: Commit.**

```bash
git add src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts
git commit -m "feat(work): TaskApiService data-access layer"
```

### Task 4: `TaskBoardStore` (state layer)

**Files:**
- Create: `src/app/modules/work/state/task-board.store.ts`
- Test: `src/app/modules/work/state/task-board.store.spec.ts`

**Interfaces:**
- Consumes: `TaskApiService` (Task 3), `toWorkTask`/`toTaskStatusColumn` (Task 2).
- Produces: `TaskBoardStore` with state `{ statuses, tasks, loading, error }`, computed `columnsWithTasks` (statuses joined with their tasks, ordered by `displayOrder`), methods `{ loadBoard(objectiveId), createTask(objectiveId, request), editTask(taskId, request), moveTask(taskId, newStatusId) }`. `moveTask` is optimistic: patches local state immediately, reverts on HTTP error.

- [ ] **Step 1: Write the failing test** (matching the existing store spec pattern — read `src/app/modules/work/state/project-detail.store.spec.ts` if it exists, for the exact TestBed setup with a mocked `TaskApiService`):

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TaskBoardStore } from './task-board.store';
import { TaskApiService } from '../data-access/task-api.service';

describe('TaskBoardStore', () => {
  function setup(apiOverrides: Partial<TaskApiService> = {}) {
    const api = {
      getStatuses: () => of([{ id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false }]),
      getTasks: () => of([{ id: 't-1', objectiveId: 'obj-1', shortId: 'PRJ-1', title: 'Do it', description: null, taskType: 'task', statusId: 's-1', priority: 'medium', storyPoints: null, dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0 }]),
      moveTaskStatus: () => of(undefined),
      ...apiOverrides
    };

    TestBed.configureTestingModule({ providers: [TaskBoardStore, { provide: TaskApiService, useValue: api }] });
    return TestBed.inject(TaskBoardStore);
  }

  it('loadBoard populates statuses and tasks grouped by column', async () => {
    const store = setup();
    await store.loadBoard('obj-1');

    expect(store.statuses().length).toBe(1);
    expect(store.tasks().length).toBe(1);
    expect(store.columnsWithTasks()[0].tasks.length).toBe(1);
  });

  it('moveTask optimistically updates statusId then confirms via API', async () => {
    const store = setup();
    await store.loadBoard('obj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-2');
  });

  it('moveTask reverts local state if the API call fails', async () => {
    const store = setup({ moveTaskStatus: () => throwError(() => ({ error: { detail: 'nope' } })) });
    await store.loadBoard('obj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-1');
    expect(store.error()).toBe('nope');
  });
});
```

- [ ] **Step 2: Run test, verify FAIL.**

- [ ] **Step 3: Write the store**

```typescript
// src/app/modules/work/state/task-board.store.ts
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../data-access/task-api.service';
import { toTaskStatusColumn, toWorkTask } from '../utils/task.mapper';
import { TaskStatusColumn, WorkTask } from '../models/task.model';
import { CreateTaskRequestDto, EditTaskRequestDto } from '../models/dto/task.dto';

interface TaskBoardState {
  readonly statuses: readonly TaskStatusColumn[];
  readonly tasks: readonly WorkTask[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: TaskBoardState = { statuses: [], tasks: [], loading: false, error: null };

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const TaskBoardStore = signalStore(
  { providedIn: 'root' },
  withState<TaskBoardState>(initialState),
  withComputed(({ statuses, tasks }) => ({
    columnsWithTasks: computed(() =>
      [...statuses()]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((status) => ({ status, tasks: tasks().filter((t) => t.statusId === status.id) }))
    )
  })),
  withMethods((store, api = inject(TaskApiService)) => ({
    async loadBoard(objectiveId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [statusDtos, taskDtos] = await Promise.all([
          firstValueFrom(api.getStatuses(objectiveId)),
          firstValueFrom(api.getTasks(objectiveId))
        ]);
        patchState(store, {
          statuses: statusDtos.map(toTaskStatusColumn),
          tasks: taskDtos.map(toWorkTask),
          loading: false
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load the board.'), loading: false });
      }
    },

    async createTask(objectiveId: string, request: CreateTaskRequestDto): Promise<WorkTask | null> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.createTask(objectiveId, request));
        const task = toWorkTask(dto);
        patchState(store, { tasks: [...store.tasks(), task] });
        return task;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the task.') });
        return null;
      }
    },

    async editTask(taskId: string, request: EditTaskRequestDto): Promise<boolean> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.editTask(taskId, request));
        const updated = toWorkTask(dto);
        patchState(store, { tasks: store.tasks().map((t) => (t.id === taskId ? updated : t)) });
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to update the task.') });
        return false;
      }
    },

    async moveTask(taskId: string, newStatusId: string): Promise<void> {
      const previous = store.tasks();
      patchState(store, {
        tasks: previous.map((t) => (t.id === taskId ? { ...t, statusId: newStatusId } : t)),
        error: null
      });
      try {
        await firstValueFrom(api.moveTaskStatus(taskId, newStatusId));
      } catch (err) {
        patchState(store, { tasks: previous, error: extractError(err, 'Failed to move the task.') });
      }
    }
  }))
);
```

- [ ] **Step 4: Run test, verify PASS. Step 5: Commit.**

```bash
git add src/app/modules/work/state/task-board.store.ts src/app/modules/work/state/task-board.store.spec.ts
git commit -m "feat(work): TaskBoardStore - optimistic move, board/backlog shared state"
```

### Task 5: `ui/task-card` and `ui/task-board-column` (dumb components)

**Files:**
- Create: `src/app/modules/work/ui/task-card/task-card.component.ts`
- Create: `src/app/modules/work/ui/task-board-column/task-board-column.component.ts`

**Interfaces:**
- Consumes: `WorkTask`, `TaskStatusColumn` (Task 2).
- Produces: `TaskCardComponent` (input `task: WorkTask`), `TaskBoardColumnComponent` (inputs `status: TaskStatusColumn`, `tasks: WorkTask[]`; output `taskDropped: { taskId: string, newStatusId: string }`).

- [ ] **Step 1: Write `TaskCardComponent`** — signal inputs, priority badge colored via `var(--color-...)` tokens (read `docs/design/COLOR_PALETTES.md` for the token names mapped to priority-like severity levels, reusing whichever existing severity/priority color tokens already exist rather than inventing new ones):

```typescript
// src/app/modules/work/ui/task-card/task-card.component.ts
import { Component, input } from '@angular/core';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  template: `
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id">
      <span class="task-card__short-id">{{ task().shortId }}</span>
      <p class="task-card__title">{{ task().title }}</p>
      <div class="task-card__meta">
        <span class="task-card__priority" [attr.data-priority]="task().priority">{{ task().priority }}</span>
        @if (task().dueDate) {
          <span class="task-card__due-date">{{ task().dueDate | date: 'MMM d' }}</span>
        }
        @if (task().estimatedHours) {
          <span class="task-card__hours">{{ task().estimatedHours }}h</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 12px; cursor: grab; }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 4px 0; font-size: 13px; color: var(--color-text-primary); }
    .task-card__meta { display: flex; gap: 8px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__priority[data-priority="critical"], .task-card__priority[data-priority="high"] { color: var(--color-danger); }
  `],
  imports: []
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
}
```

(Add the Angular `DatePipe` to `imports` and module imports as needed — check how `date` pipe is imported elsewhere in this codebase, e.g. `CommonModule` vs standalone `DatePipe`, and match that convention.)

- [ ] **Step 2: Write `TaskBoardColumnComponent`** with `cdkDropList`:

```typescript
// src/app/modules/work/ui/task-board-column/task-board-column.component.ts
import { Component, input, output } from '@angular/core';
import { CdkDropList, CdkDrag, CdkDragDrop } from '@angular/cdk/drag-drop';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-board-column',
  standalone: true,
  imports: [CdkDropList, CdkDrag, TaskCardComponent],
  template: `
    <div class="task-board-column">
      <h3 class="task-board-column__title">{{ status().name }} ({{ tasks().length }})</h3>
      <div
        cdkDropList
        [id]="status().id"
        [cdkDropListData]="tasks()"
        [cdkDropListConnectedTo]="connectedListIds()"
        (cdkDropListDropped)="onDrop($event)"
        class="task-board-column__list"
      >
        @for (task of tasks(); track task.id) {
          <div cdkDrag [cdkDragData]="task">
            <app-task-card [task]="task" />
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .task-board-column { background: var(--color-surface-secondary); border-radius: 10px; padding: 10px; min-width: 260px; }
    .task-board-column__title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; }
    .task-board-column__list { display: flex; flex-direction: column; gap: 8px; min-height: 40px; }
  `]
})
export class TaskBoardColumnComponent {
  status = input.required<TaskStatusColumn>();
  tasks = input.required<WorkTask[]>();
  connectedListIds = input<string[]>([]);
  taskDropped = output<{ taskId: string; newStatusId: string }>();

  onDrop(event: CdkDragDrop<WorkTask[]>): void {
    if (event.previousContainer === event.container) return;
    const task = event.item.data as WorkTask;
    this.taskDropped.emit({ taskId: task.id, newStatusId: event.container.id });
  }
}
```

- [ ] **Step 3: No unit test for these two presentational components in this task — component-level rendering is covered by Task 6's `TaskBoardComponent` integration test, matching this codebase's existing convention of testing dumb `ui/*` components only through their smart-page consumer unless they have independent branching logic (neither does here).**

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/ui/task-card/task-card.component.ts src/app/modules/work/ui/task-board-column/task-board-column.component.ts
git commit -m "feat(work): TaskCardComponent, TaskBoardColumnComponent"
```

### Task 6: `TaskBoardComponent` (feature page) — wires the Board tab

**Files:**
- Create: `src/app/modules/work/feature/task-board/task-board.component.ts`
- Modify: `src/app/modules/work/work.routes.ts` — replace the `board` route's `loadComponent` target
- Test: `src/app/modules/work/feature/task-board/task-board.component.spec.ts`

**Interfaces:**
- Consumes: `TaskBoardStore` (Task 4), `TaskBoardColumnComponent` (Task 5), `ActivatedRoute` (for `milestoneId` param — read `milestone-tree-tab.component.ts` for the exact param-access convention: `route.snapshot.paramMap.get('milestoneId')` vs an injected resolver — match it).

- [ ] **Step 1: Read `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` in full to confirm the exact pattern for reading the parent route's `milestoneId` param inside a child-route feature component.**

- [ ] **Step 2: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TaskBoardComponent } from './task-board.component';
import { TaskBoardStore } from '../../state/task-board.store';

describe('TaskBoardComponent', () => {
  it('loads the board for the current milestoneId on init', async () => {
    const loadBoard = jasmine.createSpy('loadBoard').and.resolveTo(undefined);
    const storeStub = {
      loadBoard, columnsWithTasks: () => [], loading: () => false, error: () => null, moveTask: jasmine.createSpy('moveTask')
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });
});
```

(Adjust the `ActivatedRoute` mock shape once Step 1's read confirms whether `milestoneId` is read from `route.parent` or directly, per the actual route nesting in `work.routes.ts`.)

- [ ] **Step 3: Run test, verify FAIL.**

- [ ] **Step 4: Write the component**

```typescript
// src/app/modules/work/feature/task-board/task-board.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { TaskBoardStore } from '../../state/task-board.store';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent],
  template: `
    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <p class="task-board__error">{{ store.error() }}</p>
    } @else {
      <div class="task-board">
        @for (column of store.columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            (taskDropped)="onTaskDropped($event)"
          />
        }
      </div>
    }
  `,
  styles: [`
    .task-board { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
    .task-board__error { color: var(--color-danger); }
  `]
})
export class TaskBoardComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  private readonly route = inject(ActivatedRoute);

  columnIds(): string[] {
    return this.store.columnsWithTasks().map((c) => c.status.id);
  }

  ngOnInit(): void {
    const milestoneId = this.route.parent?.snapshot.paramMap.get('milestoneId');
    if (milestoneId) void this.store.loadBoard(milestoneId);
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }
}
```

- [ ] **Step 5: Update `work.routes.ts`'s `board` route:**

```typescript
{
  path: 'board',
  loadComponent: () =>
    import('../../feature/task-board/task-board.component').then((m) => m.TaskBoardComponent)
}
```

(Adjust the relative import path to match this file's actual location relative to `work.routes.ts`.)

- [ ] **Step 6: Run test, verify PASS. Step 7: Commit.**

```bash
git add src/app/modules/work/feature/task-board/ src/app/modules/work/work.routes.ts
git commit -m "feat(work): TaskBoardComponent wired to the Board tab route"
```

### Task 7: `ui/task-create-modal` — owner direct-create vs. member request

**Files:**
- Create: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts`
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts` (add the "+ create task" trigger)
- Test: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.spec.ts`

**Interfaces:**
- Consumes: `TaskBoardStore.createTask` (Task 4), `InsufficientAllocationErrorDto` (Task 2), an `isObjectiveOwner: boolean` input already available from the existing objective-detail store (read `ProjectDetailStore`'s `getMilestoneDetail`/`ObjectiveDetail` model to confirm the exact field name for "is the current user this objective's owner" — likely `isOwner`, per Part 2's frontend-repo research notes citing `ObjectiveDetailViewModel`'s `IsOwner` field).
- Produces: `TaskCreateModalComponent` (inputs `objectiveId: string`, `isObjectiveOwner: boolean`; outputs `created: WorkTask`, `requestedInsteadOfCreated: void`, `closed: void`).

- [ ] **Step 1: Write the failing test — the two-path behavior is the interesting case:**

```typescript
import { TestBed } from '@angular/core/testing';
import { TaskCreateModalComponent } from './task-create-modal.component';
import { TaskBoardStore } from '../../state/task-board.store';

describe('TaskCreateModalComponent', () => {
  function setup(isObjectiveOwner: boolean, createTaskResult: any) {
    const createTask = jasmine.createSpy('createTask').and.resolveTo(createTaskResult);
    TestBed.configureTestingModule({
      imports: [TaskCreateModalComponent],
      providers: [{ provide: TaskBoardStore, useValue: { createTask, error: () => null } }]
    });
    const fixture = TestBed.createComponent(TaskCreateModalComponent);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('isObjectiveOwner', isObjectiveOwner);
    return { fixture, createTask };
  }

  it('owner submit calls store.createTask directly', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1' });
    fixture.detectChanges();

    await fixture.componentInstance.submit({ title: 'New task', taskType: 'task', priority: 'medium' } as any);

    expect(createTask).toHaveBeenCalledWith('obj-1', jasmine.objectContaining({ title: 'New task' }));
  });
});
```

(A second test for the non-owner path requires a `TaskCreationRequestApiService`, which does not exist until Part 2 of this frontend plan — write that second test and branch when Part 2 lands `createTaskCreationRequest`; for now, the modal's `submit` method conditionally calls a not-yet-injected method guarded by `isObjectiveOwner()`, and this task only wires and tests the owner branch. Leave a `// TODO(Part 2): non-owner path calls TaskCreationRequestApiService.create` comment at the branch point — this is the one legitimate forward-reference in this plan, since the two frontend parts ship together but are authored as separate self-contained files per FILE_CREATION_RULES.)

- [ ] **Step 2: Run test, verify FAIL.**

- [ ] **Step 3: Write the component** — reactive form with `title`/`taskType`/`priority`/`dueDate`/`estimatedHours`/`storyPoints`/`description` fields, `submit()` branches on `isObjectiveOwner()`, and on a caught 409 with `suggestedAction: 'extend_allocation'` shows an inline "Request more allocation" affordance (full wiring of that affordance's target modal is Part 2 of the backend-companion allocation-extend UI — out of this task's scope; this task only needs to detect and display the condition, per spec §2's "modal shows the returned availableSlackHours and an inline link").

- [ ] **Step 4: Run test, verify PASS. Step 5: Commit.**

```bash
git add src/app/modules/work/ui/task-create-modal/ src/app/modules/work/feature/task-board/task-board.component.ts
git commit -m "feat(work): TaskCreateModalComponent - owner direct-create path"
```

### Task 8: Backlog tab — `TaskBacklogComponent` + `ui/task-table`

**Files:**
- Create: `src/app/modules/work/ui/task-table/task-table.component.ts`
- Create: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `src/app/modules/work/work.routes.ts` — replace the `backlog` route's `loadComponent` target
- Test: `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts`

**Interfaces:**
- Consumes: `TaskBoardStore` (Task 4, reused unchanged — same store serves both tabs per spec §3), `TaskCreateModalComponent` (Task 7).
- Produces: `TaskTableComponent` (input `tasks: WorkTask[]`, sortable by title/status/dueDate/estimatedHours — a `sortBy` signal + computed sorted list, no external table library), `TaskBacklogComponent` (same `ngOnInit` pattern as `TaskBoardComponent`).

- [ ] **Step 1: Write `TaskTableComponent`** — plain `<table>` with `var(--color-...)` tokens, a local `sortBy`/`sortDirection` signal pair and a computed sorted-tasks list, click-to-sort column headers.

- [ ] **Step 2: Write `TaskBacklogComponent`**, near-identical `ngOnInit` to `TaskBoardComponent` (Task 6) calling the same `store.loadBoard(milestoneId)` — reusing the store confirms spec §3's "same endpoint, `view` shaping is a frontend concern" design (no `view` query param is actually sent; the two tabs just render the same `store.tasks()` differently, matching backend spec §5's actual single always-flat endpoint).

- [ ] **Step 3: Update `work.routes.ts`'s `backlog` route** to `TaskBacklogComponent`, same import-path pattern as Task 6 Step 5.

- [ ] **Step 4: Write a test for `TaskBacklogComponent` mirroring Task 6's test exactly (same `loadBoard` call assertion, different component).**

- [ ] **Step 5: Run tests, verify PASS.**

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including Tasks 1-8's new specs.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/ui/task-table/ src/app/modules/work/feature/task-backlog/ src/app/modules/work/work.routes.ts
git commit -m "feat(work): TaskBacklogComponent and TaskTableComponent - Backlog tab wired"
```

### Task 9: Manual browser verification

**Files:** none — verification only.

- [ ] **Step 1: Start the dev server** (`npm run start` or the project's documented dev command) and navigate to a Project → an Objective's Board tab.

- [ ] **Step 2: Confirm columns render from real `task-statuses` data, cards render from real `tasks` data (or empty states if the backend plan hasn't shipped yet — coordinate timing with the backend plan's Part 1).**

- [ ] **Step 3: Drag a card between columns, confirm the `PATCH .../tasks/{id}/status` network call fires and the card stays in its new column after a page refresh.**

- [ ] **Step 4: Switch to the Backlog tab, confirm the same tasks render as a sortable table.**

- [ ] **Step 5: Trigger the 409 slack-exceeded case (create a task with `estimatedHours` larger than the objective's remaining allocation) and confirm the inline "Request more allocation" message appears instead of a generic error toast.**

- [ ] **Step 6: Report findings — no commit for this task (verification-only, no code changes expected unless a bug is found, in which case fix it as a new commit referencing the task it belongs to).**

## Part 1 complete
