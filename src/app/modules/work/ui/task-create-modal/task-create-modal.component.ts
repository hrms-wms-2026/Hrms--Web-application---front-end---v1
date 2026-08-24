import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CreateTaskRequestDto, InsufficientAllocationErrorDto, WorkTaskDto } from '../../models/dto/task.dto';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkTask } from '../../models/task.model';
import { Sprint } from '../../models/sprint.model';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { firstValueFrom } from 'rxjs';

export interface TaskCreateModuleOption {
  objectiveId: string;
  title: string;
  isOwner: boolean;
}

@Component({
  selector: 'app-task-create-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Create task" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
          @if (modules().length > 0) {
            <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
              Module
              <select class="task-create-modal__select" [value]="selectedObjectiveId()" (change)="selectedObjectiveId.set($any($event.target).value)">
                <option value="" disabled>Select a module</option>
                @for (module of modules(); track module.objectiveId) {
                  <option [value]="module.objectiveId">{{ module.title }}</option>
                }
              </select>
              @if (errors()['objectiveId']) {
                <span class="text-xs text-[var(--color-danger-text)]">{{ errors()['objectiveId'] }}</span>
              }
            </label>
          }
          @if (sprintRequired() || modules().length > 0) {
            <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
              Sprint{{ sprintRequired() ? '' : ' (optional)' }}
              @if (singleSprint(); as sprint) {
                <span class="task-create-modal__sprint-fixed" data-testid="sprint-fixed">{{ sprint.name }}</span>
              } @else {
                <select class="task-create-modal__select task-create-modal__sprint-select" [value]="sprintId()" (change)="sprintId.set($any($event.target).value)">
                  <option value="" [attr.disabled]="sprintRequired() ? true : null" [selected]="!sprintId()">{{ sprintRequired() ? 'Select a sprint' : 'No sprint' }}</option>
                  @for (sprint of sprintOptions(); track sprint.id) {
                    <option [value]="sprint.id">{{ sprint.name }}</option>
                  }
                </select>
              }
              @if (errors()['sprintId']) {
                <span class="text-xs text-[var(--color-danger-text)]">{{ errors()['sprintId'] }}</span>
              }
            </label>
          }
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
          Category
          <select class="task-create-modal__select" [value]="categoryId()" (change)="categoryId.set($any($event.target).value)">
            <option value="" disabled>Select a category</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
          @if (errors()['categoryId']) {
            <span class="text-xs text-[var(--color-danger-text)]">{{ errors()['categoryId'] }}</span>
          }
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
            {{ effectiveIsObjectiveOwner() ? 'Create' : 'Request' }}
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
    .task-create-modal__sprint-fixed {
      padding: 8px 10px;
      color: var(--color-text-primary);
    }
  `]
})
export class TaskCreateModalComponent {
  private readonly store = inject(TaskBoardStore);
  private readonly taskApi = inject(TaskApiService);

  open = input(false);
  /** Fixed target module - used as-is when no `modules` list is provided (Tree's context,
   *  where the module is already implicit from where "Create task" was clicked). */
  objectiveId = input<string>('');
  projectId = input.required<string>();
  isObjectiveOwner = input(false);
  activeSprints = input<readonly Sprint[]>([]);
  sprintRequired = input(true);
  assignableMembers = input<readonly { employeeId: string; name: string }[]>([]);
  /** When provided (Backlog's project-wide context), renders a required Module picker instead
   *  of relying on `objectiveId`, and narrows the Sprint choices to the selected module's own
   *  sprints once one is picked. */
  modules = input<readonly TaskCreateModuleOption[]>([]);

  created = output<WorkTask>();
  requestedInsteadOfCreated = output<void>();
  requestMoreAllocation = output<void>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  categories = signal<TaskCategoryColumn[]>([]);
  categoryId = signal('');
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
  selectedObjectiveId = signal('');

  effectiveObjectiveId = computed(() => (this.modules().length > 0 ? this.selectedObjectiveId() : this.objectiveId()));

  effectiveIsObjectiveOwner = computed(() => {
    if (this.modules().length === 0) return this.isObjectiveOwner();
    return this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false;
  });

  // Once a module is picked from the Module dropdown, a task's sprint must belong to that same
  // module - narrows the choices rather than letting a task point at another module's sprint.
  sprintOptions = computed(() => {
    if (this.modules().length === 0) return this.activeSprints();
    const objectiveId = this.selectedObjectiveId();
    return this.activeSprints().filter((s) => s.objectiveId === objectiveId);
  });

  // When there is exactly one candidate sprint (e.g. the sprint tab's own "+" button narrows
  // activeSprints to just itself), pre-fill sprintId and hide the dropdown - there is nothing to
  // choose. Any other count (0 or many) keeps the normal visible <select> behavior.
  singleSprint = computed(() => {
    const sprints = this.sprintOptions();
    return sprints.length === 1 ? sprints[0] : null;
  });

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (this.open() && projectId) void this.loadCategories(projectId);
    });

    effect(() => {
      const sprint = this.singleSprint();
      if (sprint) {
        this.sprintId.set(sprint.id);
      } else if (this.sprintId() && !this.sprintOptions().some((s) => s.id === this.sprintId())) {
        // Only clears a stale selection - a valid selection surviving the transition out of
        // single-sprint mode is left as-is rather than force-cleared. Safe today because every
        // consumer of this component reopens it with a freshly-scoped activeSprints array rather
        // than reusing one instance across scoped/unscoped invocations; a future consumer that does
        // reuse an instance that way should reset sprintId itself on open, not rely on this effect.
        this.sprintId.set('');
      }
    });
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

  async submit(override?: CreateTaskRequestDto): Promise<void> {
    const request = override ?? this.buildRequest();
    if (!override) {
      const fieldErrors: Record<string, string> = {};
      if (!request.title.trim()) fieldErrors['title'] = 'Title is required.';
      if (this.modules().length > 0 && !this.selectedObjectiveId()) fieldErrors['objectiveId'] = 'Module is required.';
      if (this.sprintRequired() && !request.sprintId) fieldErrors['sprintId'] = 'Sprint is required.';
      if (!request.categoryId) fieldErrors['categoryId'] = 'Category is required.';
      this.errors.set(fieldErrors);
      if (Object.keys(fieldErrors).length > 0) return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.allocationHint.set(null);

    try {
      if (!this.effectiveIsObjectiveOwner()) {
        await firstValueFrom(this.taskApi.createTaskCreationRequest(this.effectiveObjectiveId(), request));
        this.requestedInsteadOfCreated.emit();
        this.closed.emit();
        return;
      }

      const result = await this.store.createTask(this.effectiveObjectiveId(), request);
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

    private async loadCategories(projectId: string): Promise<void> {
    try {
      const categories = (await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn);
      this.categories.set(categories);
      if (!categories.some((category) => category.id === this.categoryId())) {
        this.categoryId.set(categories[0]?.id ?? '');
      }
    } catch {
      this.errorMessage.set('Failed to load task categories.');
    }
  }

  private buildRequest(): CreateTaskRequestDto {

    return {
      title: this.title().trim(),
      description: this.description() || undefined,
      categoryId: this.categoryId(),
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      sprintId: this.sprintId() || null
    };
  }
}
