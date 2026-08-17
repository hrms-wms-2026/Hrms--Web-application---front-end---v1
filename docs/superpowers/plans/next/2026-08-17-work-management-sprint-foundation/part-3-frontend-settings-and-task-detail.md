# Work Management — Objective Settings, Task Detail Popup & Assignee UX (Part 3 of 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on the backend repo's Part 1 and Part 2 being deployed** (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-17-work-management-sprint-foundation/`) — this plan calls endpoints those parts add (`CreateTaskStatus`, `DeleteTaskStatus`, `EditTaskStatus` with `Visibility`, the Sprint CRUD endpoints, and `CreateTaskRequest.SprintId`).

**Goal:** Frontend for the owner-only "Settings" tab (Task Status list/create/edit/delete/Public-Private),
a task-detail popup (doesn't exist today — confirmed neither `TaskCardComponent` nor
`TaskTableComponent` has a click handler), and the task-create modal gaining a required Sprint select
plus an optional "Assign to" field that chains Create→Assign sequentially.

**Architecture:** Follows this module's existing conventions exactly: `signalStore` for state,
thin `*ApiService` classes wrapping `HttpClient`, `*.mapper.ts` pure functions for DTO→model, owner
gating via the same `ProjectDetailStore.milestones()[...].isOwner` pattern already used by
`TaskBoardComponent`/`TaskBacklogComponent`.

