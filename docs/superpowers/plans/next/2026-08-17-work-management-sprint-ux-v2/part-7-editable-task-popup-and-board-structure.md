# Work Management — Editable Task Popup & Board Structure Tab (Part 7 of 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on the backend repo's Part 5** (TaskEditRequest + ReorderTaskStatuses endpoints must exist) **and this repo's Part 6** (`EmployeeAvatarComponent`).

**Goal:** Make `TaskDetailModalComponent` always-editable — owner's edits save directly via the
existing `EditTaskCommand` API, a non-owner member's edits go through the new `TaskEditRequest` flow
(button reads "Request" instead of "Save changes"). Add a "Board structure" tab inside Objective
Settings for drag-reordering statuses, toggling Public/Private, and picking the one complete status —
saved as one atomic bulk update via `ReorderTaskStatusesCommand`.

**Tech Stack:** Angular (standalone components, signals), Angular CDK drag-drop (already a dependency
of this project via `TaskBoardColumnComponent`'s existing drag/drop wiring — reuse it, don't add a
new drag library).

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-work-management-sprint-ux-v2-design.md`

## Global Constraints

- Work Management module only.
- Nothing above or around the existing sub-menu tab bar changes; only existing theme tokens/colors —
  no new colors introduced (same constraint as every prior frontend part in this feature).
- The task-detail popup's Save/Request distinction is driven by `isObjectiveOwner`, the same signal
  every other owner-gated component in this module already computes via
  `ProjectDetailStore.milestones()[...].isOwner` — do not invent a second ownership-detection
  mechanism.

---

### Task 1: DTOs, mapper, and API methods for `TaskEditRequest`

**Files:**
- Create: `src/app/modules/work/models/dto/task-edit-request.dto.ts`
- Modify: `src/app/modules/work/data-access/task-api.service.ts`
- Test: extend `src/app/modules/work/data-access/task-api.service.spec.ts`

- [ ] **Step 1: Write the DTOs**

```typescript
// models/dto/task-edit-request.dto.ts
export interface TaskEditRequestPayloadDto {
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  storyPoints: number | null;
}

export interface TaskEditRequestDto {
  id: string;
  taskId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: TaskEditRequestPayloadDto;
  requestedByName: string;
  createdAt: string;
}

export interface CreateTaskEditRequestDto {
  title: string;
  description?: string;
  priority: string;
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
}
```

- [ ] **Step 2: Write the failing test, then implement the API methods**

Follow the exact request/response assertion pattern already established in this spec file for
`createTaskCreationRequest`/`approveRequest`/etc (read the current file first). Add to
`TaskApiService`:

```typescript
  createTaskEditRequest(taskId: string, request: CreateTaskEditRequestDto): Observable<TaskEditRequestDto> {
    return this.http.post<TaskEditRequestDto>(`${this.baseUrl}/tasks/${taskId}/edit-requests`, request);
  }

  approveTaskEditRequest(id: string): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/task-edit-requests/${id}/approve`, {});
  }

  rejectTaskEditRequest(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-edit-requests/${id}/reject`, { comment });
  }

  cancelTaskEditRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-edit-requests/${id}/cancel`, {});
  }

  getMyTaskEditRequests(): Observable<TaskEditRequestDto[]> {
    return this.http.get<TaskEditRequestDto[]>(`${this.baseUrl}/task-edit-requests/mine`);
  }

  reorderTaskStatuses(objectiveId: string, updates: { statusId: string; displayOrder: number; visibility: string; marksTaskComplete: boolean }[]): Observable<TaskStatusDto[]> {
    return this.http.post<TaskStatusDto[]>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses/reorder`, { updates });
  }
```

Import `TaskEditRequestDto`/`CreateTaskEditRequestDto` from the new DTO file.

- [ ] **Step 3: Run to verify all pass, then commit**

Run: `npx ng test --watch=false --include='**/task-api.service.spec.ts'`
Expected: PASS.

```bash
git add src/app/modules/work/models/dto/task-edit-request.dto.ts src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts
git commit -m "feat(work): TaskApiService gains TaskEditRequest CRUD + reorderTaskStatuses"
```

---

### Task 2: `TaskDetailModalComponent` becomes always-editable

**Files:**
- Modify: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.ts`
- Modify: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts`
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts` and
  `task-backlog.component.ts` (pass the new `isObjectiveOwner` input through to the modal — both
  already compute this signal, per Global Constraints)

**Interfaces:**
- Changes: `TaskDetailModalComponent` gains `isObjectiveOwner: input.required<boolean>()`, editable
  form fields (mirroring `TaskCreateModalComponent`'s field set minus `taskType`/`sprintId`, matching
  what `EditTaskCommand`/`TaskEditRequestPayload` accept), and a `saved: output<WorkTask>()` /
  `requested: output<void>()` pair instead of being purely read-only.

- [ ] **Step 1: Write the failing tests**

