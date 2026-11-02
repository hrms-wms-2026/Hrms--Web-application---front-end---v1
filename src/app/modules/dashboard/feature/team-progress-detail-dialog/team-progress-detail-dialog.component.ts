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
import { Observable, Subject, Subscription, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { TeamProgressDetailApiService } from '../../data-access/team-progress-detail-api.service';
import {
  LedHourTotals,
  LedModuleProgress,
  LedOverdueTask,
  LedProjectProgress,
  LedWorkProgressResponse
} from '../../models/my-team-led-progress.model';
import {
  LedEmployeeProgressPage,
  LedEmployeeQuery,
  LedPeriodProgress,
  LedProgressPeriod,
  LedTaskStatus,
  LedTimeProgress,
  LedWeeklyCompletion
} from '../../models/team-progress-detail.model';
import { TeamProgressTimeDetailComponent } from '../../ui/team-progress-time-detail/team-progress-time-detail.component';
import { timePeriodFor } from '../../utils/team-progress-time-format.util';
import { WeeklyCompletionChartComponent } from '../../ui/weekly-completion-chart/weekly-completion-chart.component';
import {
  PROGRESS_STATUSES,
  PROGRESS_STATUS_BY_KEY,
  ProgressStatusKey,
  ProgressStatusMeta,
  formatHourValue,
  formatPercent
} from '../../utils/team-progress-format.util';

export const TEAM_PROGRESS_SEARCH_DEBOUNCE_MS = 300;
/** Rows in the Overview's compact Employee Breakdown. */
export const TEAM_PROGRESS_OVERVIEW_EMPLOYEES = 5;
/** Weeks in the weekly completion chart (current week last). */
export const TEAM_PROGRESS_WEEKS = 10;

type DatedPeriod = Exclude<LedProgressPeriod, 'all'>;

interface ScopeFilters {
  projectId?: string;
  objectiveId?: string;
}

interface PeriodQuery {
  period: DatedPeriod;
  filters: ScopeFilters;
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

interface StatusSegment {
  meta: ProgressStatusMeta;
  hours: number;
  /** Share of the scale (0-100). */
  percent: number;
}

interface DonutSlice {
  meta: ProgressStatusMeta;
  dash: string;
  offset: number;
}

/** Status of one server-backed section. */
interface RemoteState<T> {
  status: 'idle' | 'loading' | 'ready' | 'error';
  data: T | null;
}

const TASK_STATUS_META: Readonly<Record<LedTaskStatus, ProgressStatusMeta>> = {
  completed: PROGRESS_STATUS_BY_KEY.completed,
  inProgress: PROGRESS_STATUS_BY_KEY.inProgress,
  notStarted: PROGRESS_STATUS_BY_KEY.notStarted
};

/**
 * Team Progress detail (Overview only) over the caller's led scope: stat tiles, status distribution,
 * the last 10 weeks of completed task hours, a compact employee breakdown and overdue tasks.
 * The all-time numbers come from the card's summary (filtered client-side); the period summary,
 * the weekly chart and the employee breakdown come from the server, fetched only while the dialog
 * is open and cached until a filter changes (or the card hands in a new summary).
 * Hours are task estimates (weightage), never time worked.
 */
@Component({
  selector: 'app-team-progress-detail-dialog',
  standalone: true,
  imports: [DatePipe, ModalComponent, SelectComponent, EmptyStateComponent, ErrorStateComponent, WeeklyCompletionChartComponent, TeamProgressTimeDetailComponent],
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
  protected readonly weekCount = TEAM_PROGRESS_WEEKS;

  protected readonly periodOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All time' },
    { value: 'month', label: 'This month' },
    { value: 'week', label: 'This week' }
  ];

  protected readonly projectFilter = signal('');
  protected readonly moduleFilter = signal('');

  /** True for This week / This month. */
  protected readonly isPeriod = computed(() => this.period() !== 'all');
  protected readonly periodCaption = computed(() => (this.period() === 'week' ? 'Due this week' : 'Due this month'));
  /** The `period` query param: omitted for All time so the backend keeps its default. */
  private readonly periodParam = computed<LedProgressPeriod | undefined>(() => (this.period() === 'all' ? undefined : this.period()));

  // ---- Employee Breakdown (server, top 5) ----
  protected readonly overviewEmployeeSearchText = signal('');
  private readonly overviewEmployeeSearch = signal('');
  /** Pages reset to 1 whenever the period changes (linkedSignal), in the same change as the period. */
  protected readonly overviewEmployeePage = linkedSignal({ source: this.period, computation: () => 1 });
  protected readonly overviewEmployees = signal<RemoteState<LedEmployeeProgressPage>>({ status: 'idle', data: null });

  // ---- Period summary (server, week / month only) ----
  protected readonly periodSummary = signal<RemoteState<LedPeriodProgress>>({ status: 'idle', data: null });

  // ---- Weekly completion (server, last 10 weeks, never filtered by the period) ----
  protected readonly weekly = signal<RemoteState<LedWeeklyCompletion>>({ status: 'idle', data: null });

  // ---- Planned vs worked (server, the period's week / month - All time reads the week - and the filters) ----
  protected readonly time = signal<RemoteState<LedTimeProgress>>({ status: 'idle', data: null });
  protected readonly timeStatus = computed<'loading' | 'ready' | 'error'>(() => {
    const status = this.time().status;
    return status === 'idle' ? 'loading' : status;
  });
  private timeKey: string | null = null;
  private timeSub: Subscription | null = null;

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

  /** Project breakdown chart: the (filtered) projects, most allocated first. Allocated and completed bars share one scale
   * (the largest allocation, or completion when it is larger); % = completed of allocated, "—" without allocation. */
  protected readonly projectBreakdown = computed(() => {
    const summary = this.summary();
    if (!summary) return [];
    const selected = this.selectedProject();
    const projects = selected ? [selected] : summary.projects;
    const scale = Math.max(1, ...projects.map((p) => Math.max(p.hours.allocatedHours, p.hours.completedHours)));
    const share = (h: number) => Math.round((h * 1000) / scale) / 10;
    return projects
      .map((p) => ({
        id: p.projectId,
        name: p.projectName,
        allocated: p.hours.allocatedHours,
        completed: p.hours.completedHours,
        percent: p.hours.allocatedHours > 0 ? formatPercent(p.hours.completedHours, p.hours.allocatedHours) : '—',
        allocatedShare: share(p.hours.allocatedHours),
        completedShare: share(p.hours.completedHours),
      }))
      .sort((a, b) => b.allocated - a.allocated || a.name.localeCompare(b.name));
  });
  protected readonly projectChartLabel = computed(
    () =>
      'Allocated vs completed hours by project. ' +
      this.projectBreakdown()
        .map((p) => `${p.name}: ${formatHourValue(p.completed)} h completed of ${formatHourValue(p.allocated)} h allocated (${p.percent})`)
        .join('; ')
  );

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

  // ---- Server queries ----

  private readonly serverFilters = computed<ScopeFilters>(() => ({
    projectId: this.selectedProject()?.projectId,
    objectiveId: this.selectedModule()?.module.objectiveId
  }));

  /** Null while the dialog is closed: nothing is fetched then. */
  private readonly overviewEmployeeQuery = computed<LedEmployeeQuery | null>(() => {
    if (!this.open() || !this.summary()) return null;
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

  /** Only for week / month, only while open; narrowed by the project / module filters. */
  private readonly periodQuery = computed<PeriodQuery | null>(() => {
    const period = this.period();
    if (period === 'all' || !this.open() || !this.summary()) return null;
    return { period, filters: this.serverFilters() };
  });

  /** Only while open; narrowed by the project / module filters, never by the period. */
  private readonly weeklyQuery = computed<ScopeFilters | null>(() => {
    if (!this.open() || !this.summary()) return null;
    return this.serverFilters();
  });

  private readonly overviewEmployeeRequests = new Subject<LedEmployeeQuery>();
  private readonly overviewEmployeeSearchInput = new Subject<string>();
  /** Query key of the data each section holds (or is loading); the same key isn't fetched again. */
  private overviewEmployeeKey: string | null = null;
  private readonly periodRequests = new Subject<PeriodQuery>();
  private periodKey: string | null = null;
  private readonly weeklyRequests = new Subject<ScopeFilters>();
  private weeklyKey: string | null = null;
  /** Period summaries and weekly charts by query key, so flipping week / month / filters back and
   * forth doesn't refetch. Dropped when the card hands in a new summary (a refresh). */
  private readonly periodCache = new Map<string, LedPeriodProgress>();
  private readonly weeklyCache = new Map<string, LedWeeklyCompletion>();
  private cacheFor: LedWorkProgressResponse | null = null;

  constructor() {
    // The period select drives both the allocation-period and the time calls.
    effect(() => {
      if (!this.open() || !this.summary()) return;
      const period = timePeriodFor(this.period());
      const filters = this.serverFilters();
      const key = JSON.stringify({ period, filters });
      if (key === this.timeKey) return;
      this.timeKey = key;
      untracked(() => this.loadTime(period, filters));
    });
    inject(DestroyRef).onDestroy(() => this.timeSub?.unsubscribe());

    this.connect(
      this.overviewEmployeeRequests,
      (q) => this.api.getEmployees(q),
      this.overviewEmployees,
      () => (this.overviewEmployeeKey = null)
    );
    this.connect(
      this.periodRequests,
      // Served from the cache inside the switchMap, so it still cancels an older request in flight.
      (q) => cached(this.periodCache, JSON.stringify(q), () => this.api.getPeriodProgress(q.period, q.filters)),
      this.periodSummary,
      () => (this.periodKey = null)
    );
    this.connect(
      this.weeklyRequests,
      (q) => cached(this.weeklyCache, JSON.stringify(q), () => this.api.getWeeklyCompletion(TEAM_PROGRESS_WEEKS, q)),
      this.weekly,
      () => (this.weeklyKey = null)
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
      const period = this.periodQuery();
      const weekly = this.weeklyQuery();
      if (summary !== this.cacheFor) {
        this.cacheFor = summary;
        this.periodCache.clear();
        this.weeklyCache.clear();
        this.periodKey = null;
        this.weeklyKey = null;
      }
      if (period) {
        const key = JSON.stringify(period);
        if (key !== this.periodKey) {
          this.periodKey = key;
          untracked(() => this.periodRequests.next(period));
        }
      }
      if (weekly) {
        const key = JSON.stringify(weekly);
        if (key !== this.weeklyKey) {
          this.weeklyKey = key;
          untracked(() => this.weeklyRequests.next(weekly));
        }
      }
    });
  }

  /** switchMap: a newer query cancels the one in flight. A failed query forgets its key so a
   * reopen or Retry fetches it again. */
  retryTime(): void {
    const period = timePeriodFor(this.period());
    this.loadTime(period, this.serverFilters());
  }

  private loadTime(period: 'week' | 'month', filters: ScopeFilters): void {
    this.timeSub?.unsubscribe();
    this.time.set({ status: 'loading', data: null });
    this.timeSub = this.api.getTimeProgress(period, filters).subscribe({
      next: (data) => this.time.set({ status: 'ready', data }),
      error: () => {
        this.timeKey = null;
        this.time.set({ status: 'error', data: null });
      }
    });
  }

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

  setProject(projectId: string): void {
    this.projectFilter.set(projectId);
    const sel = this.selectedModule();
    if (projectId && sel && sel.project.projectId !== projectId) this.moduleFilter.set('');
    this.overviewEmployeePage.set(1);
  }

  setModule(objectiveId: string): void {
    this.moduleFilter.set(objectiveId);
    this.overviewEmployeePage.set(1);
  }

  clearFilters(): void {
    this.projectFilter.set('');
    this.moduleFilter.set('');
    this.overviewEmployeePage.set(1);
  }

  /** The card owns the period; it feeds the new value back in, which resets paging. */
  setPeriod(value: string): void {
    const period = value as LedProgressPeriod;
    if (period !== this.period()) this.periodChange.emit(period);
  }

  onOverviewEmployeeSearch(term: string): void {
    this.overviewEmployeeSearchText.set(term);
    this.overviewEmployeeSearchInput.next(term);
  }

  goToOverviewEmployeePage(page: number): void {
    this.overviewEmployeePage.set(Math.max(1, page));
  }

  retryOverviewEmployees(): void {
    const q = this.overviewEmployeeQuery();
    if (q) {
      this.overviewEmployeeKey = JSON.stringify(q);
      this.overviewEmployeeRequests.next(q);
    }
  }

  retryPeriod(): void {
    const q = this.periodQuery();
    if (q) {
      this.periodKey = JSON.stringify(q);
      this.periodRequests.next(q);
    }
  }

  retryWeekly(): void {
    const q = this.weeklyQuery();
    if (q) {
      this.weeklyKey = JSON.stringify(q);
      this.weeklyRequests.next(q);
    }
  }

  /** An overdue task opens its module's board with the task highlighted. */
  openTask(task: { taskId: string; projectId: string; objectiveId: string }): void {
    this.closed.emit();
    void this.router.navigate(['/work', task.projectId, 'milestones', task.objectiveId, 'board'], {
      queryParams: { highlightTaskId: task.taskId }
    });
  }

  // ---- Template helpers ----

  /** "AL" for Ann Lee; "?" when there's no name. */
  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  /** "1–5 of 42" for the Employee Breakdown's compact pager. */
  rangeLabel(page: { pageNumber: number; pageSize: number; totalCount: number; items: readonly unknown[] }): string {
    if (page.totalCount === 0) return '0 of 0';
    const start = (page.pageNumber - 1) * page.pageSize + 1;
    return `${start}–${start + page.items.length - 1} of ${page.totalCount}`;
  }

  assigneeNames(assignees: readonly { displayName: string }[]): string {
    return assignees.map((a) => a.displayName).join(', ');
  }
}

/** Serves a cached response, or fetches and caches it. */
function cached<T>(cache: Map<string, T>, key: string, fetch: () => Observable<T>): Observable<T> {
  const hit = cache.get(key);
  return hit ? of(hit) : fetch().pipe(tap((data) => cache.set(key, data)));
}

/** The donut is sized against the larger of the allocation and the task estimates (as on the card), so
 * an over-tasked scope fills it and an under-tasked one shows its not-yet-tasked share. */
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