**Tech Stack:** Angular (standalone components, signals, `@ngrx/signals`), RxJS `firstValueFrom`.

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-work-management-sprint-foundation-design.md`

## Global Constraints

- Work Management module only — `src/app/modules/work/**`. Do not touch `organization`,
  `layouts/main-layout`, `people`, `dashboard`, or `public`.
- Follow the existing file layout exactly: DTOs in `models/dto/`, models in `models/`, mappers in
  `utils/`, API services in `data-access/`, stores in `state/`, presentational components in `ui/`,
  routed components in `feature/`.
- The create-task modal's Create→Assign chaining is sequential (`await` the first call, only then
  fire the second) — not `Promise.all` — matching the explicit product requirement.
- The Settings tab must be **absent from the tab bar entirely** for non-owners, not merely
  disabled/greyed — same standard as every other owner-only UI surface in this module.

---

### Task 1: Sprint model, DTO, mapper, `SprintApiService`

**Files:**
- Create: `src/app/modules/work/models/sprint.model.ts`
- Create: `src/app/modules/work/models/dto/sprint.dto.ts`
- Create: `src/app/modules/work/utils/sprint.mapper.ts`
- Create: `src/app/modules/work/data-access/sprint-api.service.ts`
- Test: `src/app/modules/work/data-access/sprint-api.service.spec.ts`

**Interfaces:**
- Produces: `Sprint` model, `SprintDto`, `toSprint(dto: SprintDto): Sprint`, and
  `SprintApiService` with `getByObjective(objectiveId, activeOnly): Observable<SprintDto[]>`,
  `create(objectiveId, request): Observable<SprintDto>`, `edit(sprintId, request): Observable<SprintDto>`,
  `complete(sprintId): Observable<SprintDto>`, `achieve(sprintId): Observable<SprintDto>` — consumed by
  Task 2 here and by Part 4's Backlog UI.

- [ ] **Step 1: Write the model and DTO**

```typescript
// models/sprint.model.ts
export type SprintStatus = 'future' | 'active' | 'complete' | 'incomplete' | 'achieved';

export interface Sprint {
  id: string;
  objectiveId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  completedAt: Date | null;
  achievedAt: Date | null;
}
```

```typescript
// models/dto/sprint.dto.ts
export interface SprintDto {
  id: string;
  objectiveId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'future' | 'active' | 'complete' | 'incomplete' | 'achieved';
  completedAt: string | null;
  achievedAt: string | null;
}

export interface CreateSprintRequestDto {
  name: string;
  startDate: string;
  endDate: string;
}

export interface EditSprintRequestDto {
  name: string;
  startDate: string;
  endDate: string;
}
```

- [ ] **Step 2: Write the mapper**

```typescript
// utils/sprint.mapper.ts
import { Sprint } from '../models/sprint.model';
import { SprintDto } from '../models/dto/sprint.dto';

export function toSprint(dto: SprintDto): Sprint {
  return {
    id: dto.id,
    objectiveId: dto.objectiveId,
    name: dto.name,
    startDate: new Date(dto.startDate),
    endDate: new Date(dto.endDate),
    status: dto.status,
    completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    achievedAt: dto.achievedAt ? new Date(dto.achievedAt) : null
  };
}
```

- [ ] **Step 3: Write the failing test for `SprintApiService`**

Read `task-api.service.spec.ts` first to match its existing HTTP-testing style (likely
`HttpClientTestingModule`/`HttpTestingController`), then write the equivalent for
`SprintApiService.getByObjective`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { SprintApiService } from './sprint-api.service';
import { environment } from '../../../../environments/environment';

describe('SprintApiService', () => {
  let service: SprintApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SprintApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByObjective requests the activeOnly query param', () => {
    service.getByObjective('obj-1', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/sprints?activeOnly=true`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create posts to the sprints endpoint', () => {
    service.create('obj-1', { name: 'Sprint 1', startDate: '2026-09-01', endDate: '2026-09-14' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/sprints`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
```

If `task-api.service.spec.ts` uses a different HTTP-testing setup (e.g. `HttpClientTestingModule`
import rather than the standalone `provideHttpClientTesting()` providers), match that file's actual
style instead of the above — read it first, this is illustrative of the assertions needed, not the
exact boilerplate to copy blindly.

- [ ] **Step 4: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/sprint-api.service.spec.ts'`
Expected: FAIL — `SprintApiService` doesn't exist.

- [ ] **Step 5: Write `SprintApiService`**

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateSprintRequestDto, EditSprintRequestDto, SprintDto } from '../models/dto/sprint.dto';

@Injectable({ providedIn: 'root' })
export class SprintApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getByObjective(objectiveId: string, activeOnly: boolean): Observable<SprintDto[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<SprintDto[]>(`${this.baseUrl}/objectives/${objectiveId}/sprints`, { params });
  }

  create(objectiveId: string, request: CreateSprintRequestDto): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/objectives/${objectiveId}/sprints`, request);
  }

  edit(sprintId: string, request: EditSprintRequestDto): Observable<SprintDto> {
    return this.http.patch<SprintDto>(`${this.baseUrl}/sprints/${sprintId}`, request);
  }

  complete(sprintId: string): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/complete`, {});
  }

  achieve(sprintId: string): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/achieve`, {});
  }
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx ng test --watch=false --include='**/sprint-api.service.spec.ts'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/models/sprint.model.ts src/app/modules/work/models/dto/sprint.dto.ts src/app/modules/work/utils/sprint.mapper.ts src/app/modules/work/data-access/sprint-api.service.ts src/app/modules/work/data-access/sprint-api.service.spec.ts
git commit -m "feat(work): Sprint model/DTO/mapper and SprintApiService"
```

---

### Task 2: Task-create modal — required Sprint select + optional assignee, chained submit

**Files:**
- Modify: `src/app/modules/work/models/dto/task.dto.ts` (`CreateTaskRequestDto` gains `sprintId`)
- Modify: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts`
- Test: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.spec.ts`

**Interfaces:**
- Consumes: `SprintApiService.getByObjective` (Task 1), `TaskApiService.assignTask` (already exists).

- [ ] **Step 1: Add `sprintId` to the DTO**

In `task.dto.ts`, add `sprintId: string` (required, not optional — matches the backend's new
requirement) to `CreateTaskRequestDto`:

```typescript
export interface CreateTaskRequestDto {
  title: string;
  description?: string;
  taskType: WorkTaskDto['taskType'];
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  sprintId: string;
}
```

- [ ] **Step 2: Read the existing spec file to match its style, then write the failing tests**

Read `task-create-modal.component.spec.ts` first. Then add/extend:

```typescript
  it('disables submit until a sprint is selected', () => {
    // Arrange the component with activeSprints() populated via its input, no sprint chosen yet.
    // Assert the Create button is disabled, or that submit() is a no-op and no API call fires,
    // matching however this file's existing "invalid form" tests already assert (title-required
    // case) - mirror that exact assertion style.
  });

  it('on submit with an assignee selected, calls createTask then assignTask with the returned task id, in order', async () => {
    // Arrange: mock TaskBoardStore.createTask to resolve a WorkTask with id 'task-1'; mock
    // TaskApiService.assignTask (spy). Set an assignee in the component's new assignee field.
    // Act: call submit(). Await it.
    // Assert: createTask was called, THEN assignTask was called with ('task-1', theChosenEmployeeId) -
    // verify ordering via a shared call-order array both spies push into, or via Jasmine's
    // call-order utilities if this codebase's existing tests already use that pattern (check other
    // *.spec.ts files in this module for the established ordering-assertion convention first).
  });

  it('on submit with no assignee selected, calls createTask only, never assignTask', async () => {
    // Same arrangement without an assignee chosen - assert assignTask was never called.
  });
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx ng test --watch=false --include='**/task-create-modal.component.spec.ts'`
Expected: FAIL — the component doesn't have a sprint/assignee field or chaining logic yet.

- [ ] **Step 4: Extend the component**

```typescript
import { Component, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CreateTaskRequestDto, InsufficientAllocationErrorDto, WorkTaskDto } from '../../models/dto/task.dto';
import { WorkTask } from '../../models/task.model';
import { Sprint } from '../../models/sprint.model';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-task-create-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Create task" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
        <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
          Sprint
          <select class="task-create-modal__select" [value]="sprintId()" (change)="sprintId.set($any($event.target).value)">
            <option value="" disabled selected>Select a sprint</option>
            @for (sprint of activeSprints(); track sprint.id) {
              <option [value]="sprint.id">{{ sprint.name }}</option>
            }
          </select>
          @if (errors()['sprintId']) {
            <span class="text-xs text-[var(--color-danger-text)]">{{ errors()['sprintId'] }}</span>
          }
        </label>
        <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
          Assign to (optional)
          <select class="task-create-modal__select" [value]="assigneeEmployeeId()" (change)="assigneeEmployeeId.set($any($event.target).value)">
            <option value="">Unassigned</option>
            @for (member of assignableMembers(); track member.employeeId) {
              <option [value]="member.employeeId">{{ member.name }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
          Type
          <select class="task-create-modal__select" [value]="taskType()" (change)="taskType.set($any($event.target).value)">
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="story">Story</option>
            <option value="feature">Feature</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
          Priority
          <select class="task-create-modal__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
        <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
        <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
        <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />

        @if (allocationHint()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert" data-testid="allocation-hint">
            Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available).
            <button type="button" class="task-create-modal__link" (click)="requestMoreAllocation.emit()">
              Request more allocation
            </button>
          </p>
        } @else if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
            {{ isObjectiveOwner() ? 'Create' : 'Request' }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .task-create-modal__select {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--color-surface);
      color: var(--color-text-primary);
    }
    .task-create-modal__link {
      background: none;
      border: none;
      color: var(--color-danger);
      text-decoration: underline;
      cursor: pointer;
      padding: 0;
      margin-left: 4px;
    }
  `]
})
export class TaskCreateModalComponent {
  private readonly store = inject(TaskBoardStore);
  private readonly taskApi = inject(TaskApiService);

  open = input(false);
  objectiveId = input.required<string>();
  isObjectiveOwner = input.required<boolean>();
  activeSprints = input<readonly Sprint[]>([]);
  assignableMembers = input<readonly { employeeId: string; name: string }[]>([]);

  created = output<WorkTask>();
  requestedInsteadOfCreated = output<void>();
  requestMoreAllocation = output<void>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  taskType = signal<WorkTaskDto['taskType']>('task');
  priority = signal<WorkTaskDto['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  sprintId = signal('');
  assigneeEmployeeId = signal('');
  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  estimatedHoursDisplay(): string {
    return this.estimatedHours() == null ? '' : String(this.estimatedHours());
  }

  storyPointsDisplay(): string {
    return this.storyPoints() == null ? '' : String(this.storyPoints());
  }

  onEstimatedHoursChange(value: string): void {
    this.estimatedHours.set(value === '' ? null : Number(value));
  }

  onStoryPointsChange(value: string): void {
    this.storyPoints.set(value === '' ? null : Number(value));
  }

  async submit(override?: CreateTaskRequestDto): Promise<void> {
    const request = override ?? this.buildRequest();
    if (!override) {
      const fieldErrors: Record<string, string> = {};
      if (!request.title.trim()) fieldErrors['title'] = 'Title is required.';
      if (!request.sprintId) fieldErrors['sprintId'] = 'Sprint is required.';
      this.errors.set(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.allocationHint.set(null);

    try {
      if (!this.isObjectiveOwner()) {
        await firstValueFrom(this.taskApi.createTaskCreationRequest(this.objectiveId(), request));
        this.requestedInsteadOfCreated.emit();
        this.closed.emit();
        return;
      }

      const result = await this.store.createTask(this.objectiveId(), request);
      if (result && 'availableSlackHours' in result) {
        this.allocationHint.set(result);
        return;
      }
      if (result) {
        const assigneeId = this.assigneeEmployeeId();
        if (assigneeId) {
          await firstValueFrom(this.taskApi.assignTask(result.id, assigneeId));
        }
        this.created.emit(result);
        this.closed.emit();
        return;
      }

      this.errorMessage.set(this.store.error() ?? 'Failed to create the task.');
    } finally {
      this.submitting.set(false);
    }
  }

  private buildRequest(): CreateTaskRequestDto {
    return {
      title: this.title().trim(),
      description: this.description() || undefined,
      taskType: this.taskType(),
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      sprintId: this.sprintId()
    };
  }
}
```

Note the create→assign chaining is inside the `if (result)` block, `await`-ed before `this.created.emit(result)` — sequential, not `Promise.all`, matching the explicit requirement. If assignment fails (throws), it propagates to the outer `try/catch`'s `finally` (submitting reset) but the task *was* already created — this mirrors real-world partial-failure semantics acceptably for this scope (the task exists; the owner can assign manually from the board if the second call fails) rather than attempting a rollback, which is out of scope.

`assignableMembers` is a new required-by-convention input this component now expects its parent
(`TaskBoardComponent`/`TaskBacklogComponent`) to supply — Task 2's Step 5 below wires that.

- [ ] **Step 5: Wire the new inputs from `TaskBoardComponent`**

In `task-board.component.ts`, the `<app-task-create-modal>` tag needs two new bindings. This requires
`TaskBoardComponent` to have a source of the objective's active sprints and assignable members. For
this plan, source both from a new signal populated at `ngOnInit` alongside the existing
`isObjectiveOwner` fetch:

```typescript
  protected readonly activeSprints = signal<Sprint[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
```

with the `ngOnInit` additions:

```typescript
    void this.sprintApi.getByObjective(id, true).then((dtos) => this.activeSprints.set(dtos.map(toSprint)));
```

(Wrap in `firstValueFrom` since `getByObjective` returns an `Observable`, not a Promise — i.e.
`firstValueFrom(this.sprintApi.getByObjective(id, true)).then(...)`.) For `assignableMembers`, this
plan does not build a new endpoint — reuse whatever member-listing capability
`ProjectDetailStore`/`ObjectiveMemberApiService` (seen referenced in `WorkApprovalsApiService`'s
constructor in the research pass) already exposes for a given objective. Read
`src/app/modules/work/data-access/objective-member-api.service.ts` before wiring this — if it exposes
a `getMembers(objectiveId)`-shaped method, use it directly; if the exact method name differs, use the
one that lists an Objective's active members with a display name.

Add the two new template bindings on `<app-task-create-modal>`:
```html
        [activeSprints]="activeSprints()"
        [assignableMembers]="assignableMembers()"
```

Apply the identical wiring to `TaskBacklogComponent` (it renders the same modal per the earlier
research findings — `[isObjectiveOwner]="isObjectiveOwner()"` binding confirmed present there too).

- [ ] **Step 6: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/task-create-modal.component.spec.ts'`
Expected: PASS.

- [ ] **Step 7: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS (965+ existing specs plus this task's new ones).

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/ui/task-create-modal/ src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): task-create modal requires a Sprint and can optionally assign on create"
```

---

### Task 3: Task Status API — Create/Delete + `Visibility` on Edit

**Files:**
- Modify: `src/app/modules/work/models/dto/task.dto.ts` (`TaskStatusDto`, `EditTaskStatusRequestDto` gain `visibility`; new `CreateTaskStatusRequestDto`)
- Modify: `src/app/modules/work/models/task.model.ts` (`TaskStatusColumn` gains `visibility`)
- Modify: `src/app/modules/work/utils/task.mapper.ts` (`toTaskStatusColumn` carries `visibility`)
- Modify: `src/app/modules/work/data-access/task-api.service.ts` (add `createStatus`, `deleteStatus`; extend `editTaskStatus` — check its actual current method name first, may differ from `editTask`)
- Test: `src/app/modules/work/data-access/task-api.service.spec.ts`

- [ ] **Step 1: Extend the DTOs and model**

In `task.dto.ts`, add `visibility: 'public' | 'private'` to `TaskStatusDto`, and add:

```typescript
export interface CreateTaskStatusRequestDto {
  name: string;
  displayOrder: number;
  visibility: 'public' | 'private';
  marksTaskComplete: boolean;
  requiresApproval: boolean;
  approverId?: string;
}

export interface EditTaskStatusRequestDto {
  name: string;
  displayOrder: number;
  requiresApproval: boolean;
  approverId?: string;
  visibility: 'public' | 'private';
}
```

(If an `EditTaskStatusRequestDto` already exists with different fields, extend it in place rather than
duplicating — check first with `grep -n "EditTaskStatusRequestDto" src/app/modules/work/models/dto/task.dto.ts`.)

In `task.model.ts`, add `visibility: 'public' | 'private';` to `TaskStatusColumn`.

- [ ] **Step 2: Update the mapper**

In `task.mapper.ts`, add `visibility: dto.visibility` to `toTaskStatusColumn`'s return object.

- [ ] **Step 3: Write the failing test for the two new API methods**

Read `task-api.service.spec.ts` first to match its style, then add tests asserting `createStatus`
POSTs to `objectives/{objectiveId}/task-statuses` and `deleteStatus` sends a DELETE to
`task-statuses/{id}` — same request/response assertion pattern as Task 1's `SprintApiService` tests
above.

- [ ] **Step 4: Run to verify failure, then implement**

Run: `npx ng test --watch=false --include='**/task-api.service.spec.ts'`
Expected: FAIL — methods don't exist.

In `task-api.service.ts`, add:

```typescript
  createStatus(objectiveId: string, request: CreateTaskStatusRequestDto): Observable<TaskStatusDto> {
    return this.http.post<TaskStatusDto>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses`, request);
  }

  deleteStatus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/task-statuses/${id}`);
  }
