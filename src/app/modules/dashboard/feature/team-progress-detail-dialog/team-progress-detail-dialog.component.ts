import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  WritableSignal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent
} from '../../../../shared/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { TeamProgressDetailApiService } from '../../data-access/team-progress-detail-api.service';
import {
  LedHourTotals,
  LedModuleProgress,
  LedOverdueTask,
  LedProjectProgress,
  LedWorkProgressResponse
} from '../../models/my-team-led-progress.model';
import {
  LedEmployeeProgress,
  LedEmployeeProgressPage,
  LedEmployeeQuery,
  LedEmployeeSort,
  LedPeriodProgress,
  LedProgressPeriod,
  LedSortDirection,
  LedTaskPage,
  LedTaskQuery,
  LedTaskRow,
  LedTaskSort,
  LedTaskStatus
} from '../../models/team-progress-detail.model';
import {
  PROGRESS_STATUSES,
  PROGRESS_STATUS_BY_KEY,
  ProgressStatusKey,
  ProgressStatusMeta,
  formatHourValue,
  formatPercent
} from '../../utils/team-progress-format.util';

export type TeamProgressTab = 'overview' | 'employees' | 'projects' | 'modules' | 'tasks';

export const TEAM_PROGRESS_PAGE_SIZE = 20;
export const TEAM_PROGRESS_SEARCH_DEBOUNCE_MS = 300;
/** Rows in the Overview's compact Employee Breakdown. */
export const TEAM_PROGRESS_OVERVIEW_EMPLOYEES = 5;
/** Rows in the Overview's "Status by project / module" panel before "View all". */
const BREAKDOWN_ROWS = 6;

type DatedPeriod = Exclude<LedProgressPeriod, 'all'>;

interface PeriodQuery {
  period: DatedPeriod;
  filters: { projectId?: string; objectiveId?: string };
}

interface OverviewTile {
  meta: ProgressStatusMeta;
  hours: number;
  percent: string;
  /** Tasks in this status: only known for a period. */
  taskCount: number | null;
}

/** One shape for the Overview, whether it comes from the all-time summary or a period summary. */
interface OverviewView {
  tiles: OverviewTile[];
  segments: StatusSegment[];
  totalHours: number;
  totalLabel: string;
  taskCount: number;
  completion: string;
  overTaskedHours: number;
  unestimatedTaskCount: number;
  chartLabel: string;
}

interface BreakdownRow {
  id: string;
  label: string;
  total: number;
  /** Bar length relative to the largest row (0-100). */
  width: number;
  segments: StatusSegment[];
  ariaLabel: string;
}

interface StatusSegment {
  meta: ProgressStatusMeta;
  hours: number;
  /** Share of the bar scale (0-100). */
  percent: number;
}

interface ModuleRow {
  objectiveId: string;
  projectId: string;
  projectName: string;
  title: string;
  depth: number;
  atRisk: boolean;
  hours: LedHourTotals;
}

interface DonutSlice {
  meta: ProgressStatusMeta;
  dash: string;
  offset: number;
}

/** Status of one server-backed tab. `key` is the query the data belongs to (the per-tab cache). */
interface RemoteState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
}

type TaskStatusFilter = LedTaskStatus | '';

const TASK_STATUS_META: Readonly<Record<LedTaskStatus, ProgressStatusMeta>> = {
  completed: PROGRESS_STATUS_BY_KEY.completed,
  inProgress: PROGRESS_STATUS_BY_KEY.inProgress,
  notStarted: PROGRESS_STATUS_BY_KEY.notStarted
};

/**
 * Team Progress detail: Overview / By Employee / By Project / By Module / Tasks over the caller's led
 * scope. Overview, projects and modules come from the card's summary (filtered client-side); the
 * employee and task tabs page through the server, fetched only while the dialog is open and the tab
 * is showing, and cached per tab until a filter, search, sort or page changes.
 * Hours are task estimates (weightage), never time worked.
 */