```typescript
  it('owner sees a "Save changes" button that calls editTask directly', async () => {
    // Arrange with isObjectiveOwner=true, a mocked TaskApiService.editTask spy.
    // Act: change a field, click the save button.
    // Assert: editTask was called with the task's id and the changed fields; requestTaskEdit (below) was never called.
  });

  it('non-owner member sees a "Request" button that calls createTaskEditRequest instead', async () => {
    // Arrange with isObjectiveOwner=false, a mocked TaskApiService.createTaskEditRequest spy.
    // Act: change a field, click the request button.
    // Assert: createTaskEditRequest was called with the task's id and the changed fields; editTask was never called.
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include='**/task-detail-modal.component.spec.ts'`
Expected: FAIL — component is currently read-only.

- [ ] **Step 3: Implement**

```typescript
import { DatePipe } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkTask } from '../../models/task.model';
import { TaskApiService } from '../../data-access/task-api.service';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, DatePipe],
  template: `
    <app-modal [open]="open()" [title]="task()?.shortId ?? ''" size="lg" (closed)="onClose()">
      @if (task(); as t) {
        <div class="flex flex-col gap-3">
          <app-input label="Title" [value]="title()" (valueChange)="title.set($event)" />
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
          <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
            Priority
            <select class="task-detail__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
          <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
          <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />

          <dl class="task-detail__grid">
            <dt>Type</dt><dd>{{ t.taskType }}</dd>
            <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            <dt>Progress</dt><dd>{{ t.progressPercent }}%</dd>
          </dl>

          @if (errorMessage()) {
            <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
          }

          <div class="mt-2 flex justify-end gap-2">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="onClose()">Cancel</app-button>
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit(t.id)">
              {{ isObjectiveOwner() ? 'Save changes' : 'Request' }}
            </app-button>
          </div>
        </div>
      }
    </app-modal>
  `,
  styles: [`
    .task-detail__grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin-top: 8px; }
    .task-detail__grid dt { color: var(--color-text-secondary); }
    .task-detail__grid dd { margin: 0; color: var(--color-text-primary); }
    .task-detail__select { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
  `]
})
export class TaskDetailModalComponent {
  private readonly taskApi = inject(TaskApiService);

  open = input(false);
  task = input<WorkTask | null>(null);
  isObjectiveOwner = input.required<boolean>();
  closed = output<void>();
  saved = output<WorkTask>();
  requested = output<void>();

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  constructor() {
    // Populate the form whenever a new task is bound - see ngOnChanges-equivalent note below.
  }

  ngOnChanges(): void {
    const t = this.task();
    if (!t) return;
    this.title.set(t.title);
    this.description.set(t.description ?? '');
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
  }

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

  async submit(taskId: string): Promise<void> {
    this.submitting.set(true);
    this.errorMessage.set(null);
    const fields = {
      title: this.title().trim(),
      description: this.description() || undefined,
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined
    };

    try {
      if (this.isObjectiveOwner()) {
        const updated = await firstValueFrom(this.taskApi.editTask(taskId, fields));
        this.saved.emit(updated as unknown as WorkTask);
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(taskId, fields));
        this.requested.emit();
      }
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save.');
    } finally {
      this.submitting.set(false);
    }
  }

  onClose(): void {
    this.closed.emit();
  }
}
```

**`ngOnChanges` requires the component to declare `implements OnChanges`** — this codebase's other
components mostly use signal `input()` + `computed()` rather than lifecycle hooks; check whether
`Component`'s existing convention here uses an `effect()` inside the constructor instead (search
`grep -n "effect(" src/app/modules/work/ui/*.component.ts` for a precedent) and match that style if
one exists, rather than introducing `OnChanges` as a one-off pattern deviation. If no precedent exists
either way, `OnChanges` is acceptable — just add `import { Component, OnChanges, ... }` and
`implements OnChanges` on the class.

- [ ] **Step 4: Wire `isObjectiveOwner` through from `TaskBoardComponent`/`TaskBacklogComponent`**

Both already compute this signal for the create-modal — add the same binding to
`<app-task-detail-modal [isObjectiveOwner]="isObjectiveOwner()" ...>`.

- [ ] **Step 5: Run to verify all pass, then full frontend regression**