```

Update the existing `editTaskStatus`-equivalent method call site (find its actual current name via
`grep -n "task-statuses" src/app/modules/work/data-access/task-api.service.ts`) to also send
`visibility` in its request body, matching whatever that method's current signature/name already is.

Import `CreateTaskStatusRequestDto` in this file's `task.dto` import list.

- [ ] **Step 5: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/task-api.service.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/models/task.model.ts src/app/modules/work/utils/task.mapper.ts src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts
git commit -m "feat(work): TaskApiService gains createStatus/deleteStatus, editStatus carries Visibility"
```

---

### Task 4: Objective Settings page (owner-only tab)

**Files:**
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts`
- Modify: `src/app/modules/work/work.routes.ts`
- Create: `src/app/modules/work/feature/objective-settings/objective-settings.component.ts`
- Create: `src/app/modules/work/feature/objective-settings/objective-settings.component.spec.ts`

**Interfaces:**
- Consumes: `TaskApiService.getStatuses/createStatus/deleteStatus`, the extended edit-status method
  (Task 3).

- [ ] **Step 1: Make the sub-menu tab list owner-aware**

`MilestoneSubMenuComponent`'s `TABS` array is currently a module-level constant, rendered
unconditionally for every viewer. Change it to a computed list gated by a new `isOwner` input:

```typescript
import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface SubMenuTab {
  label: string;
  segment: string;
}

