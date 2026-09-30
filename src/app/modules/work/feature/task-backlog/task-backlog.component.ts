import { AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { SprintFormComponent } from '../../ui/sprint-form/sprint-form.component';
import { TaskTableComponent } from '../../ui/task-table/task-table.component';
import { BulkTaskActionResponse, toBulkResultSummary, WorkTask } from '../../models/task.model';
import { Sprint, SprintStatus } from '../../models/sprint.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkDropdownComponent, WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../ui/task-filter-bar/task-filter-bar.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { SprintStartDialogComponent } from '../../ui/sprint-start-dialog/sprint-start-dialog.component';
import { SprintCompleteDialogComponent } from '../../ui/sprint-complete-dialog/sprint-complete-dialog.component';
import { MoveTasksToSprintDialogComponent, SprintMoveTarget } from '../../ui/move-tasks-to-sprint-dialog/move-tasks-to-sprint-dialog.component';
import { SelectionModel } from '../../../../shared/utils/selection-model';
import { BulkAction, BulkActionBarComponent } from '../../../../shared/ui/bulk-action-bar/bulk-action-bar.component';
import { BulkActionResultModalComponent, BulkResultSummary } from '../../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { TaskAssigneeDropdownComponent } from '../../ui/task-assignee-dropdown/task-assignee-dropdown.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';

const BULK_POPOVER_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -7 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -7 }
];

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [SprintTabComponent, SprintFormComponent, TaskTableComponent, ButtonComponent, ErrorStateComponent, TaskFilterBarComponent, TaskAssigneeAvatarFilterComponent, TaskFormModalComponent, SprintStartDialogComponent, SprintCompleteDialogComponent, MoveTasksToSprintDialogComponent, BulkActionBarComponent, ConfirmModalComponent, BulkActionResultModalComponent, WorkDropdownComponent, TaskAssigneeDropdownComponent, DatePickerComponent, OverlayModule],
  template: `
    <ng-template #toolbarTpl>
      <div class="task-backlog__toolbar">
        <app-task-assignee-avatar-filter
          [members]="projectRosterMembers()"
          [currentEmployeeId]="currentEmployee.id()"
          [selected]="assigneeFilter()"
          (selectionChanged)="setAssigneeFilter($event)"
        />
        <app-task-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterFieldChanged($event)" />
        @if (modules().length > 0) {
          <app-button variant="secondary" (pressed)="openCreateTask()">Create work item</app-button>
        }
        @if (modules().length > 0) {
          <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
        }
      </div>
    </ng-template>

    @if (createSprintOpen() && modules().length > 0) {
        <app-sprint-form
          mode="create"
          [open]="createSprintOpen()"
          [projectId]="projectId()"
          [modules]="sprintFormModules()"
          [allSprints]="sprintStore.sprints()"
          (created)="onSprintCreated()"
          (cancelled)="createSprintOpen.set(false)"
        />
    }
    @if (editingSprint(); as sprint) {
      <app-sprint-form
        mode="edit"
        [open]="true"
        [projectId]="projectId()"
        [modules]="sprintFormModules()"
        [allSprints]="sprintStore.sprints()"
        [sprint]="sprint"
        (saved)="onSprintEdited()"
        (cancelled)="editingSprint.set(null)"
      />
    }
    @if (startingSprint(); as sprint) {
      <app-sprint-start-dialog
        [open]="true"
        [sprint]="sprint"
        [tasks]="tasksForSprint(sprint.id)"
        [projectId]="projectId()"
        (started)="onSprintStarted()"
        (cancelled)="startingSprint.set(null)"
      />
    }
    @if (completingSprint(); as sprint) {
      <app-sprint-complete-dialog
        [open]="true"
        [sprint]="sprint"
        [tasks]="tasksForSprint(sprint.id)"
        [otherSprints]="otherSprintsForCompleting()"
        [projectId]="projectId()"
        [completeStatusIds]="completeStatusIds()"
        (completed)="onSprintCompleted()"
        (cancelled)="completingSprint.set(null)"
      />
    }

    @if (sprintStore.error()) {
      <p class="task-backlog__sprint-message" role="alert">{{ sprintStore.error() }}</p>
    }

    @if (store.loading() || sprintStore.loading()) {
      <p>Loading…</p>
    } @else if (store.error()) {
      <app-error-state [message]="store.error()!" [retryable]="true" (retry)="reloadTasks()" />
    } @else {
      @if (filteredSprints().length > 0) {
        <div class="task-backlog__sprints">
          <h3 class="task-backlog__sprints-title">Sprint</h3>
          @for (sprint of filteredSprints(); track sprint.id) {
            <app-sprint-tab
              [sprint]="sprint"
              [canManage]="sprint.canManage"
              [tasks]="tasksForSprint(sprint.id)"
              [statusNames]="statusNames()"
              [categoryNames]="categoryNames()"
              [moduleNames]="moduleNames()"
              [statuses]="store.statuses()"
              [objectiveOwners]="objectiveOwners()"
              [currentEmployeeId]="currentEmployee.id()"
              [expanded]="expandedSprintId() === sprint.id"
              [selectable]="true"
              [selectedIds]="selectedTaskIds()"
              (toggled)="toggleExpanded(sprint.id)"
              (editRequested)="editingSprint.set(sprint)"
              (startRequested)="startingSprint.set(sprint)"
              (completeRequested)="completingSprint.set(sprint)"
              (createTaskRequested)="openCreateTask(sprint)"
              (taskViewed)="onTaskViewed($event)"
              (taskStatusChangeRequested)="onTaskStatusChangeRequested($event)"
              (taskChanged)="reloadTasks()"
              (taskSelectionChanged)="onTaskSelectionChanged($event)"
              (taskSelectAllChanged)="onSelectAllChanged($event)"
            />
          }
        </div>
      }

      @if (unsortedTasks().length > 0) {
        <div class="task-backlog__unsorted">
          <div class="task-backlog__unsorted-header">
            <svg class="task-backlog__unsorted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <h3 class="task-backlog__unsorted-title">Backlog</h3>
            <span class="task-backlog__unsorted-summary">{{ unsortedTasks().length }} task{{ unsortedTasks().length === 1 ? '' : 's' }} · {{ unsortedTotalHours() }}h</span>
          </div>
          <app-task-table
            [tasks]="unsortedTasks()"
            [statusNames]="statusNames()"
            [categoryNames]="categoryNames()"
            [moduleNames]="moduleNames()"
            [statuses]="store.statuses()"
            [objectiveOwners]="objectiveOwners()"
            [currentEmployeeId]="currentEmployee.id()"
            [selectable]="true"
            [selectedIds]="selectedTaskIds()"
            (viewed)="onTaskViewed($event)"
            (taskChanged)="reloadTasks()"
            (statusChangeRequested)="onTaskStatusChangeRequested($event)"
            (selectionChanged)="onTaskSelectionChanged($event)"
            (selectAllChanged)="onSelectAllChanged($event)"
          />
        </div>
      }
    }

    <app-bulk-action-bar
      noun="task"
      [count]="selection.count()"
      [actions]="bulkActions()"
      (action)="onBulkAction($event)"
      (cleared)="clearSelection()"
    >
      <div bulk-action-controls class="task-backlog__bulk-controls">
        <app-work-dropdown
          [options]="statusOptions()"
          placeholder="Status"
          accessibleLabel="Change selected tasks status"
          leadingIcon="status"
          size="sm"
          direction="up"
          testId="bulk-action-status"
          [disabled]="bulkSubmitting()"
          (selectionChanged)="applyBulkStatus($event)"
        />

        <div class="task-backlog__bulk-assignee">
          <button
            type="button"
            class="task-backlog__bulk-button"
            data-testid="bulk-action-assign"
            cdkOverlayOrigin
            #bulkAssigneeOrigin="cdkOverlayOrigin"
            [disabled]="bulkSubmitting()"
            [attr.aria-expanded]="assigneePickerOpen()"
            (click)="assigneePickerOpen.update(open => !open)"
          >
            Assign
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="bulkAssigneeOrigin"
            [cdkConnectedOverlayOpen]="assigneePickerOpen()"
            [cdkConnectedOverlayPositions]="bulkPopoverPositions"
            [cdkConnectedOverlayHasBackdrop]="true"
            cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
            (backdropClick)="assigneePickerOpen.set(false)"
            (detach)="assigneePickerOpen.set(false)"
          >
            <app-task-assignee-dropdown
              [members]="assignableMembers()"
              [allowUnassigned]="false"
              placeholder="Search assignee..."
              (selected)="applyBulkAssignee($event)"
              (closed)="assigneePickerOpen.set(false)"
            />
          </ng-template>
        </div>

        <app-work-dropdown
          [options]="priorityOptions"
          placeholder="Priority"
          accessibleLabel="Change selected tasks priority"
          size="sm"
          direction="up"
          testId="bulk-action-priority"
          [disabled]="bulkSubmitting() || !selectionAllOwned()"
          [tooltip]="selectionAllOwned() ? '' : ownerOnlyReason"
          (selectionChanged)="applyBulkPriority($event)"
        />

        <app-date-picker
          variant="chip"
          emptyLabel="Due date"
          chipClass="task-backlog__bulk-date"
          btnTestId="bulk-action-due-date"
          [disabled]="bulkSubmitting() || !selectionAllOwned()"
          (valueChange)="applyBulkDueDate($event)"
        />

        <app-work-dropdown
          [options]="parentOptions()"
          placeholder="Convert to subtask"
          accessibleLabel="Convert selected tasks to subtasks"
          size="sm"
          direction="up"
          testId="bulk-action-convert-to-subtask"
          [disabled]="bulkSubmitting()"
          (selectionChanged)="applyBulkParent($event)"
        />
      </div>
    </app-bulk-action-bar>

    <app-confirm-modal
      [open]="deleteConfirmOpen()"
      [title]="'Delete ' + selectedTasks().length + ' task' + (selectedTasks().length === 1 ? '' : 's') + '?'"
      message="Deleted tasks are removed from the board. Tasks that still have subtasks are skipped."
      confirmLabel="Delete"
      [loading]="bulkSubmitting()"
      [errorMessage]="bulkError() ?? ''"
      (confirmed)="onDeleteConfirmed()"
      (cancelled)="deleteConfirmOpen.set(false)"
    />

    <app-bulk-action-result-modal
      [result]="bulkResult()?.summary ?? null"
      [title]="bulkResult()?.title ?? ''"
      [names]="taskNames()"
      noun="task"
      [showApprovals]="false"
      (closed)="bulkResult.set(null)"
    />

    @if (bulkError() && !deleteConfirmOpen()) {
      <p class="task-backlog__sprint-message" role="alert">{{ bulkError() }}</p>
    }

    @if (moveUndoBanner(); as banner) {
      <div class="task-backlog__undo-banner" role="status">
        <span>{{ banner.message }}</span>
        <button type="button" class="task-backlog__undo-action" (click)="undoMove()">Undo</button>
      </div>
    }

    <app-move-tasks-to-sprint-dialog
      [open]="moveDialogOpen()"
      [taskCount]="selectedTaskIds().size"
      [totalEstimatedHours]="selectedTasksTotalHours()"
      [targets]="moveTargets()"
      [blockedReason]="moveBlockedReason()"
      [submitting]="movingTasks()"
      [error]="moveError()"
      (moved)="onTasksMoved($event)"
      (cancelled)="moveDialogOpen.set(false)"
    />

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      [prefillModuleId]="modalPrefillModuleId()"
      [prefillSprintId]="modalPrefillSprintId()"
      [draftId]="taskModalDraftId()"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
      (changed)="reloadTasks()"
      (closed)="closeTaskModal()"
    />
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
    /* Match the Filter trigger (30px tall, 8px radius) so the toolbar reads as one row. */
    .task-backlog__toolbar ::ng-deep app-button > button { width: auto; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px; }
    .task-backlog__sprint-message { color: var(--color-danger-text, var(--color-danger)); font-size: 12px; margin-bottom: 8px; }
    .task-backlog__sprints { margin-top: 4px; }
    .task-backlog__sprints-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 10px; }
    .task-backlog__unsorted { margin-top: 18px; }
    .task-backlog__unsorted-header { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; }
    .task-backlog__unsorted-icon { width: 15px; height: 15px; flex: 0 0 auto; color: var(--color-text-secondary); fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .task-backlog__unsorted-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
    .task-backlog__unsorted-summary { font-size: 11px; color: var(--color-text-secondary); }
    .task-backlog__undo-banner { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 10px 14px; border-radius: 10px; background: var(--color-text-primary); color: var(--color-surface); font-size: 13px; }
    .task-backlog__undo-action { border: none; background: none; color: var(--color-accent-light, var(--color-accent)); font-weight: 600; cursor: pointer; font-size: 13px; padding: 0; }
    .task-backlog__undo-action:hover { text-decoration: underline; }
    .task-backlog__bulk-controls { display: inline-flex; align-items: center; gap: 6px; }
    .task-backlog__bulk-assignee { display: inline-flex; }
    .task-backlog__bulk-button { height: 30px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .task-backlog__bulk-button:hover:not(:disabled), .task-backlog__bulk-button[aria-expanded="true"] { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .task-backlog__bulk-button:disabled { cursor: not-allowed; opacity: .5; }
    :host ::ng-deep .task-backlog__bulk-controls app-work-dropdown { min-width: 0; }
    :host ::ng-deep .task-backlog__bulk-controls .work-dropdown { min-width: 0; }
    :host ::ng-deep .task-backlog__bulk-controls .work-dropdown__trigger { width: auto; }
    :host ::ng-deep .task-backlog__bulk-controls .work-dropdown__menu { right: auto; min-width: 190px; }
    :host ::ng-deep .task-backlog__bulk-date { height: 30px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 10px; color: var(--color-text-primary); font-size: 13px; font-weight: 500; }
    :host ::ng-deep .task-backlog__bulk-date:hover:not(:disabled), :host ::ng-deep .task-backlog__bulk-date[aria-expanded="true"] { border-color: var(--color-accent); }
  `]
})
export class TaskBacklogComponent implements OnInit, AfterViewInit, OnDestroy {
  private static readonly OWNER_ONLY_REASON = 'You can only do this for tasks in modules you own.';
  protected readonly ownerOnlyReason = TaskBacklogComponent.OWNER_ONLY_REASON;
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  protected readonly projectStore = inject(ProjectDetailStore);
  private readonly fileApi = inject(FileApiService, { optional: true });
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');
  private readonly taskApi = inject(TaskApiService);
  private readonly sprintApi = inject(SprintApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);

