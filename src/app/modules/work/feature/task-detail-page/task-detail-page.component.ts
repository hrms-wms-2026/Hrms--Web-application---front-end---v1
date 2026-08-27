import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { Sprint } from '../../models/sprint.model';
import { CreateTaskRequestDto, InsufficientAllocationErrorDto } from '../../models/dto/task.dto';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { toWorkTask } from '../../utils/task.mapper';
import { toSprint } from '../../utils/sprint.mapper';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { TaskHistoryFeedComponent } from '../../ui/task-history-feed/task-history-feed.component';
import { TaskClockWidgetComponent } from '../../ui/task-clock-widget/task-clock-widget.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [InputComponent, ButtonComponent, SelectComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent],
  template: `
    <div class="task-page">
      <button type="button" class="task-page__back" (click)="goBack()">&larr; Back</button>

      @if (loading()) {
        <p>Loading…</p>
      } @else if (loadError()) {
        <p class="task-page__error" role="alert">{{ loadError() }}</p>
      } @else if (mode() === 'create') {
        <header class="task-page__header">
          <h1 class="task-page__title-text">New task</h1>
        </header>

        <section class="task-page__main">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
          <app-select [options]="moduleOptions()" [value]="selectedObjectiveId()" label="Module" placeholder="Select a module"
            [error]="errors()['objectiveId'] || ''" [icon]="'module'" (valueChange)="selectedObjectiveId.set($event)" />
          <app-select [options]="sprintOptions()" [value]="sprintId()"
            [label]="'Sprint' + (sprintRequired() ? '' : ' (optional)')" [error]="errors()['sprintId'] || ''"
            [icon]="'sprint'" (valueChange)="sprintId.set($event)" />
          <app-select [options]="assigneeOptions()" [value]="assigneeEmployeeId()" label="Assign to (optional)"
            [icon]="'filter'" (valueChange)="assigneeEmployeeId.set($event)" />
          <app-select [options]="categoryOptions()" [value]="categoryId()" label="Category" placeholder="Select a category"
            [error]="errors()['categoryId'] || ''" [icon]="'category'" (valueChange)="categoryId.set($event)" />
          <label class="task-page__field">Priority
            <select class="task-page__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
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
            <p class="task-page__error" role="alert" data-testid="allocation-hint">
              Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available). Edit the module's allocated hours, then try again.
            </p>
          } @else if (errorMessage()) {
            <p class="task-page__error" role="alert">{{ errorMessage() }}</p>
          }
          <div class="task-page__actions">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
              {{ selectedModuleIsOwner() ? 'Create' : 'Create request' }}
            </app-button>
          </div>
        </section>
      } @else if (task(); as t) {
        <header class="task-page__header">
          <span class="task-page__short-id">{{ t.shortId }}</span>
          <h1 class="task-page__title-text">{{ t.title }}</h1>
        </header>

        <div class="task-page__grid">
          <section class="task-page__main">
            <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
            <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
            <label class="task-page__field">Priority
              <select class="task-page__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
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

            @if (errorMessage()) {
              <p class="task-page__error" role="alert">{{ errorMessage() }}</p>
            }
            <div class="task-page__actions">
              <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
                {{ isObjectiveOwner() ? 'Save changes' : 'Request changes' }}
              </app-button>
            </div>
          </section>

          <aside class="task-page__side">
            <label class="task-page__field">Status
              <select class="task-page__select" [value]="statusId()" (change)="statusId.set($any($event.target).value)">
                @for (status of availableStatuses(); track status.id) {
                  <option [value]="status.id">{{ status.name }}</option>
                }
              </select>
            </label>
            <dl class="task-page__meta">
              <dt>Category</dt><dd>{{ categoryName() }}</dd>
              <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            </dl>

            @if (isAssignee()) {
              <app-task-clock-widget
                [task]="widgetTask()!"
                [isAssignee]="isAssignee()"
                [hasOpenSessionMine]="hasOpenSessionMine()"
                [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                (clockedIn)="reloadHistory()"
                (pushed)="onTaskPushed($event)"
              />
            }

            <app-task-history-feed [entries]="history()" (reasonSaved)="reloadHistory()" />
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .task-page { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
    .task-page__back { align-self: flex-start; background: none; border: none; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; padding: 0; }
    .task-page__short-id { font-size: 12px; color: var(--color-text-secondary); }
    .task-page__title-text { margin: 2px 0 0; font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
    .task-page__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 24px; }
    @media (max-width: 900px) { .task-page__grid { grid-template-columns: 1fr; } }
    .task-page__main, .task-page__side { display: flex; flex-direction: column; gap: 12px; max-width: 520px; }
    .task-page__field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-text-primary); }
    .task-page__select { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .task-page__meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin: 0; }
    .task-page__meta dt { color: var(--color-text-secondary); }
    .task-page__meta dd { margin: 0; color: var(--color-text-primary); }
    .task-page__actions { margin-top: 8px; display: flex; justify-content: flex-end; }
    .task-page__error { font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
  `]
})
export class TaskDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly sprintApi = inject(SprintApiService);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly boardStore = inject(TaskBoardStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  readonly mode = signal<'create' | 'edit'>(
    this.route.snapshot.data['mode'] === 'create' ? 'create' : 'edit'
  );
  private readonly taskId = this.route.snapshot.paramMap.get('taskId') ?? '';
  private readonly projectId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  private readonly prefillModuleId = this.route.snapshot.queryParamMap.get('module') ?? '';
  private readonly prefillSprintId = this.route.snapshot.queryParamMap.get('sprint') ?? '';
  readonly sprintRequired = signal(this.route.snapshot.queryParamMap.get('sprintRequired') !== 'false');

  task = signal<WorkTask | null>(null);
  statuses = signal<TaskStatusColumn[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);
  history = signal<TaskHistoryEntryDto[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  progressPercent = signal<number | null>(null);
  reason = signal('');
  statusId = signal('');

  // create-mode state
  modules = signal<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
  selectedObjectiveId = signal('');
  sprints = signal<readonly Sprint[]>([]);
  sprintId = signal('');
  assignableMembers = signal<readonly { employeeId: string; name: string }[]>([]);
  assigneeEmployeeId = signal('');
  categoryId = signal('');
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);

  moduleOptions = computed<SelectOption[]>(() => this.modules().map((m) => ({ value: m.objectiveId, label: m.title })));
  categoryOptions = computed<SelectOption[]>(() => this.categories().map((c) => ({ value: c.id, label: c.name })));
  assigneeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Unassigned' },
    ...this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }))
  ]);
  sprintOptions = computed<SelectOption[]>(() => {
    const objId = this.selectedObjectiveId();
    const list = objId ? this.sprints().filter((s) => s.objectiveId === objId) : this.sprints();
    return [
      ...(this.sprintRequired() ? [] : [{ value: '', label: 'No sprint' }]),
      ...list.map((s) => ({ value: s.id, label: s.name }))
    ];
  });
  selectedModuleIsOwner = computed(() =>
    this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false
  );

  currentEmployeeId = computed(() => this.currentEmployee.id());
  isObjectiveOwner = computed(() => {
    const t = this.task();
    if (!t) return false;
    return this.projectStore.milestones().find((m) => m.objectiveId === t.objectiveId)?.isOwner ?? false;
  });
  isAssignee = computed(() => {
    const t = this.task();
    return !!t && t.assigneeEmployeeIds.includes(this.currentEmployeeId());
  });

  private readonly openSessionEntry = computed(() =>
    this.history().find((e) => e.type === 'clock_session' && e.clockSession?.clockOutAt === null) ?? null
  );
  hasOpenSessionMine = computed(() => this.openSessionEntry()?.employeeId === this.currentEmployeeId());
  hasOpenSessionOtherEmployee = computed(() => {
    const e = this.openSessionEntry();
    return e !== null && e.employeeId !== this.currentEmployeeId();
  });
  private readonly totalLoggedMinutesFromHistory = computed(() =>
    this.history()
      .filter((e) => e.type === 'clock_session' && e.clockSession?.durationMinutes != null)
      .reduce((sum, e) => sum + (e.clockSession!.durationMinutes ?? 0), 0)
  );
  widgetTask = computed<WorkTask | null>(() => {
    const t = this.task();
    if (!t) return null;
    const entry = this.openSessionEntry();
    return {
      ...t,
      openClockSessionEmployeeId: entry?.employeeId ?? null,
      openClockSessionClockInAt: entry?.clockSession ? new Date(entry.clockSession.clockInAt) : null,
      totalLoggedMinutes: Math.max(t.totalLoggedMinutes, this.totalLoggedMinutesFromHistory())
    };
  });

  categoryName = computed(() => {
    const t = this.task();
    if (!t) return '';
    return this.categories().find((c) => c.id === t.categoryId)?.name ?? t.categoryId;
  });
  availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  constructor() {
    void this.currentEmployee.ensureLoaded();
    if (this.mode() === 'create') {
      void this.loadCreateContext();
    } else {
      void this.load();
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(this.taskId)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId)),
        firstValueFrom(this.taskApi.getCategories(this.projectId)),
        firstValueFrom(this.taskApi.getTaskHistory(this.taskId))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.history.set(historyEntries);
      this.seedForm(t);
    } catch {
      this.loadError.set('Failed to load this task.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCreateContext(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [milestones, sprintDtos, categoryDtos] = await Promise.all([
        firstValueFrom(this.projectApi.getMyMilestones(this.projectId)),
        firstValueFrom(this.sprintApi.getByProject(this.projectId)),
        firstValueFrom(this.taskApi.getCategories(this.projectId))
      ]);
      this.modules.set(milestones.map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner })));
      this.sprints.set(sprintDtos.map(toSprint));
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.categoryId.set(this.categories()[0]?.id ?? '');
      if (this.prefillModuleId && this.modules().some((m) => m.objectiveId === this.prefillModuleId)) {
        this.selectedObjectiveId.set(this.prefillModuleId);
      }
      if (this.prefillSprintId) this.sprintId.set(this.prefillSprintId);
      await this.projectStore.loadProjectMembers(this.projectId);
      this.assignableMembers.set(
        this.projectStore.projectMembers().map((m) => ({ employeeId: m.employeeId, name: m.name ?? 'Unknown employee' }))
      );
    } catch {
      this.loadError.set('Failed to load the task form.');
    } finally {
      this.loading.set(false);
    }
  }

  private seedForm(t: WorkTask): void {
    this.title.set(t.title);
    this.description.set(t.description ?? '');
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
    this.progressPercent.set(t.progressPercent);
    this.reason.set('');
    this.statusId.set(t.statusId);
    this.errors.set({});
    this.errorMessage.set(null);
  }

  async reloadHistory(): Promise<void> {
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(this.taskId)));
    } catch {
      /* keep the current feed */
    }
  }

  async onTaskPushed(updated: WorkTask): Promise<void> {
    this.task.set(updated);
    await this.reloadHistory();
  }

  estimatedHoursDisplay(): string { return this.estimatedHours() == null ? '' : String(this.estimatedHours()); }
  storyPointsDisplay(): string { return this.storyPoints() == null ? '' : String(this.storyPoints()); }
  progressPercentDisplay(): string { return this.progressPercent() == null ? '' : String(this.progressPercent()); }
  onEstimatedHoursChange(v: string): void { this.estimatedHours.set(v === '' ? null : Number(v)); }
  onStoryPointsChange(v: string): void { this.storyPoints.set(v === '' ? null : Number(v)); }
  onProgressPercentChange(v: string): void { this.progressPercent.set(v === '' ? null : Number(v)); }

  goBack(): void {
    history.back();
  }

  async submit(): Promise<void> {
    if (this.mode() === 'create') {
      await this.submitCreate();
      return;
    }

    const fieldErrors: Record<string, string> = {};
    if (!this.title().trim()) fieldErrors['title'] = 'Title is required.';
    this.errors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    const newStatusId = this.statusId();
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
      if (newStatusId && newStatusId !== this.task()?.statusId) {
        await firstValueFrom(this.taskApi.moveTaskStatus(this.taskId, newStatusId));
      }
      if (this.isObjectiveOwner()) {
        const dto = await firstValueFrom(this.taskApi.editTask(this.taskId, fields));
        const t = toWorkTask(dto);
        this.task.set(t);
        this.seedForm(t);
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(this.taskId, fields));
      }
      await this.reloadHistory();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save.');
    } finally {
      this.submitting.set(false);
    }
  }

  private async submitCreate(): Promise<void> {
    const errs: Record<string, string> = {};
    if (!this.title().trim()) errs['title'] = 'Title is required.';
    if (!this.selectedObjectiveId()) errs['objectiveId'] = 'Module is required.';
    if (!this.categoryId()) errs['categoryId'] = 'Category is required.';
    if (this.sprintRequired() && !this.sprintId()) errs['sprintId'] = 'Sprint is required.';
    this.errors.set(errs);
    if (Object.keys(errs).length > 0) return;

    const request: CreateTaskRequestDto = {
      title: this.title().trim(),
      description: this.description() || undefined,
      categoryId: this.categoryId(),
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      sprintId: this.sprintId() || null
    };

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.allocationHint.set(null);
    try {
      const objectiveId = this.selectedObjectiveId();
      if (!this.selectedModuleIsOwner()) {
        await firstValueFrom(this.taskApi.createTaskCreationRequest(objectiveId, request));
        void this.router.navigate(['/work', this.projectId, 'board']);
        return;
      }
      const result = await this.boardStore.createTask(objectiveId, request);
      if (result && 'availableSlackHours' in result) {
        this.allocationHint.set(result);
        return;
      }
      if (result) {
        if (this.assigneeEmployeeId()) {
          await firstValueFrom(this.taskApi.assignTask(result.id, this.assigneeEmployeeId()));
        }
        void this.router.navigate(['/work', this.projectId, 'task', result.id]);
        return;
      }
      this.errorMessage.set(this.boardStore.error() ?? 'Failed to create the task.');
    } finally {
      this.submitting.set(false);
    }
  }
}