const BASE_TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board' },
  { label: 'Backlog', segment: 'backlog' },
  { label: 'My Task', segment: 'my-task' },
  { label: 'List', segment: 'list' },
  { label: 'Approvals', segment: 'approvals' }
];

const SETTINGS_TAB: SubMenuTab = { label: 'Settings', segment: 'settings' };

@Component({
  selector: 'app-milestone-sub-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="mb-2">
      <p
        class="mb-1 text-sm font-medium text-[var(--color-text-primary)]"
        data-testid="sub-menu-milestone-title"
      >
        {{ milestoneTitle() }}
      </p>
      <nav class="flex gap-1 border-b border-[var(--color-border)]" data-testid="sub-menu-tabs">
        @for (tab of tabs(); track tab.segment) {
          <a
            [routerLink]="['milestones', milestoneId(), tab.segment]"
            routerLinkActive="border-b-2 border-[var(--color-focus-ring)] font-semibold text-[var(--color-text-primary)]"
            class="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            data-testid="sub-menu-tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [attr.data-testid]="'sub-menu-tab-icon-' + tab.segment">
              @switch (tab.segment) {
                @case ('tree') {
                  <circle cx="6" cy="5" r="2" />
                  <circle cx="6" cy="19" r="2" />
                  <circle cx="18" cy="12" r="2" />
                  <path d="M6 7v10M6 12h10" />
                }
                @case ('board') {
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16M15 4v16" />
                }
                @case ('backlog') {
                  <path d="M4 6h16M4 12h16M4 18h10" />
                }
                @case ('my-task') {
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                }
                @case ('list') {
                  <circle cx="4.5" cy="6" r="1" />
                  <circle cx="4.5" cy="12" r="1" />
                  <circle cx="4.5" cy="18" r="1" />
                  <path d="M9 6h11M9 12h11M9 18h11" />
                }
                @case ('approvals') {
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l2.5 2.5L16 9" />
                }
                @case ('settings') {
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                }
              }
            </svg>
            {{ tab.label }}
          </a>
        }
      </nav>
    </div>
  `
})
export class MilestoneSubMenuComponent {
  milestoneId = input.required<string>();
  milestoneTitle = input.required<string>();
  isOwner = input(false);

  readonly tabs = computed(() => (this.isOwner() ? [...BASE_TABS, SETTINGS_TAB] : BASE_TABS));
}
```

- [ ] **Step 2: Wire `isOwner` from the parent**

In `project-detail.component.ts`, find the `<app-milestone-sub-menu>` usage and add
`[isOwner]="..."` bound to whatever this component's existing per-milestone `isOwner` signal/computed
already is (it renders inside a per-milestone context, so the same `isOwner` value
`TaskBoardComponent`/`TaskBacklogComponent` each independently compute via
`ProjectDetailStore.milestones()[...].isOwner` should be available or derivable here too — read the
file to find the exact existing selected-milestone signal to reuse, don't introduce a second parallel
ownership-lookup mechanism).

- [ ] **Step 3: Add the route**

In `work.routes.ts`, add a new child route alongside the existing `approvals`/`my-task`/`list` entries:

```typescript
        { path: 'settings', loadComponent: () => import('./feature/objective-settings/objective-settings.component').then(m => m.ObjectiveSettingsComponent) }
```

- [ ] **Step 4: Write the failing test for `ObjectiveSettingsComponent`**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ObjectiveSettingsComponent } from './objective-settings.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('ObjectiveSettingsComponent', () => {
  let fixture: ComponentFixture<ObjectiveSettingsComponent>;
  let taskApi: jasmine.SpyObj<TaskApiService>;

  beforeEach(async () => {
    taskApi = jasmine.createSpyObj('TaskApiService', ['getStatuses', 'createStatus', 'deleteStatus']);
    taskApi.getStatuses.and.returnValue(of([
      { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's2', name: 'Done', displayOrder: 3, requiresApproval: false, approverId: null, marksTaskComplete: true, visibility: 'private' }
    ]));

    await TestBed.configureTestingModule({
      imports: [ObjectiveSettingsComponent],
      providers: [
        { provide: TaskApiService, useValue: taskApi },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: { get: () => 'obj-1' } } }, snapshot: { paramMap: { get: () => null } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectiveSettingsComponent);
    fixture.detectChanges();
  });

  it('loads and displays the objective statuses with their visibility', () => {
    expect(taskApi.getStatuses).toHaveBeenCalledWith('obj-1');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('To Do');
    expect(text).toContain('Done');
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/objective-settings.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 6: Implement `ObjectiveSettingsComponent`**

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskStatusColumn } from '../../models/task.model';
import { toTaskStatusColumn } from '../../utils/task.mapper';

@Component({
  selector: 'app-objective-settings',
  standalone: true,
  imports: [InputComponent, ButtonComponent],
  template: `
    <h2 class="mb-3 text-base font-semibold text-[var(--color-text-primary)]">Task statuses</h2>

    @if (loading()) {
      <p>Loading…</p>
    } @else {
      <table class="objective-settings__table">
        <thead>
          <tr><th>Name</th><th>Order</th><th>Visibility</th><th>Marks complete</th><th></th></tr>
        </thead>
        <tbody>
          @for (status of statuses(); track status.id) {
            <tr>
              <td>{{ status.name }}</td>
              <td>{{ status.displayOrder }}</td>
              <td>{{ status.visibility }}</td>
              <td>{{ status.marksTaskComplete ? 'Yes' : 'No' }}</td>
              <td><app-button variant="secondary" (pressed)="remove(status.id)">Delete</app-button></td>
            </tr>
          }
        </tbody>
      </table>

      <div class="mt-4 flex flex-col gap-2">
        <app-input label="New status name" [value]="newName()" (valueChange)="newName.set($event)" />
        <label class="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" [checked]="newIsPrivate()" (change)="newIsPrivate.set($any($event.target).checked)" />
          Private (only I can move a task into this status)
        </label>
        <label class="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" [checked]="newMarksComplete()" (change)="newMarksComplete.set($any($event.target).checked)" />
          Marks a task as complete
        </label>
        <app-button variant="primary" (pressed)="add()">Add status</app-button>
      </div>

      @if (errorMessage()) {
        <p class="mt-2 text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
      }
    }
  `,
  styles: [`
    .objective-settings__table { width: 100%; border-collapse: collapse; }
    .objective-settings__table th, .objective-settings__table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--color-border); font-size: 13px; }
  `]
})
export class ObjectiveSettingsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);

  protected readonly loading = signal(true);
  protected readonly statuses = signal<TaskStatusColumn[]>([]);
  protected readonly newName = signal('');
  protected readonly newIsPrivate = signal(false);
  protected readonly newMarksComplete = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private objectiveId = '';

  async ngOnInit(): Promise<void> {
    this.objectiveId = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? '';
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    const dtos = await firstValueFrom(this.taskApi.getStatuses(this.objectiveId));
    this.statuses.set(dtos.map(toTaskStatusColumn));
    this.loading.set(false);
  }

  async add(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.createStatus(this.objectiveId, {
        name,
        displayOrder: this.statuses().length,
        visibility: this.newIsPrivate() ? 'private' : 'public',
        marksTaskComplete: this.newMarksComplete(),
        requiresApproval: false
      }));
      this.newName.set('');
      this.newIsPrivate.set(false);
      this.newMarksComplete.set(false);
      await this.reload();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.detail || 'Failed to add the status.');
    }
  }

  async remove(statusId: string): Promise<void> {
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.deleteStatus(statusId));
      await this.reload();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.detail || 'Move all tasks out of this status before deleting it.');
    }
  }
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `npx ng test --watch=false --include='**/objective-settings.component.spec.ts'`
Expected: PASS.