@Component({
  selector: 'app-team-progress-detail-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ModalComponent,
    TabsComponent,
    SelectComponent,
    InputComponent,
    DataTableComponent,
    DataTableCellDirective,
    EmptyStateComponent,
    ErrorStateComponent
  ],
  templateUrl: './team-progress-detail-dialog.component.html',
  styleUrl: './team-progress-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamProgressDetailDialogComponent {
  readonly open = input(false);
  readonly summary = input<LedWorkProgressResponse | null>(null);
  /** Due-date window. The card owns it: the dropdown only emits `periodChange`. */
  readonly period = input<LedProgressPeriod>('all');
  readonly closed = output<void>();
  readonly periodChange = output<LedProgressPeriod>();

  private readonly api = inject(TeamProgressDetailApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formatHours = formatHourValue;
  protected readonly formatPercent = formatPercent;
  protected readonly statuses = PROGRESS_STATUSES;
  protected readonly pageSize = TEAM_PROGRESS_PAGE_SIZE;

  protected readonly tabs: readonly TabOption[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'employees', label: 'By Employee' },
    { value: 'projects', label: 'By Project' },
    { value: 'modules', label: 'By Module' },
    { value: 'tasks', label: 'Task List' }
  ];

  protected readonly periodOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All time' },
    { value: 'month', label: 'This month' },
    { value: 'week', label: 'This week' }
  ];

  protected readonly activeTab = signal<TeamProgressTab>('overview');
  protected readonly activeTabLabel = computed(() => this.tabs.find((t) => t.value === this.activeTab())?.label ?? '');
  protected readonly projectFilter = signal('');
  protected readonly moduleFilter = signal('');

  /** True for This week / This month. */
  protected readonly isPeriod = computed(() => this.period() !== 'all');
  protected readonly periodCaption = computed(() => (this.period() === 'week' ? 'Due this week' : 'Due this month'));
  /** The `period` query param: omitted for All time so the backend keeps its default. */
  private readonly periodParam = computed<LedProgressPeriod | undefined>(() => (this.period() === 'all' ? undefined : this.period()));

  // ---- Overview: compact Employee Breakdown (server, top 5) ----
  protected readonly overviewEmployeeSearchText = signal('');
  private readonly overviewEmployeeSearch = signal('');
  /** Pages reset to 1 whenever the period changes (linkedSignal), in the same change as the period. */
  protected readonly overviewEmployeePage = linkedSignal({ source: this.period, computation: () => 1 });
  protected readonly overviewEmployees = signal<RemoteState<LedEmployeeProgressPage>>({ status: 'idle', data: null });

  // ---- Overview: period summary (server, week / month only) ----
  protected readonly periodSummary = signal<RemoteState<LedPeriodProgress>>({ status: 'idle', data: null });

  // ---- By Employee (server) ----
  protected readonly employeeSearchText = signal('');
  private readonly employeeSearch = signal('');
  protected readonly employeeSort = signal<LedEmployeeSort>('totalHours');
  protected readonly employeeDir = signal<LedSortDirection>('desc');
  protected readonly employeePage = linkedSignal({ source: this.period, computation: () => 1 });
  protected readonly employees = signal<RemoteState<LedEmployeeProgressPage>>({ status: 'idle', data: null });

  // ---- Tasks (server) ----
  protected readonly taskSearchText = signal('');
  private readonly taskSearch = signal('');
  protected readonly taskStatus = signal<TaskStatusFilter>('');
  protected readonly taskEmployee = signal<{ id: string; name: string } | null>(null);
  protected readonly taskSort = signal<LedTaskSort>('estimatedHours');
  protected readonly taskDir = signal<LedSortDirection>('desc');
  protected readonly taskPage = linkedSignal({ source: this.period, computation: () => 1 });
  protected readonly tasks = signal<RemoteState<LedTaskPage>>({ status: 'idle', data: null });

  protected readonly taskStatusChips: readonly { value: TaskStatusFilter; label: string; meta: ProgressStatusMeta | null }[] = [
    { value: '', label: 'All', meta: null },
    { value: 'completed', label: 'Completed', meta: TASK_STATUS_META.completed },
    { value: 'inProgress', label: 'In progress', meta: TASK_STATUS_META.inProgress },
    { value: 'notStarted', label: 'Not started', meta: TASK_STATUS_META.notStarted }
  ];

  protected readonly projectColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Project', width: '22%' },
    { key: 'allocated', label: 'Total weightage', align: 'end' },
    { key: 'completed', label: 'Completed', align: 'end' },
    { key: 'inProgress', label: 'In progress', align: 'end' },
    { key: 'notStarted', label: 'Not started', align: 'end' },
    { key: 'untasked', label: 'Not yet tasked', align: 'end' },
    { key: 'completion', label: 'Completion', align: 'end' },
    { key: 'bar', label: 'Breakdown', width: '16%' }
  ];

  protected readonly moduleColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Module', width: '26%' },
    { key: 'allocated', label: 'Total weightage', align: 'end' },
    { key: 'completed', label: 'Completed', align: 'end' },
    { key: 'inProgress', label: 'In progress', align: 'end' },
    { key: 'notStarted', label: 'Not started', align: 'end' },
    { key: 'untasked', label: 'Not yet tasked', align: 'end' },
    { key: 'completion', label: 'Completion', align: 'end' },
    { key: 'bar', label: 'Breakdown', width: '14%' }
  ];

  protected readonly employeeColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Employee', sortable: true, width: '24%' },
    { key: 'completedHours', label: 'Completed', sortable: true, align: 'end' },
    { key: 'inProgressHours', label: 'In progress', sortable: true, align: 'end' },
    { key: 'notStartedHours', label: 'Not started', sortable: true, align: 'end' },
    { key: 'totalHours', label: 'Total assigned', sortable: true, align: 'end' },
    { key: 'shared', label: 'Shared tasks', width: '18%' }
  ];

  protected readonly taskColumns: readonly DataTableColumn[] = [
    { key: 'title', label: 'Task', sortable: true, width: '26%' },
    { key: 'status', label: 'Status', sortable: true, width: '12%' },
    { key: 'estimatedHours', label: 'Estimate', sortable: true, align: 'end', width: '9%' },
    { key: 'assignees', label: 'Assignees', wrap: true, width: '17%' },
    { key: 'project', label: 'Project', width: '12%' },
    { key: 'module', label: 'Module', width: '13%' },
    { key: 'dueDate', label: 'Due', sortable: true, width: '11%' }
  ];

  protected readonly trackProject = (p: LedProjectProgress): string => p.projectId;
  protected readonly trackModule = (m: ModuleRow): string => m.objectiveId;
  protected readonly trackEmployee = (e: LedEmployeeProgress): string => e.employeeId;
  protected readonly trackTask = (t: LedTaskRow): string => t.taskId;
  protected readonly sortTestId = (key: string): string => `tp-sort-${key}`;
  protected readonly employeeRowTestId = (e: LedEmployeeProgress): string => `tp-employee-${e.employeeId}`;
  protected readonly moduleRowTestId = (m: ModuleRow): string => `tp-module-${m.objectiveId}`;
  protected readonly taskRowTestId = (t: LedTaskRow): string => `tp-task-${t.taskId}`;
  protected readonly moduleRowClass = (m: ModuleRow): string => (m.depth > 0 ? 'team-progress-detail__child-row' : '');

  // ---- Filters (options from the summary) ----

  private readonly projects = computed(() => this.summary()?.projects ?? []);

  /** objectiveId -> its project and module, for every module in the summary. */
  private readonly moduleIndex = computed(() => {
    const index = new Map<string, { project: LedProjectProgress; module: LedModuleProgress }>();
    for (const project of this.projects()) {
      for (const module of project.modules) index.set(module.objectiveId, { project, module });
    }
    return index;
  });

  /** The selected module, when it's still in the summary. */
  private readonly selectedModule = computed(() => this.moduleIndex().get(this.moduleFilter()) ?? null);

  /** The selected project; picking a module implies its project. */
  private readonly selectedProject = computed<LedProjectProgress | null>(() => {
    const id = this.projectFilter();
    const fromProject = id ? (this.projects().find((p) => p.projectId === id) ?? null) : null;
    return fromProject ?? this.selectedModule()?.project ?? null;
  });

  protected readonly hasFilters = computed(() => !!this.selectedProject() || !!this.selectedModule());

  protected readonly projectOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All projects' },
    ...this.projects().map((p) => ({ value: p.projectId, label: p.projectName }))
  ]);

  protected readonly moduleOptions = computed<SelectOption[]>(() => {
    const scoped = this.projectFilter() ? this.projects().filter((p) => p.projectId === this.projectFilter()) : this.projects();
    const showProject = scoped.length > 1;
    return [
      { value: '', label: 'All modules' },
      ...scoped.flatMap((p) =>
        p.modules.map((m) => ({
          value: m.objectiveId,
          label: `${'– '.repeat(m.depth)}${m.title}${showProject && m.depth === 0 ? ` (${p.projectName})` : ''}`
        }))
      )
    ];
  });

  // ---- Client-side views of the summary ----

  private readonly scopedProjects = computed(() => {
    const project = this.selectedProject();
    return project ? [project] : this.projects();
  });

  /** Ids of the selected module and every module below it. */
  private readonly selectedSubtree = computed<Set<string> | null>(() => {
    const sel = this.selectedModule();
    if (!sel) return null;
    const ids = new Set<string>();
    const start = sel.project.modules.findIndex((m) => m.objectiveId === sel.module.objectiveId);
    for (let i = start; i < sel.project.modules.length; i++) {
      const m = sel.project.modules[i];
      if (i > start && m.depth <= sel.module.depth) break;
      ids.add(m.objectiveId);
    }
    return ids;
  });

  protected readonly overviewHours = computed<LedHourTotals | null>(() => {
    const summary = this.summary();
    if (!summary) return null;
    return this.selectedModule()?.module.hours ?? this.selectedProject()?.hours ?? summary.hours;
  });

  /** All time: the (filtered) summary. Week / month: the period summary once it has loaded, else null. */
  protected readonly overview = computed<OverviewView | null>(() => {
    if (this.isPeriod()) {
      // Only a loaded summary for the period now selected: never last period's numbers under this label.
      const state = this.periodSummary();
      return state.status === 'ready' && state.data && state.data.period === this.period() ? periodView(state.data, this.periodCaption()) : null;
    }
    const h = this.overviewHours();
    return h ? allTimeView(h) : null;
  });

  protected readonly donutSlices = computed<DonutSlice[]>(() => {
    let cumulative = 0;
    return (this.overview()?.segments ?? []).map((s) => {
      const slice: DonutSlice = { meta: s.meta, dash: `${s.percent} ${100 - s.percent}`, offset: 25 - cumulative };
      cumulative += s.percent;
      return slice;
    });
  });

  /** Panel 2 of the Overview (real data, never a made-up trend): status bars per project, or per
   * module once a project is picked, or per child module once a module is picked. Always all-time. */
  protected readonly breakdown = computed(() => {
    const project = this.selectedProject();
    const sel = this.selectedModule();
    let items: { id: string; label: string; hours: LedHourTotals }[];
    let kind: 'projects' | 'modules';
    if (!project) {
      kind = 'projects';
      items = this.projects().map((p) => ({ id: p.projectId, label: p.projectName, hours: p.hours }));
    } else {
      kind = 'modules';
      const modules = sel
        ? project.modules.filter((m) => this.selectedSubtree()?.has(m.objectiveId) && m.depth === sel.module.depth + 1)
        : project.modules.filter((m) => m.depth === 0);
      const shown = modules.length ? modules : sel ? [sel.module] : [];
      items = shown.map((m) => ({ id: m.objectiveId, label: m.title, hours: m.hours }));
    }
    const sorted = [...items].sort((a, b) => barScale(b.hours) - barScale(a.hours));
    const max = Math.max(0, ...sorted.map((i) => barScale(i.hours)));
    const rows: BreakdownRow[] = sorted.slice(0, BREAKDOWN_ROWS).map((i) => ({
      id: i.id,
      label: i.label,
      total: barScale(i.hours),
      width: max > 0 ? (barScale(i.hours) / max) * 100 : 0,
      segments: statusSegments(i.hours),
      ariaLabel: `${i.label}: ${barLabelOf(i.hours)}`
    }));
    return { kind, title: kind === 'projects' ? 'Status by Project' : 'Status by Module', rows, more: Math.max(0, sorted.length - BREAKDOWN_ROWS) };
  });

  protected readonly modulesAtRisk = computed(() => {
    const summary = this.summary();
    if (!summary) return 0;
    const sel = this.selectedModule();
    if (sel) return sel.module.atRisk ? 1 : 0;
    const project = this.selectedProject();
    return project ? project.modules.filter((m) => m.depth === 0 && m.atRisk).length : summary.modulesAtRisk;
  });

  protected readonly overdueTasks = computed<LedOverdueTask[]>(() => {
    const all = this.summary()?.overdueTasks ?? [];
    const project = this.selectedProject();
    const subtree = this.selectedSubtree();
    return all.filter((t) => (!project || t.projectId === project.projectId) && (!subtree || subtree.has(t.objectiveId)));
  });

  protected readonly overdueTotal = computed(() => this.summary()?.overdueTotal ?? 0);

  protected readonly projectRows = computed(() => this.scopedProjects());

  protected readonly moduleRows = computed<ModuleRow[]>(() => {
    const subtree = this.selectedSubtree();
    return this.scopedProjects().flatMap((p) =>
      p.modules
        .filter((m) => !subtree || subtree.has(m.objectiveId))
        .map((m) => ({
          objectiveId: m.objectiveId,
          projectId: p.projectId,
          projectName: p.projectName,
          title: m.title,
          // Indent relative to the selected module, so a picked child module isn't pushed right.
          depth: m.depth - (this.selectedModule()?.module.depth ?? 0),
          atRisk: m.atRisk,
          hours: m.hours
        }))
    );
  });

  // ---- Server queries ----

  private readonly serverFilters = computed(() => ({
    projectId: this.selectedProject()?.projectId,
    objectiveId: this.selectedModule()?.module.objectiveId
  }));

  /** Null while the dialog is closed or the tab isn't showing: nothing is fetched then. */
  private readonly employeeQuery = computed<LedEmployeeQuery | null>(() => {
    if (!this.open() || this.activeTab() !== 'employees' || !this.summary()) return null;
    return {
      pageNumber: this.employeePage(),
      pageSize: TEAM_PROGRESS_PAGE_SIZE,
      search: this.employeeSearch() || undefined,
      ...this.serverFilters(),
      period: this.periodParam(),
      sort: this.employeeSort(),
      direction: this.employeeDir()
    };
  });

  private readonly overviewEmployeeQuery = computed<LedEmployeeQuery | null>(() => {
    if (!this.open() || this.activeTab() !== 'overview' || !this.summary()) return null;
    return {
      pageNumber: this.overviewEmployeePage(),
      pageSize: TEAM_PROGRESS_OVERVIEW_EMPLOYEES,
      search: this.overviewEmployeeSearch() || undefined,
      ...this.serverFilters(),
      period: this.periodParam(),
      sort: 'totalHours',
      direction: 'desc'
    };
  });

  /** Only for week / month, only while the Overview is showing; narrowed by the project / module filters. */
  private readonly periodQuery = computed<PeriodQuery | null>(() => {
    const period = this.period();
    if (period === 'all' || !this.open() || this.activeTab() !== 'overview' || !this.summary()) return null;
    return { period, filters: this.serverFilters() };
  });

  private fetchPeriod(q: PeriodQuery): Observable<LedPeriodProgress> {
    return this.api.getPeriodProgress(q.period, q.filters);
  }

  private readonly taskQuery = computed<LedTaskQuery | null>(() => {
    if (!this.open() || this.activeTab() !== 'tasks' || !this.summary()) return null;
    return {
      pageNumber: this.taskPage(),
      pageSize: TEAM_PROGRESS_PAGE_SIZE,
      search: this.taskSearch() || undefined,
      status: this.taskStatus() || undefined,
      ...this.serverFilters(),
      period: this.periodParam(),
      employeeId: this.taskEmployee()?.id,
      sort: this.taskSort(),
      direction: this.taskDir()
    };
  });

  private readonly employeeRequests = new Subject<LedEmployeeQuery>();
  private readonly taskRequests = new Subject<LedTaskQuery>();
  private readonly employeeSearchInput = new Subject<string>();
  private readonly taskSearchInput = new Subject<string>();
  /** Query key of the data each tab holds (or is loading); the same key isn't fetched again. */
  private employeeKey: string | null = null;
  private taskKey: string | null = null;
  private readonly overviewEmployeeRequests = new Subject<LedEmployeeQuery>();
  private readonly overviewEmployeeSearchInput = new Subject<string>();
  private overviewEmployeeKey: string | null = null;
  private readonly periodRequests = new Subject<PeriodQuery>();
  private periodKey: string | null = null;
  /** Period summaries by query key, so flipping week / month / filters back and forth doesn't
   * refetch. Dropped when the card hands in a new summary (a refresh). */
  private readonly periodCache = new Map<string, LedPeriodProgress>();
  private periodCacheFor: LedWorkProgressResponse | null = null;

  constructor() {
    this.connect(this.employeeRequests, (q) => this.api.getEmployees(q), this.employees, () => (this.employeeKey = null));
    this.connect(this.taskRequests, (q) => this.api.getTasks(q), this.tasks, () => (this.taskKey = null));
    this.connect(
      this.overviewEmployeeRequests,
      (q) => this.api.getEmployees(q),
      this.overviewEmployees,
      () => (this.overviewEmployeeKey = null)
    );
    this.connect(
      this.periodRequests,
      (q) => {
        // Served from the cache inside the switchMap, so it still cancels an older request in flight.
        const key = JSON.stringify(q);
        const cached = this.periodCache.get(key);
        return cached ? of(cached) : this.fetchPeriod(q).pipe(tap((data) => this.periodCache.set(key, data)));
      },
      this.periodSummary,
      () => (this.periodKey = null)
    );

    this.overviewEmployeeSearchInput
      .pipe(debounceTime(TEAM_PROGRESS_SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.overviewEmployeeSearch.set(term.trim());
        this.overviewEmployeePage.set(1);
      });

    effect(() => {
      const q = this.overviewEmployeeQuery();
      if (!q) return;
      const key = JSON.stringify(q);
      if (key === this.overviewEmployeeKey) return;
      this.overviewEmployeeKey = key;
      untracked(() => this.overviewEmployeeRequests.next(q));
    });
    effect(() => {
      const summary = this.summary();
      const q = this.periodQuery();
      if (summary !== this.periodCacheFor) {
        this.periodCacheFor = summary;
        this.periodCache.clear();
        this.periodKey = null;
      }
      if (!q) return;
      const key = JSON.stringify(q);
      if (key === this.periodKey) return;
      this.periodKey = key;
      untracked(() => this.periodRequests.next(q));
    });

    this.employeeSearchInput
      .pipe(debounceTime(TEAM_PROGRESS_SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.employeeSearch.set(term.trim());
        this.employeePage.set(1);
      });
    this.taskSearchInput
      .pipe(debounceTime(TEAM_PROGRESS_SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => {
        this.taskSearch.set(term.trim());
        this.taskPage.set(1);
      });

    effect(() => {
      const q = this.employeeQuery();
      if (!q) return;
      const key = JSON.stringify(q);
      if (key === this.employeeKey) return;
      this.employeeKey = key;
      untracked(() => this.employeeRequests.next(q));
    });
    effect(() => {
      const q = this.taskQuery();
      if (!q) return;
      const key = JSON.stringify(q);
      if (key === this.taskKey) return;
      this.taskKey = key;
      untracked(() => this.taskRequests.next(q));
    });
  }

  /** switchMap: a newer query cancels the one in flight. A failed query forgets its key so a
   * reopen or Retry fetches it again. */
  private connect<Q, R>(
    requests: Subject<Q>,
    fetch: (q: Q) => Observable<R>,
    state: WritableSignal<RemoteState<R>>,
    forgetKey: () => void
  ): void {
    requests
      .pipe(
        tap(() => state.update((s) => ({ status: 'loading', data: s.data }))),
        switchMap((q) =>
          fetch(q).pipe(
            map((data): RemoteState<R> => ({ status: 'ready', data })),
            catchError(() => {
              forgetKey();
              return of<RemoteState<R>>({ status: 'error', data: null });
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((next) => state.set(next));
  }

  // ---- Handlers ----

  close(): void {
    this.closed.emit();
  }

  selectTab(value: string): void {
    this.activeTab.set(value as TeamProgressTab);
  }

  setProject(projectId: string): void {
    this.projectFilter.set(projectId);
    const sel = this.selectedModule();
    if (projectId && sel && sel.project.projectId !== projectId) this.moduleFilter.set('');
    this.resetPages();
  }

  setModule(objectiveId: string): void {
    this.moduleFilter.set(objectiveId);
    this.resetPages();
  }

  clearFilters(): void {
    this.projectFilter.set('');
    this.moduleFilter.set('');
    this.resetPages();
  }

  /** The card owns the period; it feeds the new value back in, which resets paging. */
  setPeriod(value: string): void {
    const period = value as LedProgressPeriod;
    if (period !== this.period()) this.periodChange.emit(period);
  }

  private resetPages(): void {
    this.employeePage.set(1);
    this.taskPage.set(1);
    this.overviewEmployeePage.set(1);
  }

  onOverviewEmployeeSearch(term: string): void {
    this.overviewEmployeeSearchText.set(term);
    this.overviewEmployeeSearchInput.next(term);
  }

  goToOverviewEmployeePage(page: number): void {
    this.overviewEmployeePage.set(Math.max(1, page));
  }

  retryOverviewEmployees(): void {
    this.overviewEmployeeKey = null;
    const q = this.overviewEmployeeQuery();
    if (q) {
      this.overviewEmployeeKey = JSON.stringify(q);
      this.overviewEmployeeRequests.next(q);
    }
  }

  retryPeriod(): void {
    this.periodKey = null;
    const q = this.periodQuery();
    if (q) {
      this.periodKey = JSON.stringify(q);
      this.periodRequests.next(q);
    }
  }

  /** "View all" under the Overview's status-by-project / module panel. */
  viewAllBreakdown(): void {
    this.activeTab.set(this.breakdown().kind);
  }

  onEmployeeSearch(term: string): void {
    this.employeeSearchText.set(term);
    this.employeeSearchInput.next(term);
  }

  onTaskSearch(term: string): void {
    this.taskSearchText.set(term);
    this.taskSearchInput.next(term);
  }

  sortEmployees(key: string): void {
    const sort = key as LedEmployeeSort;
    if (this.employeeSort() === sort) this.employeeDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.employeeSort.set(sort);
      this.employeeDir.set(sort === 'name' ? 'asc' : 'desc');
    }
    this.employeePage.set(1);
  }

  sortTasks(key: string): void {
    const sort = key as LedTaskSort;
    if (this.taskSort() === sort) this.taskDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.taskSort.set(sort);
      this.taskDir.set(sort === 'title' || sort === 'dueDate' ? 'asc' : 'desc');
    }
    this.taskPage.set(1);
  }

  setTaskStatus(status: TaskStatusFilter): void {
    this.taskStatus.set(status);
    this.taskPage.set(1);
  }

  goToEmployeePage(page: number): void {
    this.employeePage.set(Math.max(1, page));
  }

  goToTaskPage(page: number): void {
    this.taskPage.set(Math.max(1, page));
  }

  retryEmployees(): void {
    this.employeeKey = null;
    const q = this.employeeQuery();
    if (q) {
      this.employeeKey = JSON.stringify(q);
      this.employeeRequests.next(q);
    }
  }

  retryTasks(): void {
    this.taskKey = null;
    const q = this.taskQuery();
    if (q) {
      this.taskKey = JSON.stringify(q);
      this.taskRequests.next(q);
    }
  }

  /** An employee row opens the Tasks tab narrowed to that employee's tasks. */
  showEmployeeTasks(employee: LedEmployeeProgress): void {
    this.taskEmployee.set({ id: employee.employeeId, name: employee.displayName });
    this.taskPage.set(1);
    this.activeTab.set('tasks');
  }

  clearTaskEmployee(): void {
    this.taskEmployee.set(null);
    this.taskPage.set(1);
  }

  openModule(row: { projectId: string; objectiveId: string }): void {
    this.closed.emit();
    void this.router.navigate(['/work', row.projectId, 'milestones', row.objectiveId, 'tree']);
  }

  openTask(task: { taskId: string; projectId: string; objectiveId: string }): void {
    this.closed.emit();
    void this.router.navigate(['/work', task.projectId, 'milestones', task.objectiveId, 'board'], {
      queryParams: { highlightTaskId: task.taskId }
    });
  }

  // ---- Template helpers ----

  segments(hours: LedHourTotals): StatusSegment[] {
    return statusSegments(hours);
  }

  completionOf(hours: LedHourTotals): string {
    return completionLabel(hours);
  }

  barLabel(hours: LedHourTotals): string {
    return barLabelOf(hours);
  }

  /** "AL" for Ann Lee; "?" when there's no name. */
  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  /** "1–5 of 42" for the Overview's compact pager. */
  rangeLabel(page: { pageNumber: number; pageSize: number; totalCount: number; items: readonly unknown[] }): string {
    if (page.totalCount === 0) return '0 of 0';
    const start = (page.pageNumber - 1) * page.pageSize + 1;
    return `${start}–${start + page.items.length - 1} of ${page.totalCount}`;
  }

  taskStatusMeta(status: LedTaskStatus): ProgressStatusMeta {
    return TASK_STATUS_META[status];
  }

  assigneeNames(assignees: readonly { displayName: string }[]): string {
    return assignees.map((a) => a.displayName).join(', ');
  }

  pageLabel(page: { pageNumber: number; totalPages: number; totalCount: number }, noun: string): string {
    const pages = Math.max(1, page.totalPages);
    return `Page ${page.pageNumber} of ${pages} · ${page.totalCount} ${noun}`;
  }
}

/** The bar is sized against the larger of the allocation and the task estimates (as on the card), so
 * an over-tasked module fills the bar and an under-tasked one shows its not-yet-tasked share. */
function barScale(h: LedHourTotals): number {
  return Math.max(h.allocatedHours, h.completedHours + h.inProgressHours + h.notStartedHours);
}

function statusSegments(h: LedHourTotals): StatusSegment[] {
  const scale = barScale(h);
  if (scale <= 0) return [];
  const value: Record<ProgressStatusKey, number> = {
    completed: h.completedHours,
    inProgress: h.inProgressHours,
    notStarted: h.notStartedHours,
    untasked: h.untaskedHours
  };
  return PROGRESS_STATUSES.filter((meta) => value[meta.key] > 0).map((meta) => ({
    meta,
    hours: value[meta.key],
    percent: (value[meta.key] / scale) * 100
  }));
}

/** Completed hours against the allocation (against the task estimates when nothing is allocated). */
function completionLabel(h: LedHourTotals): string {
  const base = h.allocatedHours > 0 ? h.allocatedHours : h.completedHours + h.inProgressHours + h.notStartedHours;
  return formatPercent(h.completedHours, base);
}

function barLabelOf(hours: LedHourTotals): string {
  const parts = statusSegments(hours).map((s) => `${s.meta.label} ${formatHourValue(s.hours)} h`);
  return parts.length ? parts.join(', ') : 'No hours';
}

function chartLabelOf(prefix: string, tiles: readonly OverviewTile[]): string {
  const parts = tiles.map((t) => `${t.meta.label} ${formatHourValue(t.hours)} h (${t.percent})`);
  return `${prefix}: ${parts.join(', ')}`;
}

/** All time: four statuses against the larger of allocation and task estimates (as on the card). */
function allTimeView(h: LedHourTotals): OverviewView {
  const scale = barScale(h);
  const value: Record<ProgressStatusKey, number> = {
    completed: h.completedHours,
    inProgress: h.inProgressHours,
    notStarted: h.notStartedHours,
    untasked: h.untaskedHours
  };
  const tiles = PROGRESS_STATUSES.map((meta) => ({
    meta,
    hours: value[meta.key],
    percent: formatPercent(value[meta.key], scale),
    taskCount: null
  }));
  return {
    tiles,
    segments: statusSegments(h),
    totalHours: h.allocatedHours,
    totalLabel: 'Total allocated',
    taskCount: h.taskCount,
    completion: completionLabel(h),
    overTaskedHours: h.overTaskedHours,
    unestimatedTaskCount: h.unestimatedTaskCount,
    chartLabel: chartLabelOf(`Estimated hours by status, ${formatHourValue(h.allocatedHours)} h allocated`, tiles)
  };
}

/** Week / month: tasks due in the window. Allocations have no date, so there's no "Not yet tasked"
 * and percentages are against the period's own task hours. */
function periodView(p: LedPeriodProgress, caption: string): OverviewView {
  const total = p.totalHours;
  const rows: { key: LedTaskStatus; hours: number; count: number }[] = [
    { key: 'completed', hours: p.completedHours, count: p.completedTaskCount },
    { key: 'inProgress', hours: p.inProgressHours, count: p.inProgressTaskCount },
    { key: 'notStarted', hours: p.notStartedHours, count: p.notStartedTaskCount }
  ];
  const tiles = rows.map((r) => ({ meta: TASK_STATUS_META[r.key], hours: r.hours, percent: formatPercent(r.hours, total), taskCount: r.count }));
  return {
    tiles,
    segments: total > 0 ? tiles.filter((t) => t.hours > 0).map((t) => ({ meta: t.meta, hours: t.hours, percent: (t.hours / total) * 100 })) : [],
    totalHours: total,
    totalLabel: caption,
    taskCount: p.taskCount,
    completion: formatPercent(p.completedHours, total),
    overTaskedHours: 0,
    unestimatedTaskCount: p.unestimatedTaskCount,
    chartLabel: chartLabelOf(`Estimated hours of tasks ${caption.toLowerCase()} by status, ${formatHourValue(total)} h`, tiles)
  };
}
