import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
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
import { TaskHistoryFeedComponent } from '../task-history-feed/task-history-feed.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

export type TaskFormMode = 'create' | 'edit';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [InputComponent, ButtonComponent, WorkDropdownComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent],
  template: `
    @if (open()) {
      <div class="tfm-scrim" (click)="onBackdrop()">
        <div #tfm class="tfm" role="dialog" aria-modal="true" tabindex="-1" [attr.aria-label]="mode() === 'create' ? 'New task' : task()?.title" (click)="$event.stopPropagation()" (keydown.escape)="closed.emit()">

          <header class="tfm__head">
            @if (mode() === 'create') {
              <div class="tfm__title">
                <h2>New task</h2>
                <p>Fill in the task details. It joins the selected module and sprint.</p>
              </div>
            } @else if (task(); as t) {
              <div class="tfm__title">
                <span class="tfm__short-id">{{ t.shortId }}</span>
                <h2>{{ t.title }}</h2>
              </div>
            } @else {
              <div class="tfm__title"><h2>Task</h2></div>
            }
            <button type="button" class="tfm__x" aria-label="Close" (click)="closed.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div class="tfm__body">
            @if (loading()) {
              <p>Loading…</p>
            } @else if (loadError()) {
              <p class="tfm__error" role="alert">{{ loadError() }}</p>
            } @else if (mode() === 'create') {
              <section class="tfm__section">
                <span class="tfm__eyebrow">Basics</span>
                <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
                <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
              </section>

              <section class="tfm__section">
                <span class="tfm__eyebrow">Placement</span>
                <div class="tfm__grid">
                  <app-work-dropdown [options]="moduleOptions()" [selected]="selectedObjectiveId()" fieldLabel="Module" accessibleLabel="Module" placeholder="Select a module"
                    [error]="errors()['objectiveId'] || ''" [fullWidth]="true" leadingIcon="module" (selectionChanged)="selectedObjectiveId.set($event)" />
                  <app-work-dropdown [options]="sprintOptions()" [selected]="sprintId()" fieldLabel="Sprint (optional)" accessibleLabel="Sprint" placeholder="No sprint"
                    [fullWidth]="true" leadingIcon="sprint" (selectionChanged)="sprintId.set($event)" />
                  <app-work-dropdown [options]="assigneeOptions()" [selected]="assigneeEmployeeId()" fieldLabel="Assign to (optional)" accessibleLabel="Assignee"
                    [fullWidth]="true" leadingIcon="people" (selectionChanged)="assigneeEmployeeId.set($event)" />
                </div>
              </section>

              <section class="tfm__section">
                <span class="tfm__eyebrow">Details</span>
                <div class="tfm__grid">
                  <app-work-dropdown [options]="categoryOptions()" [selected]="categoryId()" fieldLabel="Category" accessibleLabel="Category" placeholder="Select a category"
                    [error]="errors()['categoryId'] || ''" [fullWidth]="true" leadingIcon="category" (selectionChanged)="categoryId.set($event)" />
                  <app-work-dropdown [options]="priorityOptions" [selected]="priority()" fieldLabel="Priority" accessibleLabel="Priority"
                    [fullWidth]="true" leadingIcon="filter" (selectionChanged)="setPriority($event)" />
                  <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
                  <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
                  <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
                </div>
              </section>

              @if (allocationHint()) {
                <p class="tfm__error" role="alert" data-testid="allocation-hint">
                  Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available). Edit the module's allocated hours, then try again.
                </p>
              } @else if (errorMessage()) {
                <p class="tfm__error" role="alert">{{ errorMessage() }}</p>
              }
            } @else if (task(); as t) {
              <div class="tfm__panes">
                <section class="tfm__section tfm__pane-main">
                  <span class="tfm__eyebrow">Edit fields</span>
                  <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
                  <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
                  <div class="tfm__grid tfm__grid--2">
                    <app-work-dropdown [options]="priorityOptions" [selected]="priority()" fieldLabel="Priority" accessibleLabel="Priority"
                      [fullWidth]="true" leadingIcon="filter" (selectionChanged)="setPriority($event)" />
                    <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
                    <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
                    <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
                    <app-input label="Progress %" type="number" [value]="progressPercentDisplay()" (valueChange)="onProgressPercentChange($event)" />
                    <app-input label="Reason (optional)" [value]="reason()" (valueChange)="reason.set($event)" />
                  </div>
                  @if (errorMessage()) {
                    <p class="tfm__error" role="alert">{{ errorMessage() }}</p>
                  }
                </section>

                <aside class="tfm__pane-side">
                  <section class="tfm__card">
                    <div class="tfm__card-head">
                      <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></svg></span>
                      <div><h3>Task details</h3><p>Current workflow information</p></div>
                    </div>
                    <app-work-dropdown [options]="statusOptions()" [selected]="statusId()" fieldLabel="Status" accessibleLabel="Task status"
                      [fullWidth]="true" leadingIcon="status" (selectionChanged)="statusId.set($event)" />
                    @if (isObjectiveOwner()) {
                      <app-work-dropdown [options]="assigneeOptions()" [selected]="assigneeEmployeeId()" fieldLabel="Assigned to" accessibleLabel="Assignee"
                        [fullWidth]="true" leadingIcon="people" (selectionChanged)="assigneeEmployeeId.set($event)" />
                    } @else {
                      <dl class="tfm__meta"><dt>Assigned to</dt><dd>{{ assigneeName() }}</dd></dl>
                    }
                    <dl class="tfm__meta">
                      <dt>Category</dt><dd>{{ categoryName() }}</dd>
                      <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
                    </dl>
                  </section>

                  @if (isAssignee()) {
                    <section class="tfm__card">
                      <div class="tfm__card-head">
                        <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg></span>
                        <div><h3>Time tracking</h3><p>Track time spent on this task</p></div>
                      </div>
                      <app-task-clock-widget
                        [task]="widgetTask()!"
                        [isAssignee]="isAssignee()"
                        [hasOpenSessionMine]="hasOpenSessionMine()"
                        [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                        (clockedIn)="reloadHistory()"
                        (pushed)="onTaskPushed($event)"
                      />
                    </section>
                  }

                  <section class="tfm__card">
                    <div class="tfm__card-head tfm__card-head--between">
                      <div class="tfm__card-head">
                        <span class="tfm__card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h10M5 18h7" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg></span>
                        <div><h3>Activity log</h3><p>Recent task changes</p></div>
                      </div>
                      <span class="tfm__count">{{ history().length }}</span>
                    </div>
                    <app-task-history-feed [entries]="history()" (reasonSaved)="reloadHistory()" />
                  </section>
                </aside>
              </div>
            }
          </div>

          <footer class="tfm__foot">
            <button type="button" class="tfm__cancel" (click)="closed.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg><span>Cancel</span>
            </button>
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">{{ primaryLabel() }}</app-button>
          </footer>

        </div>
      </div>
    }
  `,
  styles: [`
    .tfm-scrim { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: flex-start; justify-content: center; padding: 40px 24px; background: rgba(0,0,0,.5); overflow-y: auto; }
    .tfm { display: flex; flex-direction: column; width: 100%; max-width: 1152px; max-height: calc(100vh - 80px); border-radius: 12px; background: var(--color-surface); box-shadow: 0 20px 45px rgb(15 23 42 / .28); overflow: hidden; }
    .tfm__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 24px 32px 16px; }
    .tfm__title { display: flex; flex-direction: column; gap: 3px; }
    .tfm__title h2 { margin: 0; font-size: 19px; font-weight: 700; letter-spacing: -.02em; color: var(--color-text-primary); }
    .tfm__title p { margin: 0; font-size: 13px; color: var(--color-text-secondary); }
    .tfm__short-id { font-size: 12px; color: var(--color-text-secondary); }
    .tfm__x { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; flex: 0 0 auto; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .tfm__x:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .tfm__x svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfm__body { display: flex; flex-direction: column; gap: 24px; padding: 6px 32px 28px; overflow-y: auto; }
    .tfm__section { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .tfm__eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-secondary); }
    .tfm__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px 20px; }
    .tfm__grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tfm__grid > * { min-width: 0; }
    .tfm__panes { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: 24px; }
    .tfm__pane-main, .tfm__pane-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .tfm__card { display: flex; flex-direction: column; gap: 14px; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; background: var(--color-surface); box-shadow: 0 3px 12px rgb(15 23 42 / .04); }
    .tfm__card-head { display: flex; align-items: center; gap: 10px; }
    .tfm__card-head--between { justify-content: space-between; }
    .tfm__card-head h3 { margin: 0; font-size: 14px; font-weight: 650; color: var(--color-text-primary); }
    .tfm__card-head p { margin: 2px 0 0; font-size: 11px; color: var(--color-text-secondary); }
    .tfm__card-icon { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 8px; background: color-mix(in srgb, var(--color-accent) 11%, var(--color-surface)); color: var(--color-accent); }
    .tfm__card-icon svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfm__meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; padding: 12px 0 2px; border-top: 1px solid var(--color-border); font-size: 13px; }
    .tfm__meta dt { color: var(--color-text-secondary); }
    .tfm__meta dd { margin: 0; color: var(--color-text-primary); font-weight: 600; text-align: right; }
    .tfm__count { display: inline-flex; min-width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0 7px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .tfm__error { margin: 0; font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
    .tfm__foot { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 16px 32px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .tfm__foot app-button { display: flex; }
    .tfm__cancel { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: border-color 160ms ease, background-color 160ms ease; }
    .tfm__cancel:hover { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .tfm__cancel svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
    @media (max-width: 900px) { .tfm__panes { grid-template-columns: 1fr; } .tfm__grid, .tfm__grid--2 { grid-template-columns: 1fr; } }
  `]
})
export class TaskFormModalComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly sprintApi = inject(SprintApiService);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly boardStore = inject(TaskBoardStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  readonly open = input(false);
  readonly mode = input<TaskFormMode>('create');
  readonly projectId = input.required<string>();
  readonly taskId = input<string>('');
  readonly prefillModuleId = input<string>('');
  readonly prefillSprintId = input<string>('');

  readonly closed = output<void>();
  readonly created = output<string>();
  readonly saved = output<void>();

  task = signal<WorkTask | null>(null);
  statuses = signal<TaskStatusColumn[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);
  history = signal<TaskHistoryEntryDto[]>([]);
  loading = signal(false);
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

  modules = signal<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
  selectedObjectiveId = signal('');
  sprints = signal<readonly Sprint[]>([]);
  sprintId = signal('');
  assignableMembers = signal<readonly { employeeId: string; name: string }[]>([]);
  assigneeEmployeeId = signal('');
  private originalAssigneeId = signal('');
  categoryId = signal('');
  allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);

  private loadedKey = '';
  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('tfm');
  private previouslyFocused: HTMLElement | null = null;

  moduleOptions = computed<WorkDropdownOption[]>(() => this.modules().map((m) => ({ value: m.objectiveId, label: m.title })));
  categoryOptions = computed<WorkDropdownOption[]>(() => this.categories().map((c) => ({ value: c.id, label: c.name })));
  assigneeOptions = computed<WorkDropdownOption[]>(() => [
    { value: '', label: 'Unassigned' },
    ...this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }))
  ]);
  sprintOptions = computed<WorkDropdownOption[]>(() => {
    const objId = this.selectedObjectiveId();
    const list = objId ? this.sprints().filter((s) => s.objectiveId === objId) : this.sprints();
    return [{ value: '', label: 'No sprint' }, ...list.map((s) => ({ value: s.id, label: s.name }))];
  });
  selectedModuleIsOwner = computed(() =>
    this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false
  );
  priorityOptions: readonly WorkDropdownOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];
  statusOptions = computed<WorkDropdownOption[]>(() => this.availableStatuses().map((status) => ({ value: status.id, label: status.name })));
  primaryLabel = computed(() => {
    if (this.mode() === 'create') return this.selectedModuleIsOwner() ? 'Create' : 'Create request';
    return this.isObjectiveOwner() ? 'Save changes' : 'Request changes';
  });

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
  assigneeName = computed(() => {
    const id = this.assigneeEmployeeId();
    return this.assignableMembers().find((m) => m.employeeId === id)?.name ?? (id ? id : 'Unassigned');
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
    effect(() => {
      const isOpen = this.open();
      const key = `${this.mode()}:${this.taskId()}:${isOpen}`;
      if (!isOpen) { this.loadedKey = ''; return; }
      if (key === this.loadedKey) return;
      this.loadedKey = key;
      untracked(() => {
        this.resetForm();
        if (this.mode() === 'create') void this.loadCreateContext();
        else void this.load();
      });
    });
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement;
        this.dialogRef()?.nativeElement.focus();
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  private resetForm(): void {
    this.task.set(null);
    this.title.set('');
    this.description.set('');
    this.priority.set('medium');
    this.dueDate.set('');
    this.estimatedHours.set(null);
    this.storyPoints.set(null);
    this.progressPercent.set(null);
    this.reason.set('');
    this.statusId.set('');
    this.selectedObjectiveId.set('');
    this.sprintId.set('');
    this.assigneeEmployeeId.set('');
    this.originalAssigneeId.set('');
    this.categoryId.set('');
    this.allocationHint.set(null);
    this.errors.set({});
    this.errorMessage.set(null);
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(this.taskId())),
        firstValueFrom(this.taskApi.getStatuses(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId())),
        firstValueFrom(this.taskApi.getTaskHistory(this.taskId()))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.history.set(historyEntries);
      this.seedForm(t);
      await this.loadMembers();
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
        firstValueFrom(this.projectApi.getMyMilestones(this.projectId())),
        firstValueFrom(this.sprintApi.getByProject(this.projectId())),
        firstValueFrom(this.taskApi.getCategories(this.projectId()))
      ]);
      this.modules.set(milestones.map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner })));
      this.sprints.set(sprintDtos.map(toSprint));
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.categoryId.set(this.categories()[0]?.id ?? '');
      if (this.prefillModuleId() && this.modules().some((m) => m.objectiveId === this.prefillModuleId())) {
        this.selectedObjectiveId.set(this.prefillModuleId());
      }
      if (this.prefillSprintId()) this.sprintId.set(this.prefillSprintId());
      await this.loadMembers();
    } catch {
      this.loadError.set('Failed to load the task form.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadMembers(): Promise<void> {
    await this.projectStore.loadProjectMembers(this.projectId());
    this.assignableMembers.set(
      this.projectStore.projectMembers().map((m) => ({ employeeId: m.employeeId, name: m.name ?? 'Unknown employee' }))
    );
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
    const currentAssignee = t.assigneeEmployeeIds[0] ?? '';
    this.assigneeEmployeeId.set(currentAssignee);
    this.originalAssigneeId.set(currentAssignee);
    this.errors.set({});
    this.errorMessage.set(null);
  }

  async reloadHistory(): Promise<void> {
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(this.taskId())));
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
  setPriority(value: string): void { this.priority.set(value as WorkTask['priority']); }

  onBackdrop(): void { this.closed.emit(); }

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
        await firstValueFrom(this.taskApi.moveTaskStatus(this.taskId(), newStatusId));
      }
      if (this.isObjectiveOwner()) {
        await firstValueFrom(this.taskApi.editTask(this.taskId(), fields));
        await this.applyReassignment();
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(this.taskId(), fields));
      }
      this.saved.emit();
      this.closed.emit();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save.');
    } finally {
      this.submitting.set(false);
    }
  }

  private async applyReassignment(): Promise<void> {
    const next = this.assigneeEmployeeId();
    const previous = this.originalAssigneeId();
    if (next === previous) return;
    if (previous) await firstValueFrom(this.taskApi.unassignTask(this.taskId(), previous));
    if (next) await firstValueFrom(this.taskApi.assignTask(this.taskId(), next));
  }

  private async submitCreate(): Promise<void> {
    const errs: Record<string, string> = {};
    if (!this.title().trim()) errs['title'] = 'Title is required.';
    if (!this.selectedObjectiveId()) errs['objectiveId'] = 'Module is required.';
    if (!this.categoryId()) errs['categoryId'] = 'Category is required.';
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
        try {
          await firstValueFrom(this.taskApi.createTaskCreationRequest(objectiveId, request));
          this.created.emit('');
          this.closed.emit();
        } catch (err: unknown) {
          const detail = (err as { error?: { detail?: string } })?.error?.detail;
          this.errorMessage.set(detail || 'Failed to send the request.');
        }
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
        this.created.emit(result.id);
        this.closed.emit();
        return;
      }
      this.errorMessage.set(this.boardStore.error() ?? 'Failed to create the task.');
    } finally {
      this.submitting.set(false);
    }
  }
}