- [ ] **Step 8: Manual route guard check**

This plan relies on the tab being **absent** for non-owners as the primary access control (matching
this module's existing convention — e.g. `TaskCreateModalComponent`'s owner/non-owner branching is UI
gating, with the *real* enforcement living server-side in `CreateTaskStatusCommandHandler`'s owner
check from the backend plan). Confirm no additional client-side route guard exists elsewhere in this
module that would need updating (`grep -rn "canActivate" src/app/modules/work/work.routes.ts`) — if
none exists today for the other tabs, none is needed here either, for consistency.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/work.routes.ts src/app/modules/work/feature/objective-settings/
git commit -m "feat(work): owner-only Objective Settings tab for task status configuration"
```

---

### Task 5: Task-detail popup

**Files:**
- Create: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.ts`
- Create: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts`
- Modify: `src/app/modules/work/ui/task-card/task-card.component.ts`
- Modify: `src/app/modules/work/ui/task-table/task-table.component.ts`
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts` (if it renders `TaskTableComponent` — confirm via `grep -n "app-task-table" src/app/modules/work/feature/task-backlog/task-backlog.component.ts`)

**Interfaces:**
- Produces: `TaskDetailModalComponent { open: input<boolean>, task: input<WorkTask | null>, closed: output<void> }` — a read-view; no new edit capability is built here (spec explicitly scopes this as "read-view with an Edit entry point into the existing edit flow," not a from-scratch editor).

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskDetailModalComponent } from './task-detail-modal.component';
import { WorkTask } from '../../models/task.model';