Run: `npx ng test --watch=false --include='**/task-detail-modal.component.spec.ts'` then
`npx ng test --watch=false`
Expected: PASS across the board.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/ui/task-detail-modal/ src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): task-detail popup is always editable - owner saves directly, member requests approval"
```

---

### Task 3: Board Structure tab

**Files:**
- Modify: `src/app/modules/work/feature/objective-settings/objective-settings.component.ts`
- Create: `src/app/modules/work/ui/board-structure-editor/board-structure-editor.component.ts`
- Test files for both

**Interfaces:**
- Produces: `BoardStructureEditorComponent { objectiveId: input.required<string>, statuses: input.required<readonly TaskStatusColumn[]>, saved: output<void> }` — the drag-reorder form, using Angular CDK's `cdkDropList`/`cdkDrag` (already used by `TaskBoardColumnComponent` — read that file first to match its exact CDK import/module style).

- [ ] **Step 1: Add an internal tab strip to `ObjectiveSettingsComponent`**

Add a `activeTab = signal<'task-statuses' | 'board-structure'>('task-statuses')` and two `<button>`s
above the existing table to switch between them, styled consistently with existing theme
tokens/patterns already used elsewhere in this component (border-bottom active-tab indicator, matching
`MilestoneSubMenuComponent`'s own active-tab styling convention — read that file for the exact
classes/pattern to reuse, don't invent new tab-styling CSS). When `board-structure` is active, render
`<app-board-structure-editor [objectiveId]="objectiveId" [statuses]="statuses()" (saved)="reload()" />`
instead of the existing table+add-form.

- [ ] **Step 2: Write the failing test for `BoardStructureEditorComponent`**

```typescript
  it('renders one row per status, in DisplayOrder, with a checkbox for private and a radio for complete', () => {
    // Arrange with 4 statuses (matching the earlier screenshot: To Do/In Process/Review/Done, Done complete+public... actually private per that screenshot's "Owner Gate" example - use whatever fixture fits).
    // Assert: 4 rows rendered in order, exactly one radio checked (the MarksTaskComplete=true row), checkboxes reflect each row's Visibility.
  });

  it('save button posts the current row order/visibility/complete-flag as one reorderTaskStatuses call', async () => {
    // Arrange, then simulate reordering (or just toggling a checkbox - full drag simulation isn't required for this unit test, CDK drag-drop is better verified manually per the E2E checklist), click Save.
    // Assert: taskApi.reorderTaskStatuses called once with objectiveId and an array matching every status's current DisplayOrder/Visibility/MarksTaskComplete.
  });

  it('changing which radio is checked moves MarksTaskComplete to exactly the new selection', () => {
    // Arrange, click a different status's radio.
    // Assert: exactly one status in the component's internal state now has MarksTaskComplete=true, and it's the newly-selected one.
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include='**/board-structure-editor.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `BoardStructureEditorComponent`**

```typescript
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskStatusColumn } from '../../models/task.model';

interface DraftRow {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  marksTaskComplete: boolean;
}

@Component({
  selector: 'app-board-structure-editor',
  standalone: true,
  imports: [CdkDropList, CdkDrag, ButtonComponent],
  template: `
    <div cdkDropList (cdkDropListDropped)="onDrop($event)" class="board-structure__list">
      @for (row of rows(); track row.id) {
        <div cdkDrag class="board-structure__row">
          <span class="board-structure__drag-handle" cdkDragHandle>⠿</span>
          <span class="board-structure__name">{{ row.name }}</span>
          <label class="board-structure__toggle">
            <input type="checkbox" [checked]="row.visibility === 'private'" (change)="toggleVisibility(row.id)" />
            Private
          </label>
          <label class="board-structure__toggle">
            <input type="radio" name="marksComplete" [checked]="row.marksTaskComplete" (change)="setComplete(row.id)" />
            Marks complete
          </label>
        </div>
      }
    </div>

    @if (errorMessage()) {
      <p class="board-structure__error" role="alert">{{ errorMessage() }}</p>
    }

    <app-button variant="primary" [loading]="saving()" (pressed)="save()">Save</app-button>
  `,
  styles: [`
    .board-structure__list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
    .board-structure__row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .board-structure__drag-handle { cursor: grab; color: var(--color-text-secondary); }
    .board-structure__name { flex: 1; font-size: 13px; color: var(--color-text-primary); }
    .board-structure__toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--color-text-secondary); }
    .board-structure__error { color: var(--color-danger-text); font-size: 12px; margin-bottom: 8px; }
  `]
})
export class BoardStructureEditorComponent implements OnInit {
  private readonly taskApi = inject(TaskApiService);

  objectiveId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();
  saved = output<void>();

  protected readonly rows = signal<DraftRow[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.rows.set(
      [...this.statuses()]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({ id: s.id, name: s.name, visibility: s.visibility, marksTaskComplete: s.marksTaskComplete }))
    );
  }

  onDrop(event: CdkDragDrop<DraftRow[]>): void {
    const next = [...this.rows()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.rows.set(next);
  }

  toggleVisibility(id: string): void {
    this.rows.set(this.rows().map((r) => (r.id === id ? { ...r, visibility: r.visibility === 'private' ? 'public' : 'private' } : r)));
  }

  setComplete(id: string): void {
    this.rows.set(this.rows().map((r) => ({ ...r, marksTaskComplete: r.id === id })));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.taskApi.reorderTaskStatuses(
        this.objectiveId(),
        this.rows().map((r, index) => ({ statusId: r.id, displayOrder: index, visibility: r.visibility, marksTaskComplete: r.marksTaskComplete }))
      ));
      this.saved.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save. Make sure exactly one status is marked complete.');
    } finally {
      this.saving.set(false);
    }
  }
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/board-structure-editor.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/objective-settings/objective-settings.component.ts src/app/modules/work/ui/board-structure-editor/
git commit -m "feat(work): Board structure tab - drag-reorder, Public/Private toggle, single-complete-status radio"
```

---

## End of Part 7

Part 7 done when both new/changed components' specs pass and `npx ng test --watch=false` is fully
green. Manually verify CDK drag actually reorders visually and the save round-trips correctly — the
unit tests above cover the data logic, not real drag-pointer simulation (same limitation your E2E
notes already flagged for CDK drag-drop in Sprint Foundation's own manual check).
