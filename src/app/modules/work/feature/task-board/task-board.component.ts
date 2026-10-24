import { MeetingApiService } from '../../meetings/data-access/meeting-api.service';
import { MeetingOccurrenceDrawerComponent } from '../../meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { MeetingListItem } from '../../meetings/models/meeting.models';
import { MeetingCardComponent } from '../../meetings/ui/meeting-card/meeting-card.component';
import { meetingListWindow } from '../../meetings/utils/meeting-time';
import { MeetingFormModalComponent } from '../../meetings/ui/meeting-form-modal/meeting-form-modal.component';
import { MeetingsAvailabilityService } from '../../meetings/state/meetings-availability.service';
import { AfterViewChecked, AfterViewInit, Component, OnDestroy, OnInit, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { WorkPageToolbarStore } from '../../state/work-page-toolbar.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { FilterBarComponent, FilterFieldConfig } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { ProfileStore } from '../../../profile/state/profile.store';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { BoardStructureEditorComponent } from '../../ui/board-structure-editor/board-structure-editor.component';
import { CreateTaskRequestDto } from '../../models/dto/task.dto';
import { isPendingApproval } from '../../models/dto/work-approval.dto';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, ButtonComponent, ErrorStateComponent, FilterBarComponent, TaskAssigneeAvatarFilterComponent, TaskFormModalComponent, BoardStructureEditorComponent, MeetingFormModalComponent, MeetingCardComponent, MeetingOccurrenceDrawerComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="task-board__toolbar">
        @if (searchExpanded()) {
          <div class="ui-field ui-field--sm w-80" data-testid="board-search">
            <span class="ui-field__addon" aria-hidden="true"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg></span>
            <input autofocus type="search" placeholder="Search work items…" [value]="searchTerm()"
              (input)="onSearchChanged($any($event.target).value)"
              class="ui-field__control" />
            <span class="ui-field__trailing"><button type="button" data-testid="board-search-close" aria-label="Close search" title="Close search"
              class="ui-field__icon-btn h-5 w-5 text-base leading-none"
              (click)="toggleSearch()">&times;</button></span>
          </div>
        } @else {
          <button type="button" data-testid="board-search-toggle" aria-label="Search board" title="Search board"
            class="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
            (click)="toggleSearch()">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        }
        <app-task-assignee-avatar-filter
          [members]="projectRosterMembers()"
          [currentEmployeeId]="currentEmployee.id()"
          [selected]="assigneeFilter()"
          (selectionChanged)="setAssigneeFilter($event)"
        />
        <app-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterFieldChanged($event)" />
        @if (modules().length > 0 && !isOfficeProject()) {
          <app-button variant="primary" (pressed)="goToCreate()">Create work item</app-button>
          @if (meetingsAvailability.canCreate()) {
            <app-button variant="secondary" data-testid="board-new-meeting" (pressed)="meetingFormOpen.set(true)">New meeting</app-button>
          }
        }
      </div>
    </ng-template>

    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <app-error-state [message]="store.error()!" [retryable]="true" (retry)="reload()" />
    } @else {
      @if (meetings().length > 0) {
        <!-- Meetings are not status columns and cannot be dragged (spec 5.9): their own lane, outside every drop list. -->
        <div class="mb-3 flex flex-col gap-1" data-testid="board-meetings-lane">
          <div class="text-xs font-semibold text-[var(--color-text-secondary)]">Meetings</div>
          <div class="flex flex-wrap gap-2">
            @for (meeting of meetings(); track meeting.taskId) {
              <app-meeting-card class="w-64" [item]="meeting" (open)="openMeeting.set($event)" />
            }
          </div>
        </div>
      }
      <div class="task-board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            [allStatuses]="store.statuses()"
            [currentEmployeeId]="currentEmployee.id()"
            [assignableMembers]="assignableMembers()"
            [modules]="moduleOptions()"
            [categories]="categories()"
            [defaultObjectiveId]="modalPrefillModuleId()"
            [defaultSprintId]="modalPrefillSprintId()"
            [projectId]="projectId()"
            [isProjectMember]="isProjectMember() && !isOfficeProject()"
            (taskDropped)="onTaskDropped($event)"
            (taskViewed)="onTaskViewed($event)"
            (taskChanged)="reload()"
            (statusUpdated)="reload()"
            (editStatusesClicked)="boardStructureEditorOpen.set(true)"
            (quickTaskCreated)="onQuickTaskCreated($event)"
          />
        }
      </div>
    }

    @if (openMeeting(); as key) {
      <app-meeting-occurrence-drawer [key]="key" (closed)="onMeetingDrawerClosed()" />
    }

    @if (meetingFormOpen()) {
      <app-meeting-form-modal [open]="true" mode="create" [placement]="{ projectId: projectId(), objectiveId: null }"
        (saved)="onMeetingSaved()" (closed)="meetingFormOpen.set(false)" />
    }

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      [prefillModuleId]="modalPrefillModuleId()"
      [prefillSprintId]="modalPrefillSprintId()"
      (taskSelected)="taskModalTaskId.set($event)"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
      (changed)="reload()"
      (closed)="taskModalOpen.set(false)"
    />

    <app-board-structure-editor
      [open]="boardStructureEditorOpen()"
      [projectId]="projectId()"
      [statuses]="store.statuses()"
      (closed)="boardStructureEditorOpen.set(false)"
      (saved)="reload()"
    />
  `,
  styles: [`
    .task-board__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    /* Match the Filter trigger and Create Sprint button (30px tall, 8px radius) */
    .task-board__toolbar ::ng-deep app-button > button { width: auto; height: 30px; padding: 0 12px; border-radius: 8px; font-size: 13px; }
    .task-board { display: flex; align-items: flex-start; gap: 16px; width: 100%; box-sizing: border-box; overflow-x: auto; padding: 0 0 10px; scroll-snap-type: x proximity; }
    :host ::ng-deep .task-card--highlighted { outline: 2px solid var(--color-focus-ring, var(--color-danger)); outline-offset: 2px; }
  `]
})
export class TaskBoardComponent implements OnInit, AfterViewChecked, AfterViewInit, OnDestroy {
  protected readonly store = inject(TaskBoardStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly sprintApi = inject(SprintApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly meetingApi = inject(MeetingApiService);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);
  private readonly profileStore = inject(ProfileStore, { optional: true });
  private readonly fileApi = inject(FileApiService, { optional: true });
  private readonly notificationService = inject(NotificationService);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');

  protected readonly projectId = signal('');
  protected readonly meetingFormOpen = signal(false);
  protected readonly meetingsAvailability = inject(MeetingsAvailabilityService);
  protected readonly meetings = signal<readonly MeetingListItem[]>([]);
  protected readonly openMeeting = signal<{ seriesId: string; originalStart: string } | null>(null);
  protected readonly isOfficeProject = computed(() => this.projectStore.project()?.systemPurpose === 'office');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly rawAssignableMembers = signal<TaskAssigneeAvatarMember[]>([]);
  protected readonly assignableMembers = computed<TaskAssigneeAvatarMember[]>(() => {
    const raw = this.rawAssignableMembers();
    const avatarMap = new Map<string, string>();
    const tasks = typeof this.store.tasks === 'function' ? this.store.tasks() : [];
    for (const task of tasks) {
      for (const a of task.assignees ?? []) {
        if (a.avatarUrl && !avatarMap.has(a.employeeId)) {
          avatarMap.set(a.employeeId, a.avatarUrl);
        }
      }
    }
    const subtaskMap = typeof this.store.subtasksByParentId === 'function' ? this.store.subtasksByParentId() : {};
    for (const subtasks of Object.values(subtaskMap)) {
      for (const st of subtasks) {
        for (const a of st.assignees ?? []) {
          if (a.avatarUrl && !avatarMap.has(a.employeeId)) {
            avatarMap.set(a.employeeId, a.avatarUrl);
          }
        }
      }
    }
    const currentEmpId = this.currentEmployee.id();
    const myAvatarFileId = this.profileStore?.profile()?.personalInformation?.avatarFileId;
    if (currentEmpId && myAvatarFileId && !avatarMap.has(currentEmpId) && this.fileApi) {
      avatarMap.set(currentEmpId, this.fileApi.getFileUrl(myAvatarFileId));
    }

    return raw.map((m) => ({
      employeeId: m.employeeId,
      name: m.name,
      avatarUrl: m.avatarUrl ?? avatarMap.get(m.employeeId) ?? null
    }));
  });
  // Everyone on the project, unscoped by which milestones the viewer can reach - the roster
  // shown in the toolbar avatar stack. Deliberately separate from assignableMembers() above,
  // which stays scoped for the actual task-assignment flows.
  protected readonly projectRosterMembers = computed<TaskAssigneeAvatarMember[]>(() =>
    (this.projectStore.project()?.members ?? []).map((member) => ({
      employeeId: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarFileId ? this.fileApi?.getFileUrl(member.avatarFileId) ?? null : null
    }))
  );
  protected readonly objectiveFilter = signal<string[]>([]);
  // Defaults to 'all' so no sprint is auto-selected on load; only filtered when explicitly chosen by the user.
  protected readonly sprintFilter = signal('all');
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  protected readonly statusFilter = signal<string[]>([]);
  protected readonly priorityFilter = signal<string[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly searchExpanded = signal(false);
  protected readonly boardStructureEditorOpen = signal(false);
  private highlightTaskId: string | null = null;
  private didScrollToHighlight = false;

  constructor() {
    // Switching projects via the breadcrumb switcher navigates to a sibling route matching the
    // same path shape (/work/:id/board) - Angular reuses this component instance rather than
    // re-instantiating it, so the :id param must be watched reactively, not just read once.
    if (this.route.paramMap) {
      this.route.paramMap
        .pipe(
          map((paramMap) => paramMap.get('id') ?? ''),
          distinctUntilChanged(),
          takeUntilDestroyed()
        )
        .subscribe((projectId) => {
          this.projectId.set(projectId);
          if (!projectId) return;
          void this.loadAssignableMembers(projectId);
          this.reload();
        });
    } else {
      const projectId = this.route.snapshot?.paramMap?.get('id') ?? '';
      this.projectId.set(projectId);
      if (projectId) {
        void this.loadAssignableMembers(projectId);
        this.reload();
      }
    }
  }

  protected readonly modules = computed(() => this.projectStore.milestones());
  protected readonly moduleOptions = computed(() =>
    this.modules().map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner }))
  );
  protected readonly isProjectMember = computed(() => {
    const empId = this.currentEmployee.id();
    if (!empId) return false;
    const isModuleOwner = this.modules().some((m) => m.isOwner);
    const isMember = this.assignableMembers().some((m) => m.employeeId === empId);
    const isLead = this.projectStore.project()?.isLead ?? false;
    return isModuleOwner || isMember || isLead;
  });
  protected readonly objectiveOptions = computed<WorkDropdownOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );
  protected readonly sprintOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'active', label: 'Active sprints' },
    { value: 'all', label: 'All sprints' },
    { value: 'individual', label: 'Individual task' },
    ...this.sprints().map((sprint) => ({ value: sprint.id, label: sprint.name }))
  ]);
  protected readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categories().map((category) => ({ value: category.id, label: category.name }))
  );
  protected readonly statusOptions = computed<WorkDropdownOption[]>(() =>
    this.store.statuses().map((status) => ({ value: status.id, label: status.name }))
  );
  protected readonly priorityOptions: readonly WorkDropdownOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];
  protected readonly filterFields = computed<FilterFieldConfig[]>(() => [
    { key: 'module', label: 'Module', icon: 'module', kind: 'multi', options: this.objectiveOptions() },
    { key: 'sprint', label: 'Sprint', icon: 'sprint', kind: 'single', options: this.sprintOptions(), defaultValues: ['all'] },
    { key: 'category', label: 'Category', icon: 'category', kind: 'multi', options: this.categoryOptions() },
    { key: 'assignee', label: 'Assignee', icon: 'people', kind: 'multi', options: this.assigneeFilterOptions() },
    { key: 'status', label: 'Status', icon: 'status', kind: 'multi', options: this.statusOptions() },
    { key: 'priority', label: 'Priority', icon: 'priority', kind: 'multi', options: this.priorityOptions }
  ]);
  protected readonly filterValues = computed<Record<string, string[]>>(() => ({
    module: this.objectiveFilter(),
    sprint: [this.sprintFilter()],
    category: this.categoryFilter(),
    assignee: this.assigneeFilter(),
    status: this.statusFilter(),
    priority: this.priorityFilter()
  }));
  protected readonly columnsWithTasks = computed(() =>
    this.store.columnsWithTasks().map((column) => ({
      status: column.status,
      tasks: column.tasks.filter((task) => this.matchesFilters(task))
    }))
  );
  protected readonly assigneeFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.assignableMembers().map((member) => ({ value: member.employeeId, label: member.name }))
  );

  protected setObjectiveFilter(ids: string[]): void { this.objectiveFilter.set(ids); }
  protected setSprintFilter(value: string): void { this.sprintFilter.set(value); }
  protected setCategoryFilter(ids: string[]): void { this.categoryFilter.set(ids); }
  protected setAssigneeFilter(ids: string[]): void { this.assigneeFilter.set(ids); }

  protected onSearchChanged(term: string): void { this.searchTerm.set(term); }

  protected toggleSearch(): void {
    this.searchExpanded.update((expanded) => !expanded);
    if (!this.searchExpanded()) this.searchTerm.set('');
  }

  protected onFilterFieldChanged(event: { key: string; values: string[] }): void {
    switch (event.key) {
      case 'module': this.setObjectiveFilter(event.values); break;
      case 'sprint': this.setSprintFilter(event.values[0] ?? 'all'); break;
      case 'category': this.setCategoryFilter(event.values); break;
      case 'assignee': this.setAssigneeFilter(event.values); break;
      case 'status': this.statusFilter.set(event.values); break;
      case 'priority': this.priorityFilter.set(event.values); break;
    }
  }

  columnIds(): string[] {
    return this.columnsWithTasks().map((column) => column.status.id);
  }

  ngOnInit(): void {
    this.highlightTaskId = this.route.snapshot?.queryParamMap?.get('highlightTaskId') ?? null;
    const linkedTaskId = this.route.snapshot?.queryParamMap?.get('taskId');
    if (linkedTaskId) {
      this.taskModalMode.set('edit');
      this.taskModalTaskId.set(linkedTaskId);
      this.taskModalOpen.set(true);
    }
    const assignee = this.route.snapshot?.queryParamMap?.get('assignee');
    if (assignee) this.assigneeFilter.set([assignee]);
    void this.currentEmployee.ensureLoaded();
  }

  protected reload(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    void this.store.loadBoard(projectId);
    void this.loadSprints(projectId);
    void this.loadCategories(projectId);
    this.loadMeetings();
  }

  ngAfterViewInit(): void {
    this.toolbarStore.setTemplate(this.toolbarTpl());
  }

  ngOnDestroy(): void {
    this.toolbarStore.setTemplate(null);
  }

  ngAfterViewChecked(): void {
    if (!this.highlightTaskId || this.didScrollToHighlight || this.store.loading()) return;
    const el = document.querySelector(`[data-testid="task-card-${this.highlightTaskId}"]`) as HTMLElement | null;
    if (!el) return;
    this.didScrollToHighlight = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    el.classList.add('task-card--highlighted');
  }

  private matchesFilters(task: WorkTask): boolean {
    const objectiveFilter = this.objectiveFilter();
    const objectiveMatches = objectiveFilter.length === 0 || objectiveFilter.includes(task.objectiveId);
    const sprintFilter = this.sprintFilter();
    const activeSprintIds = new Set(this.sprints().filter((sprint) => sprint.status === 'active').map((sprint) => sprint.id));
    // A Draft sprint hasn't been started yet, so its tasks stay off the Board under 'All sprints'
    // until the sprint starts - otherwise creating a task in an unstarted sprint would confusingly
    // put it in front of the team as if work were already underway. Explicitly picking that sprint
    // from the filter still shows it (the branch below, unaffected).
    const draftSprintIds = new Set(this.sprints().filter((sprint) => sprint.status === 'draft').map((sprint) => sprint.id));
    const sprintMatches = sprintFilter === 'all'
      ? !draftSprintIds.has(task.sprintId ?? '')
      : sprintFilter === 'active'
        ? activeSprintIds.has(task.sprintId ?? '')
        : sprintFilter === 'individual'
          ? task.sprintId == null
          : task.sprintId === sprintFilter;
    const categoryFilter = this.categoryFilter();
    const categoryMatches = categoryFilter.length === 0 || categoryFilter.includes(task.categoryId);
    const assignees = this.assigneeFilter();
    // A task also matches if one of its subtasks is assigned to a filtered person - subtasks
    // aren't independent board cards, so without this the parent would vanish from "my tasks"
    // even though the viewer owns a piece of the work underneath it.
    const assigneeMatches = assignees.length === 0
      || task.assigneeEmployeeIds.some((id) => assignees.includes(id))
      || task.subtaskAssigneeEmployeeIds.some((id) => assignees.includes(id));
    const statuses = this.statusFilter();
    const statusMatches = statuses.length === 0 || statuses.includes(task.statusId);
    const priorities = this.priorityFilter();
    const priorityMatches = priorities.length === 0 || priorities.includes(task.priority);
    const search = this.searchTerm().trim().toLowerCase();
    const searchMatches = !search
      || task.title.toLowerCase().includes(search)
      || task.shortId.toLowerCase().includes(search);
    return objectiveMatches && sprintMatches && categoryMatches && assigneeMatches && statusMatches && priorityMatches && searchMatches;
  }

  private async loadSprints(projectId: string): Promise<void> {
    try {
      const sprints = (await firstValueFrom(this.sprintApi.getByProject(projectId))).map(toSprint);
      this.sprints.set(sprints);
    } catch {
      this.sprints.set([]);
    }
  }

  private async loadCategories(projectId: string): Promise<void> {
    try {
      this.categories.set((await firstValueFrom(this.taskApi.getCategories(projectId))).map(toTaskCategoryColumn));
    } catch {
      this.categories.set([]);
    }
  }

  private async loadAssignableMembers(projectId: string): Promise<void> {
    try {
      await this.projectStore.loadProjectMembers(projectId);
      const members = this.projectStore.projectMembers();
      this.rawAssignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee'
      })));
    } catch {
      this.rawAssignableMembers.set([]);
    }
  }

  onTaskDropped(event: { taskId: string; newStatusId: string }): void {
    void this.store.moveTask(event.taskId, event.newStatusId);
  }

  protected readonly taskModalOpen = signal(false);
  protected readonly taskModalMode = signal<'create' | 'edit'>('create');
  protected readonly taskModalTaskId = signal('');

  protected readonly modalPrefillModuleId = computed(() => {
    const filter = this.objectiveFilter();
    return filter.length === 1 ? filter[0] : '';
  });

  protected readonly modalPrefillSprintId = computed(() => {
    const filter = this.sprintFilter();
    if (filter && filter !== 'all' && filter !== 'individual' && filter !== 'active') {
      return filter;
    }
    if (filter === 'active') {
      const active = this.sprints().filter((s) => s.status === 'active');
      return active.length === 1 ? active[0].id : '';
    }
    return '';
  });

  /** A meeting was created (or sent for approval) from the board: close the form and refresh the board. */
  protected onMeetingSaved(): void {
    this.meetingFormOpen.set(false);
    void this.store.loadBoard(this.projectId());
    this.loadMeetings();
  }

  protected onMeetingDrawerClosed(): void {
    this.openMeeting.set(null);
    this.loadMeetings();
  }

  /** Past, current and the next 7 days of this project's meetings the caller organizes or attends. */
  private loadMeetings(): void {
    const projectId = this.projectId();
    if (!projectId) return;
    const { from, to } = meetingListWindow();
    this.meetingApi.list(from, to, projectId).subscribe({
      next: (items) => this.meetings.set(items),
      error: () => this.meetings.set([]),
    });
  }

  onTaskViewed(task: WorkTask): void {
    this.taskModalMode.set('edit');
    this.taskModalTaskId.set(task.id);
    this.taskModalOpen.set(true);
  }

  protected goToCreate(): void {
    this.taskModalMode.set('create');
    this.taskModalTaskId.set('');
    this.taskModalOpen.set(true);
  }

  protected onTaskModalDone(): void {
    this.taskModalOpen.set(false);
    this.reload();
  }

  async onQuickTaskCreated(event: {
    title: string;
    statusId: string;
    priority: WorkTask['priority'];
    assigneeId?: string;
    dueDate?: string;
    objectiveId: string;
    categoryId: string;
    sprintId?: string | null;
    storyPoints?: number;
    resolve: (ok: boolean) => void;
  }): Promise<void> {
    const request: CreateTaskRequestDto = {
      title: event.title,
      categoryId: event.categoryId,
      priority: event.priority,
      dueDate: event.dueDate || undefined,
      sprintId: event.sprintId ?? null,
      storyPoints: event.storyPoints
    };

    try {
      // The backend decides: owners get the task now, members get a 202 "sent for approval".
      const result = await this.store.createTask(event.objectiveId, request);
      if (isPendingApproval(result)) {
        this.notificationService.info('Task sent for approval.');
        event.resolve(true);
        this.reload();
        return;
      }
      if (result && 'id' in result) {
        if (event.assigneeId) {
          try {
            await firstValueFrom(this.taskApi.assignTask(result.id, event.assigneeId));
          } catch {
            this.notificationService.warning('Task created, but failed to assign employee.');
          }
        }
        if (event.statusId && event.statusId !== result.statusId) {
          try {
            await firstValueFrom(this.taskApi.moveTaskStatus(result.id, event.statusId));
          } catch {}
        }
        this.notificationService.success('Task created successfully.');
        event.resolve(true);
        this.reload();
        return;
      }
      if (result && 'availableSlackHours' in result) {
        this.notificationService.warning(`Insufficient allocation hours. Available slack: ${result.availableSlackHours ?? 0} hrs.`);
      } else {
        this.notificationService.error(this.store.error() ?? 'Failed to create task.');
      }
      event.resolve(false);
    } catch {
      this.notificationService.error('Failed to create task.');
      event.resolve(false);
    }
  }
}

