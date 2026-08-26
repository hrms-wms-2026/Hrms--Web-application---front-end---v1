import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskHistoryFeedComponent } from '../task-history-feed/task-history-feed.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';
import { toWorkTask } from '../../utils/task.mapper';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
    imports: [ModalComponent, InputComponent, ButtonComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent],

  template: `
    <app-modal [open]="open()" [title]="task()?.shortId ?? ''" size="lg" (closed)="onClose()">
      @if (task(); as t) {
        <div class="flex flex-col gap-3">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
          <label class="flex flex-col gap-1 text-sm text-[var(--color-text-primary)]">
            Status
            <select class="task-detail__select" [value]="statusId()" (change)="statusId.set($any($event.target).value)">
              @for (status of availableStatuses(); track status.id) {
                <option [value]="status.id">{{ status.name }}</option>
              }
            </select>
          </label>
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
          <app-input label="Progress %" type="number" [value]="progressPercentDisplay()" (valueChange)="onProgressPercentChange($event)" />
          <app-input label="Reason (optional)" [value]="reason()" (valueChange)="reason.set($event)" />

          <dl class="task-detail__grid">

            <dt>Category</dt><dd>{{ categoryName() }}</dd>
            <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            
          </dl>

                    <app-task-history-feed [entries]="history()" (reasonSaved)="onReasonSaved()" />

          @if (isAssignee()) {
            <app-task-clock-widget
              [task]="t"
              [isAssignee]="isAssignee()"
              [hasOpenSessionMine]="hasOpenSessionMine()"
              [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
              (clockedIn)="onReasonSaved()"
              (pushed)="onTaskPushed($event)"
            />
          }

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
  projectId = input.required<string>();
    isObjectiveOwner = input.required<boolean>();
  isAssignee = input.required<boolean>();
  currentEmployeeId = input.required<string>();
  statuses = input.required<readonly TaskStatusColumn[]>();

  closed = output<void>();
  saved = output<WorkTask>();
  requested = output<void>();
  statusChangeRequested = output<string>();

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
    storyPoints = signal<number | null>(null);
  progressPercent = signal<number | null>(null);
  reason = signal('');
  statusId = signal('');
  history = signal<TaskHistoryEntryDto[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
    errorMessage = signal<string | null>(null);

  private readonly openSessionEntry = computed(() =>
    this.history().find((entry) => entry.type === 'clock_session' && entry.clockSession?.clockOutAt === null) ?? null
  );
  hasOpenSessionMine = computed(() => this.openSessionEntry()?.employeeId === this.currentEmployeeId());
  hasOpenSessionOtherEmployee = computed(() => {
    const entry = this.openSessionEntry();
    return entry !== null && entry.employeeId !== this.currentEmployeeId();
  });

  categoryName = computed(() => {

    const task = this.task();
    if (!task) return '';
    return this.categories().find((category) => category.id === task.categoryId)?.name ?? task.categoryId;
  });

  availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

    constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (this.open() && projectId) void this.loadCategories(projectId);
    });

    effect(() => {
      // Track `open()` alongside `task()` so the form re-seeds every time the modal transitions
      // to open, even when the same task object reference is reopened (Object.is would otherwise
      // suppress the effect and leave an abandoned edit sitting in the form).
      this.open();
      const t = this.task();
      if (t) {
        this.title.set(t.title);
        this.description.set(t.description ?? '');
        this.priority.set(t.priority);
        this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
        this.estimatedHours.set(t.estimatedHours);
                this.storyPoints.set(t.storyPoints);
        this.progressPercent.set(t.progressPercent);
        this.reason.set('');
        this.statusId.set(t.statusId);
      } else {

        this.title.set('');
        this.description.set('');
        this.priority.set('medium');
        this.dueDate.set('');
        this.estimatedHours.set(null);
                this.storyPoints.set(null);
        this.progressPercent.set(null);
        this.reason.set('');
        this.statusId.set('');
      }

      this.errorMessage.set(null);
      this.errors.set({});
    });

    effect(() => {
      const t = this.task();
      if (this.open() && t) void this.loadHistory(t.id);
    });
  }

    private async loadHistory(taskId: string): Promise<void> {
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(taskId)));
    } catch {
      this.history.set([]);
    }
  }

  async onReasonSaved(): Promise<void> {
    const t = this.task();
    if (t) await this.loadHistory(t.id);
  }

  async onTaskPushed(updated: WorkTask): Promise<void> {
    this.saved.emit(updated);
    await this.loadHistory(updated.id);
  }

  private async loadCategories(projectId: string): Promise<void> {

    try {
      this.categories.set((await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn));
    } catch {
      // The category id remains visible if the lookup cannot be completed.
    }
  }

  estimatedHoursDisplay(): string {
    return this.estimatedHours() == null ? '' : String(this.estimatedHours());
  }

    storyPointsDisplay(): string {
    return this.storyPoints() == null ? '' : String(this.storyPoints());
  }

  progressPercentDisplay(): string {
    return this.progressPercent() == null ? '' : String(this.progressPercent());
  }

  onProgressPercentChange(value: string): void {
    this.progressPercent.set(value === '' ? null : Number(value));
  }

  onEstimatedHoursChange(value: string): void {

    this.estimatedHours.set(value === '' ? null : Number(value));
  }

  onStoryPointsChange(value: string): void {
    this.storyPoints.set(value === '' ? null : Number(value));
  }

  async submit(taskId: string): Promise<void> {
    const fieldErrors: Record<string, string> = {};
    if (!this.title().trim()) fieldErrors['title'] = 'Title is required.';
    this.errors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    const newStatusId = this.statusId();
    if (newStatusId && newStatusId !== this.task()?.statusId) {
      this.statusChangeRequested.emit(newStatusId);
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    const fields = {
      title: this.title().trim(),
      description: this.description() || undefined,
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
            estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      progressPercent: this.progressPercent() ?? undefined,
      reason: this.reason().trim() || undefined

    };

    try {
      if (this.isObjectiveOwner()) {
        const dto = await firstValueFrom(this.taskApi.editTask(taskId, fields));
        this.saved.emit(toWorkTask(dto));
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