describe('TaskDetailModalComponent', () => {
  let fixture: ComponentFixture<TaskDetailModalComponent>;
  const task: WorkTask = {
    id: 't1', objectiveId: 'o1', shortId: 'EPOS-1', title: 'Do the thing', description: 'Details here',
    taskType: 'task', statusId: 's1', priority: 'high', storyPoints: 3, dueDate: new Date('2026-09-20'),
    estimatedHours: 8, completedHours: 0, progressPercent: 0
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TaskDetailModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();
  });

  it('shows the task shortId, title, description, and priority', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('EPOS-1');
    expect(text).toContain('Do the thing');
    expect(text).toContain('Details here');
    expect(text).toContain('high');
  });

  it('emits closed when the modal closes', () => {
    const spy = jasmine.createSpy();
    fixture.componentInstance.closed.subscribe(spy);
    fixture.componentInstance.onClose();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/task-detail-modal.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

```typescript
import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  imports: [ModalComponent, DatePipe],
  template: `
    <app-modal [open]="open()" [title]="task()?.shortId ?? ''" size="lg" (closed)="onClose()">
      @if (task(); as t) {
        <div class="flex flex-col gap-3">
          <h3 class="text-base font-semibold text-[var(--color-text-primary)]">{{ t.title }}</h3>
          @if (t.description) {
            <p class="text-sm text-[var(--color-text-secondary)]">{{ t.description }}</p>
          }
          <dl class="task-detail__grid">
            <dt>Type</dt><dd>{{ t.taskType }}</dd>
            <dt>Priority</dt><dd>{{ t.priority }}</dd>
            <dt>Due date</dt><dd>{{ t.dueDate ? (t.dueDate | date: 'MMM d, y') : '—' }}</dd>
            <dt>Estimated hours</dt><dd>{{ t.estimatedHours ?? '—' }}</dd>
            <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            <dt>Progress</dt><dd>{{ t.progressPercent }}%</dd>
            @if (t.storyPoints) {
              <dt>Story points</dt><dd>{{ t.storyPoints }}</dd>
            }
          </dl>
        </div>
      }
    </app-modal>
  `,
  styles: [`
    .task-detail__grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    .task-detail__grid dt { color: var(--color-text-secondary); }
    .task-detail__grid dd { margin: 0; color: var(--color-text-primary); }
  `]
})
export class TaskDetailModalComponent {
  open = input(false);
  task = input<WorkTask | null>(null);
  closed = output<void>();

  onClose(): void {
    this.closed.emit();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --watch=false --include='**/task-detail-modal.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Add a "View" affordance to `TaskCardComponent`**

```typescript
import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id" (click)="viewed.emit(task())">
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
    .task-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
    }
    .task-card__short-id { font-size: 11px; color: var(--color-text-secondary); }
    .task-card__title { margin: 4px 0; font-size: 13px; color: var(--color-text-primary); }
    .task-card__meta { display: flex; gap: 8px; font-size: 11px; color: var(--color-text-secondary); }
    .task-card__priority[data-priority="critical"],
    .task-card__priority[data-priority="high"] { color: var(--color-danger); }
  `]
})
export class TaskCardComponent {
  task = input.required<WorkTask>();
  viewed = output<WorkTask>();
}
```

Note this changes `cursor: grab` to `cursor: pointer` and adds a click-to-view handler — this card is
also drag-source for the Kanban board (per `TaskBoardColumnComponent`'s drag/drop wiring, referenced
in `task-board.component.ts`'s `taskDropped` handler). Read
`src/app/modules/work/ui/task-board-column/task-board-column.component.ts` before this step to confirm
its drag handlers are on the *column* or a *drag handle*, not the card's root click target — if drag
initiation and this new click-to-view handler would conflict (a `mousedown`-based drag library often
does), add a small drag-distance/movement threshold check, or move the click target to a dedicated
"View" icon/button inside the card rather than the whole card surface, to avoid every drag also firing
a view-open. Prefer the dedicated icon-button approach if there's any doubt — it's unambiguous and
doesn't risk the drag interaction at all:

```html
    <div class="task-card" [attr.data-testid]="'task-card-' + task().id">
      <div class="task-card__header">
        <span class="task-card__short-id">{{ task().shortId }}</span>
        <button type="button" class="task-card__view-btn" aria-label="View task" (click)="viewed.emit(task()); $event.stopPropagation()">👁</button>
      </div>
      <p class="task-card__title">{{ task().title }}</p>
      ...
```
with `.task-card { cursor: grab; }` restored and a small `.task-card__view-btn { background: none; border: none; cursor: pointer; }` style added. Use this icon-button version if the plain drag-vs-click risk from the first version can't be cleanly ruled out after reading `task-board-column.component.ts`.

- [ ] **Step 6: Add a "View" action to `TaskTableComponent`**

```typescript
  // Add to the template's <thead> row: <th>View</th>
  // Add to each <tbody> row, as the last <td>:
  //   <td><button type="button" class="task-table__view-btn" (click)="viewed.emit(task)">View</button></td>
  // Add to the component class: viewed = output<WorkTask>();
  // Add a style: .task-table__view-btn { background: none; border: 1px solid var(--color-border); border-radius: 6px; padding: 4px 8px; cursor: pointer; color: var(--color-text-primary); }
```

Implement this fully (the above is a description of the exact edit, not a placeholder — apply it as
literal template/class/style changes to the existing file read in Task Right-Sizing's research, same
mechanical pattern as Step 5).

- [ ] **Step 7: Wire the modal into `TaskBoardComponent`**

```typescript
  // Add to imports: TaskDetailModalComponent
  // Add to the template, alongside the existing app-task-create-modal:
  //   <app-task-detail-modal [open]="detailOpen()" [task]="selectedTask()" (closed)="detailOpen.set(false)" />
  // Add to app-task-board-column's binding a (taskViewed)="onTaskViewed($event)" if
  // TaskBoardColumnComponent forwards TaskCardComponent's `viewed` output (check that file; if it
  // doesn't already forward child outputs, add `taskViewed = output<WorkTask>();` there too and
  // forward TaskCardComponent's (viewed) to it in its own template).
  // Add to the component class:
  //   protected readonly detailOpen = signal(false);
  //   protected readonly selectedTask = signal<WorkTask | null>(null);
  //   onTaskViewed(task: WorkTask): void { this.selectedTask.set(task); this.detailOpen.set(true); }
```

Implement fully per this description, reading `task-board-column.component.ts` first to know its
actual current output-forwarding shape before wiring `onTaskViewed`.

- [ ] **Step 8: Wire the modal into `TaskBacklogComponent`** (if it uses `TaskTableComponent`)

Same pattern as Step 7 — add `(viewed)="onTaskViewed($event)"` to the `<app-task-table>` usage and the
same `detailOpen`/`selectedTask`/`onTaskViewed` trio to the component class, plus the
`<app-task-detail-modal>` tag in the template.

- [ ] **Step 9: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/modules/work/ui/task-detail-modal/ src/app/modules/work/ui/task-card/task-card.component.ts src/app/modules/work/ui/task-table/task-table.component.ts src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): task-detail popup, opened via a View action on both the board card and backlog table"
```

---

## End of Part 3

Part 3 is complete when all 5 tasks are committed and `npx ng test --watch=false` is fully green.
This unblocks Part 4 (Backlog Sprint CRUD UI + Board Active-Sprint scoping), which reuses
`SprintApiService`/`Sprint` model from Task 1 here.