  protected readonly createSprintOpen = signal(false);
  protected readonly editingSprint = signal<Sprint | null>(null);
  protected readonly startingSprint = signal<Sprint | null>(null);
  protected readonly completingSprint = signal<Sprint | null>(null);
  protected readonly selection = new SelectionModel<string>();
  protected readonly selectedTaskIds = this.selection.selected;
  protected readonly moveDialogOpen = signal(false);
  protected readonly movingTasks = signal(false);
  protected readonly moveError = signal<string | null>(null);
  protected readonly moveUndoBanner = signal<{ message: string } | null>(null);
  private undoBannerTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMove: { taskId: string; previousSprintId: string | null; newSprintId: string | null }[] = [];
  protected readonly assigneePickerOpen = signal(false);
  protected readonly bulkPopoverPositions = BULK_POPOVER_POSITIONS;
  protected readonly bulkSubmitting = signal(false);
  protected readonly bulkError = signal<string | null>(null);
  protected readonly bulkResult = signal<{ title: string; summary: BulkResultSummary } | null>(null);
  protected readonly deleteConfirmOpen = signal(false);
  protected readonly projectId = signal('');
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string; avatarUrl: string | null }[]>([]);
  // Everyone on the project, unscoped by which milestones the viewer can reach - the roster
  // shown in the toolbar avatar stack. Deliberately separate from assignableMembers above,
  // which stays scoped for the actual task-assignment flows.
  protected readonly projectRosterMembers = computed<TaskAssigneeAvatarMember[]>(() =>
    (this.projectStore.project()?.members ?? []).map((member) => ({
      employeeId: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarFileId ? this.fileApi?.getFileUrl(member.avatarFileId) ?? null : null
    }))
  );
  protected readonly sprintStatusFilter = signal<'all' | SprintStatus>('all');
  protected readonly objectiveFilter = signal<string[]>([]);
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  protected readonly statusFilter = signal<string[]>([]);
  protected readonly priorityFilter = signal<string[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly sprintStatusOptions: readonly WorkDropdownOption[] = [
    { value: 'all', label: 'All sprint statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'complete', label: 'Complete' },
    { value: 'achieved', label: 'Achieved' }
  ];

  constructor() {
    // Switching projects via the breadcrumb switcher navigates to a sibling route matching the
    // same path shape (/work/:id/backlog) - Angular reuses this component instance rather than
    // re-instantiating it, so the :id param must be watched reactively, not just read once.
    const paramMap$ = this.route.paramMap ?? of(this.route.snapshot?.paramMap);
    paramMap$
      .pipe(
        map((paramMap) => paramMap?.get('id') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((projectId) => {
        this.projectId.set(projectId);
        if (!projectId) return;
        void this.store.loadBoard(projectId);
        void this.sprintStore.loadForProject(projectId);
        void this.loadCategories(projectId);
        void this.loadAssignableMembers(projectId);
      });

    // The drafts bar links here with ?taskDraftId=<id> to resume a saved create-task form.
    const queryParamMap$ = this.route.queryParamMap ?? of(this.route.snapshot?.queryParamMap);
    queryParamMap$
      .pipe(
        map((params) => params?.get('taskDraftId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed()
      )
      .subscribe((draftId) => {
        if (!draftId) return;
        this.targetSprintForCreate.set(null);
        this.taskModalMode.set('create');
        this.taskModalTaskId.set('');
        this.taskModalDraftId.set(draftId);
        this.taskModalOpen.set(true);
      });
  }

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly objectiveOwners = computed(() =>
    Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.isOwner]))
  );
  // Sprints are project-level, so any member may create one; the module picker inside the form
  // still restricts which modules' tasks can be added, per module ownership.
  protected readonly sprintFormModules = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isEffectiveOwner: m.isEffectiveOwner }))
  );
  protected readonly objectiveOptions = computed<WorkDropdownOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );
  protected readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categories().map((category) => ({ value: category.id, label: category.name }))
  );
  protected readonly statusFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.store.statuses().map((status) => ({ value: status.id, label: status.name }))
  );
  protected readonly priorityOptions: readonly WorkDropdownOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];
  protected readonly filterFields = computed<TaskFilterFieldConfig[]>(() => [
    { key: 'module', label: 'Module', icon: 'module', kind: 'multi', options: this.objectiveOptions() },
    { key: 'category', label: 'Category', icon: 'category', kind: 'multi', options: this.categoryOptions() },
    { key: 'assignee', label: 'Assignee', icon: 'people', kind: 'multi', options: this.assigneeFilterOptions() },
    { key: 'sprintStatus', label: 'Sprint status', icon: 'sprint', kind: 'single', options: this.sprintStatusOptions, defaultValues: ['all'] },
    { key: 'status', label: 'Status', icon: 'status', kind: 'multi', options: this.statusFilterOptions() },
    { key: 'priority', label: 'Priority', icon: 'priority', kind: 'multi', options: this.priorityOptions }
  ]);
  protected readonly filterValues = computed<Record<string, string[]>>(() => ({
    module: this.objectiveFilter(),
    category: this.categoryFilter(),
    assignee: this.assigneeFilter(),
    sprintStatus: [this.sprintStatusFilter()],
    status: this.statusFilter(),
    priority: this.priorityFilter()
  }));
  protected readonly statusNames = computed(() => Object.fromEntries(this.store.statuses().map((status) => [status.id, status.name])));
  protected readonly categoryNames = computed(() => Object.fromEntries(this.categories().map((category) => [category.id, category.name])));
  protected readonly moduleNames = computed(() => Object.fromEntries(this.modules().map((module) => [module.objectiveId, module.title])));
  protected readonly completeStatusIds = computed(() =>
    new Set(this.store.statuses().filter((s) => s.marksTaskComplete).map((s) => s.id))
  );
  protected readonly otherSprintsForCompleting = computed(() => {
    const target = this.completingSprint();
    if (!target) return [];
    return this.sprintStore.sprints().filter((s) =>
      s.id !== target.id && s.status !== 'complete' && s.status !== 'achieved'
    );
  });
  protected readonly filteredSprints = computed(() => {
    const filter = this.sprintStatusFilter();
    const statusOrder: Record<string, number> = { active: 0, draft: 1, complete: 2, achieved: 3 };
    const list = filter === 'all' ? this.sprintStore.sprints() : this.sprintStore.sprints().filter((sprint) => sprint.status === filter);
    return [...list].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));
  });
  protected readonly unsortedTasks = computed(() => {
    const knownSprintIds = new Set(this.sprintStore.sprints().map((sprint) => sprint.id));
    return this.filteredTasks().filter((task) => task.sprintId == null || !knownSprintIds.has(task.sprintId));
  });
  protected readonly unsortedTotalHours = computed(() =>
    this.unsortedTasks().reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
  );

  protected readonly selectedTasks = computed(() => {
    const ids = this.selectedTaskIds();
    return this.filteredTasks().filter((task) => ids.has(task.id));
  });
  protected readonly selectedTasksTotalHours = computed(() =>
    this.selectedTasks().reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
  );
  private readonly ownedObjectiveIds = computed(() =>
    new Set(this.modules().filter((m) => m.isEffectiveOwner).map((m) => m.objectiveId)));
  protected readonly selectionAllOwned = computed(() => {
    const owned = this.ownedObjectiveIds();
    return this.selectedTasks().every((task) => owned.has(task.objectiveId));
  });
  protected readonly bulkActions = computed<BulkAction[]>(() => {
    const ownerBlocked = this.selectionAllOwned()
      ? undefined
      : TaskBacklogComponent.OWNER_ONLY_REASON;
    const ownerOnly = { disabled: !!ownerBlocked, disabledReason: ownerBlocked };
    const actions: BulkAction[] = [
      { id: 'move-to-sprint', label: 'Move to sprint', placement: 'more', ...ownerOnly }
    ];
    if (this.selectedTasks().some((task) => task.sprintId)) {
      actions.push({ id: 'move-to-backlog', label: 'Move to backlog', placement: 'more', ...ownerOnly });
    }
    actions.push(
      { id: 'delete', label: 'Delete', placement: 'more', danger: true }
    );
    return actions;
  });
  protected readonly taskNames = computed(() =>
    new Map(this.store.tasks().map((task) => [task.id, task.title] as const)));
  protected readonly statusOptions = computed<WorkDropdownOption[]>(() => {
    const includePrivate = this.selectionAllOwned();
    return this.store.statuses()
      .filter((status) => includePrivate || status.visibility !== 'private')
      .map((status) => ({ value: status.id, label: status.name }));
  });
  protected readonly parentOptions = computed<WorkDropdownOption[]>(() => {
    const selected = this.selectedTaskIds();
    return this.store.tasks()
      .filter((task) => task.parentTaskId === null && !selected.has(task.id))
      .map((task) => ({ value: task.id, label: task.title }));
  });
  // Sprints are project-level: any Draft/Active sprint is a valid target, but only for tasks
  // whose module the user owns (backend SprintTaskAssignment/EditTask enforce the same rule).
  protected readonly moveBlockedReason = computed(() =>
    this.selectedTasks().some((task) => !this.ownedObjectiveIds().has(task.objectiveId))
      ? 'You can only move tasks from modules you own.' : null);
  protected readonly moveTargets = computed<SprintMoveTarget[]>(() => {
    if (this.selectedTasks().length === 0) return [];
    const order: Record<string, number> = { active: 0, draft: 1 };
    return this.sprintStore.sprints()
      .filter((sprint) => sprint.status === 'draft' || sprint.status === 'active')
      .sort((a, b) => (order[a.status] - order[b.status]) || ((a.startDate?.getTime() ?? Infinity) - (b.startDate?.getTime() ?? Infinity)))
      .map((sprint) => {
        const sprintTasks = this.tasksForSprint(sprint.id);
        return {
          sprint,
          currentTaskCount: sprintTasks.length,
          currentHours: sprintTasks.reduce((sum, task) => sum + (task.estimatedHours ?? 0), 0)
        };
      });
  });

  ngOnInit(): void {
    const assignee = this.route.snapshot?.queryParamMap?.get('assignee');
    if (assignee) this.assigneeFilter.set([assignee]);
    void this.currentEmployee.ensureLoaded();
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);
  }

  private filteredTasks(): WorkTask[] {
    const assignees = this.assigneeFilter();
    const objectives = this.objectiveFilter();
    const categories = this.categoryFilter();
    const statuses = this.statusFilter();
    const priorities = this.priorityFilter();
    return this.store.tasks().filter((task) =>
      (objectives.length === 0 || objectives.includes(task.objectiveId)) &&
      (categories.length === 0 || categories.includes(task.categoryId)) &&
      (assignees.length === 0 || task.assigneeEmployeeIds.some((id) => assignees.includes(id))) &&
      (statuses.length === 0 || statuses.includes(task.statusId)) &&
      (priorities.length === 0 || priorities.includes(task.priority))
    );
  }

  tasksForSprint(sprintId: string): WorkTask[] {
    return this.filteredTasks().filter((task) => task.sprintId === sprintId);
  }

  toggleExpanded(sprintId: string): void {
    this.expandedSprintId.set(this.expandedSprintId() === sprintId ? null : sprintId);
  }

  protected onTaskSelectionChanged(event: { taskId: string; selected: boolean }): void {
    this.selection.toggle(event.taskId, event.selected);
  }

  protected onSelectAllChanged(event: { taskIds: string[]; selected: boolean }): void {
    this.selection.setMany(event.taskIds, event.selected);
  }

  protected clearSelection(): void {
    this.assigneePickerOpen.set(false);
    this.selection.clear();
  }

  protected onBulkAction(actionId: string): void {
    this.bulkError.set(null);
    switch (actionId) {
      case 'move-to-sprint': this.moveDialogOpen.set(true); break;
      case 'move-to-backlog': void this.onMoveToBacklog(); break;
      case 'delete': this.deleteConfirmOpen.set(true); break;
    }
  }

  protected async applyBulkStatus(statusId: string): Promise<void> {
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Change status', () => this.taskApi.bulkMoveStatus(ids, statusId));
  }

  protected async applyBulkAssignee(employeeId: string | null): Promise<void> {
    if (!employeeId) return;
    this.assigneePickerOpen.set(false);
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Change assignee', () => this.taskApi.bulkAssign(ids, employeeId));
  }

  protected async applyBulkPriority(priority: string): Promise<void> {
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Set priority', () => this.taskApi.bulkSetPriority(ids, priority as WorkTask['priority']));
  }

  protected async applyBulkDueDate(value: string): Promise<void> {
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Set due date', () => this.taskApi.bulkSetDueDate(ids, value || null));
  }

  protected async applyBulkParent(parentTaskId: string): Promise<void> {
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Convert to subtask', () => this.taskApi.bulkConvertToSubtask(ids, parentTaskId));
  }

  protected async onDeleteConfirmed(): Promise<void> {
    const ids = this.selectedTasks().map((task) => task.id);
    await this.runBulk('Delete', () => this.taskApi.bulkDelete(ids), () => this.deleteConfirmOpen.set(false));
  }

  private async runBulk(
    title: string,
    call: () => Observable<BulkTaskActionResponse>,
    close: () => void = () => undefined
  ): Promise<void> {
    this.bulkSubmitting.set(true);
    this.bulkError.set(null);
    try {
      const response = await firstValueFrom(call());
      close();
      this.bulkResult.set({ title, summary: toBulkResultSummary(response) });
      this.clearSelection();
      await this.reloadTasks();
    } catch (error: unknown) {
      const detail = (error as { error?: { detail?: string } })?.error?.detail;
      this.bulkError.set(detail || 'The bulk action failed. Nothing was changed.');
    } finally {
      this.bulkSubmitting.set(false);
    }
  }

  /** Applies sprint changes through the one API that supports both sprint assignment and backlog removal. */
  private async applySprintMoves(
    moves: { taskId: string; from: string | null; to: string | null }[]
  ): Promise<void> {
    const bySprint = new Map<string, { addTaskIds: string[]; removeTaskIds: string[] }>();
    const bucket = (id: string) =>
      bySprint.get(id) ?? bySprint.set(id, { addTaskIds: [], removeTaskIds: [] }).get(id)!;
    for (const move of moves) {
      if (move.to) bucket(move.to).addTaskIds.push(move.taskId);
      else if (move.from) bucket(move.from).removeTaskIds.push(move.taskId);
    }
    for (const [sprintId, request] of bySprint) {
      await firstValueFrom(this.sprintApi.setTasks(sprintId, request));
    }
    await this.sprintStore.loadForProject(this.projectId());
  }

  protected async onTasksMoved(targetSprintId: string): Promise<void> {
    const tasks = this.selectedTasks();
    if (tasks.length === 0) return;

    this.movingTasks.set(true);
    this.moveError.set(null);
    try {
      await this.applySprintMoves(tasks.map((task) => ({ taskId: task.id, from: task.sprintId, to: targetSprintId })));
      this.lastMove = tasks.map((task) => ({
        taskId: task.id,
        previousSprintId: task.sprintId,
        newSprintId: targetSprintId
      }));
      const targetName = this.sprintStore.sprints().find((s) => s.id === targetSprintId)?.name ?? 'the sprint';
      this.showUndoBanner(`${tasks.length} task${tasks.length === 1 ? '' : 's'} moved to ${targetName}`);
      this.moveDialogOpen.set(false);
      this.clearSelection();
      await this.reloadTasks();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.moveError.set(detail || 'Failed to move the selected tasks.');
    } finally {
      this.movingTasks.set(false);
    }
  }

  protected async onMoveToBacklog(): Promise<void> {
    const tasks = this.selectedTasks().filter((task) => task.sprintId);
    if (tasks.length === 0) return;
    this.bulkError.set(null);
    try {
      await this.applySprintMoves(tasks.map((task) => ({ taskId: task.id, from: task.sprintId, to: null })));
      this.lastMove = tasks.map((task) => ({
        taskId: task.id,
        previousSprintId: task.sprintId,
        newSprintId: null
      }));
      this.showUndoBanner(`${tasks.length} task${tasks.length === 1 ? '' : 's'} moved to the backlog`);
      this.clearSelection();
      await this.reloadTasks();
    } catch (error: unknown) {
      const detail = (error as { error?: { detail?: string } })?.error?.detail;
      this.bulkError.set(detail || 'Failed to move the selected tasks to the backlog.');
    }
  }

  protected async undoMove(): Promise<void> {
    const moves = this.lastMove;
    if (moves.length === 0) return;
    this.lastMove = [];
    this.moveUndoBanner.set(null);
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);

    await this.applySprintMoves(moves.map((move) => ({
      taskId: move.taskId,
      from: move.newSprintId,
      to: move.previousSprintId
    })));
    await this.reloadTasks();
  }

  private showUndoBanner(message: string): void {
    if (this.undoBannerTimer) clearTimeout(this.undoBannerTimer);
    this.moveUndoBanner.set({ message });
    this.undoBannerTimer = setTimeout(() => {
      this.moveUndoBanner.set(null);
      this.lastMove = [];
    }, 8000);
  }

  protected readonly assigneeFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.assignableMembers().map((member) => ({ value: member.employeeId, label: member.name }))
  );

  protected setObjectiveFilter(ids: string[]): void { this.objectiveFilter.set(ids); }
  protected setCategoryFilter(ids: string[]): void { this.categoryFilter.set(ids); }
  protected setAssigneeFilter(ids: string[]): void { this.clearSelection(); this.assigneeFilter.set(ids); }
  protected setSprintStatusFilter(value: string): void { this.sprintStatusFilter.set(value as 'all' | SprintStatus); }

  protected onFilterFieldChanged(event: { key: string; values: string[] }): void {
    this.clearSelection();
    switch (event.key) {
      case 'module': this.setObjectiveFilter(event.values); break;
      case 'category': this.setCategoryFilter(event.values); break;
      case 'assignee': this.setAssigneeFilter(event.values); break;
      case 'sprintStatus': this.setSprintStatusFilter(event.values[0] ?? 'all'); break;
      case 'status': this.statusFilter.set(event.values); break;
      case 'priority': this.priorityFilter.set(event.values); break;
    }
  }

  protected readonly taskModalOpen = signal(false);
  protected readonly taskModalMode = signal<'create' | 'edit'>('create');
  protected readonly taskModalTaskId = signal('');
  protected readonly taskModalDraftId = signal('');
  protected readonly targetSprintForCreate = signal<Sprint | null>(null);

  protected readonly modalPrefillModuleId = computed(() => {
    const filter = this.objectiveFilter();
    return filter.length === 1 ? filter[0] : '';
  });

  protected readonly modalPrefillSprintId = computed(() => {
    const target = this.targetSprintForCreate();
    if (target) return target.id;
    return this.expandedSprintId() ?? '';
  });

  protected openCreateTask(sprint?: Sprint): void {
    this.targetSprintForCreate.set(sprint ?? null);
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalDraftId.set('');
    this.taskModalOpen.set(true);
  }

  protected closeTaskModal(): void {
    this.targetSprintForCreate.set(null);
    this.taskModalOpen.set(false);
    this.clearDraftParam();
  }

  /** Drop ?taskDraftId= so reloading or revisiting the page does not reopen a finished draft. */
  private clearDraftParam(): void {
    if (!this.taskModalDraftId()) return;
    this.taskModalDraftId.set('');
    void this.router.navigate([], { queryParams: { taskDraftId: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  async reloadTasks(): Promise<void> {
    await this.store.loadBoard(this.projectId());
  }

  onTaskViewed(task: WorkTask): void {
    this.taskModalMode.set('edit');
    this.taskModalTaskId.set(task.id);
    this.taskModalDraftId.set('');
    this.taskModalOpen.set(true);
  }

  protected onTaskModalDone(): void {
    this.targetSprintForCreate.set(null);
    this.taskModalOpen.set(false);
    this.clearDraftParam();
    void this.reloadTasks();
  }

  protected onSprintStarted(): void {
    this.startingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  protected onSprintCompleted(): void {
    this.completingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  onTaskStatusChangeRequested(event: { taskId: string; newStatusId: string }): void {
    if (event.taskId) void this.store.moveTask(event.taskId, event.newStatusId);
  }

  protected onSprintCreated(): void {
    this.createSprintOpen.set(false);
    void this.sprintStore.loadForProject(this.projectId());
  }

  protected onSprintEdited(): void {
    this.editingSprint.set(null);
    void this.sprintStore.loadForProject(this.projectId());
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.projectStore.loadProjectMembers(projectId);
      const members = this.projectStore.projectMembers();
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee',
        avatarUrl: (member as { avatarUrl?: string | null }).avatarUrl ?? null
      })));
    } catch {
      this.assignableMembers.set([]);
    }
  }

  private async loadCategories(projectId: string): Promise<void> {
    try {
      this.categories.set((await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn));
    } catch {
      this.categories.set([]);
    }
  }
}
