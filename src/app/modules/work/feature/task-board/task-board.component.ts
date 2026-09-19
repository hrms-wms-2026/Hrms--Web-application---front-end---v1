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
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { toSprint } from '../../utils/sprint.mapper';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { WorkDropdownOption } from '../../ui/work-dropdown/work-dropdown.component';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../ui/task-filter-bar/task-filter-bar.component';
import { TaskAssigneeAvatarFilterComponent } from '../../ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { TaskFormModalComponent } from '../../ui/task-form-modal/task-form-modal.component';
import { BoardStructureEditorComponent } from '../../ui/board-structure-editor/board-structure-editor.component';
import { CreateTaskRequestDto } from '../../models/dto/task.dto';

@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [TaskBoardColumnComponent, ButtonComponent, ErrorStateComponent, TaskFilterBarComponent, TaskAssigneeAvatarFilterComponent, TaskFormModalComponent, BoardStructureEditorComponent],
  template: `
    <ng-template #toolbarTpl>
      <div class="task-board__toolbar">
        <app-task-assignee-avatar-filter
          [members]="assignableMembers()"
          [currentEmployeeId]="currentEmployee.id()"
          [selected]="assigneeFilter()"
          (selectionChanged)="setAssigneeFilter($event)"
        />
        <app-task-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterFieldChanged($event)" />
        @if (modules().length > 0) {
          <app-button variant="primary" (pressed)="goToCreate()">Create task</app-button>
        }
      </div>
    </ng-template>

    @if (store.loading()) {
      <p>Loading board…</p>
    } @else if (store.error()) {
      <app-error-state [message]="store.error()!" [retryable]="true" (retry)="reload()" />
    } @else {
      <div class="task-board">
        @for (column of columnsWithTasks(); track column.status.id) {
          <app-task-board-column
            [status]="column.status"
            [tasks]="column.tasks"
            [connectedListIds]="columnIds()"
            [allStatuses]="store.statuses()"
            [employeeNames]="employeeNames()"
            [currentEmployeeId]="currentEmployee.id()"
            [assignableMembers]="assignableMembers()"
            [modules]="moduleOptions()"
            [categories]="categories()"
            [defaultObjectiveId]="modalPrefillModuleId()"
            [defaultSprintId]="modalPrefillSprintId()"
            [projectId]="projectId()"
            [isProjectMember]="isProjectMember()"
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

    <app-task-form-modal
      [open]="taskModalOpen()"
      [mode]="taskModalMode()"
      [projectId]="projectId()"
      [taskId]="taskModalTaskId()"
      [prefillModuleId]="modalPrefillModuleId()"
      [prefillSprintId]="modalPrefillSprintId()"
      (created)="onTaskModalDone()"
      (saved)="onTaskModalDone()"
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
    .task-board__toolbar ::ng-deep app-button > button { width: auto; }
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
  private readonly directory = inject(EmployeeDirectoryStore);
  protected readonly currentEmployee = inject(CurrentEmployeeStore);
  private readonly toolbarStore = inject(WorkPageToolbarStore);
  private readonly toolbarTpl = viewChild.required<TemplateRef<unknown>>('toolbarTpl');

  protected readonly projectId = signal('');
  protected readonly sprints = signal<Sprint[]>([]);
  protected readonly categories = signal<TaskCategoryColumn[]>([]);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);
  protected readonly objectiveFilter = signal<string[]>([]);
  // Defaults to 'all' so no sprint is auto-selected on load; only filtered when explicitly chosen by the user.
  protected readonly sprintFilter = signal('all');
  protected readonly categoryFilter = signal<string[]>([]);
  protected readonly assigneeFilter = signal<string[]>([]);
  protected readonly statusFilter = signal<string[]>([]);
  protected readonly priorityFilter = signal<string[]>([]);
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
  protected readonly filterFields = computed<TaskFilterFieldConfig[]>(() => [
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
  protected readonly employeeNames = computed(() =>
    Object.fromEntries(
      this.store.tasks()
        .flatMap((task) => task.assigneeEmployeeIds)
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id) => [id, this.directory.get(id)?.name ?? 'Unknown employee'])
    )
  );

  protected readonly assigneeFilterOptions = computed<WorkDropdownOption[]>(() =>
    this.assignableMembers().map((member) => ({ value: member.employeeId, label: member.name }))
  );

  protected setObjectiveFilter(ids: string[]): void { this.objectiveFilter.set(ids); }
  protected setSprintFilter(value: string): void { this.sprintFilter.set(value); }
  protected setCategoryFilter(ids: string[]): void { this.categoryFilter.set(ids); }
  protected setAssigneeFilter(ids: string[]): void { this.assigneeFilter.set(ids); }

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
    const assigneeMatches = assignees.length === 0 || task.assigneeEmployeeIds.some((id) => assignees.includes(id));
    const statuses = this.statusFilter();
    const statusMatches = statuses.length === 0 || statuses.includes(task.statusId);
    const priorities = this.priorityFilter();
    const priorityMatches = priorities.length === 0 || priorities.includes(task.priority);
    return objectiveMatches && sprintMatches && categoryMatches && assigneeMatches && statusMatches && priorityMatches;
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
      // Still needed here even though the dropdown itself now uses member.name directly
      // (server-resolved): employeeNames above resolves *existing task* assignees, which
      // WorkTaskResponse only carries as raw EmployeeId GUIDs, and this is the only call in
      // this component that populates the shared directory cache those names come from.
      await this.directory.ensureLoaded(members.map((member) => member.employeeId));
      this.assignableMembers.set(members.map((member) => ({
        employeeId: member.employeeId,
        name: member.name ?? 'Unknown employee'
      })));
    } catch {
      this.assignableMembers.set([]);
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
    resolve: (ok: boolean) => void;
  }): Promise<void> {
    const isOwner = this.modules().find((m) => m.objectiveId === event.objectiveId)?.isOwner ?? true;
    const request: CreateTaskRequestDto = {
      title: event.title,
      categoryId: event.categoryId,
      priority: event.priority,
      dueDate: event.dueDate || undefined,
      sprintId: event.sprintId ?? null
    };

    try {
      if (!isOwner) {
        await firstValueFrom(this.taskApi.createTaskCreationRequest(event.objectiveId, request));
        event.resolve(true);
        this.reload();
        return;
      }

      const result = await this.store.createTask(event.objectiveId, request);
      if (result && 'id' in result) {
        if (event.assigneeId) {
          try {
            await firstValueFrom(this.taskApi.assignTask(result.id, event.assigneeId));
          } catch {}
        }
        if (event.statusId && event.statusId !== result.statusId) {
          try {
            await firstValueFrom(this.taskApi.moveTaskStatus(result.id, event.statusId));
          } catch {}
        }
        event.resolve(true);
        this.reload();
        return;
      }
      event.resolve(false);
    } catch {
      event.resolve(false);
    }
  }
}

