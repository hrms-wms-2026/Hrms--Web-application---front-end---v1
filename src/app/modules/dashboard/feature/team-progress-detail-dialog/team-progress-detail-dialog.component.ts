import { ProjectHoursChartComponent } from '../../ui/project-hours-chart/project-hours-chart.component';
import { orderProjectsForChart } from '../../utils/project-hours-chart.util';
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
import { injectPopupSectionFocus } from '../../utils/popup-section-focus.util';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
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
  LedEmployeeSort,
  LedPeriodProgress,
  LedProgressPeriod,
  LedTaskStatus,
  LedTimeProgress,
  LedWeeklyCompletion
} from '../../models/team-progress-detail.model';
import { hoursText, timePeriodFor } from '../../utils/team-progress-time-format.util';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { WeeklyCompletionChartComponent } from '../../ui/weekly-completion-chart/weekly-completion-chart.component';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
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

/** Team members bar list tabs: the server sort fields with hours. */
/** The members tabs sort by an hour column; 'completionRate' is the summary card's ranking, not a tab. */
type MemberTab = Exclude<LedEmployeeSort, 'name' | 'completionRate'>;

/** Weekly completion request: no period = the last 10 weeks. */
interface WeeklyQuery {
  filters: ScopeFilters;
  period?: DatedPeriod;
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

/** One Status Distribution part: a status, or Overdue carved out of In progress / Not started. */
interface DonutPart {
  key: string;
  label: string;
  color: string;
  bgClass: string;
  hours: number;
  percent: string;
  dash: string;
  offset: number;
}

const OVERDUE_PART = { key: 'overdue', label: 'Overdue', color: '#ef4444', bgClass: 'bg-red-500' } as const;

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
/** The overdue pie's project colours (cycled past the sixth project). */
const OVERDUE_PIE_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981', '#64748b'];

interface OverdueHoursView {
  readonly total: number;
  /** Overdue tasks in scope (the listed ones with a module filter). */
  readonly taskCount: number;
  readonly unestimated: number;
  /** Module filter: the figures cover only the listed overdue tasks. */
  readonly listedOnly: boolean;
  readonly slices: readonly { projectId: string; name: string; hours: number; color: string; percent: string }[];
  readonly arcs: readonly DonutArc[];
}

@Component({
  selector: 'app-team-progress-detail-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ModalComponent,
    SelectComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    WeeklyCompletionChartComponent,
    DashboardDonutComponent,
    DonutKeyComponent,
    ProjectHoursChartComponent
  ],
  templateUrl: './team-progress-detail-dialog.component.html',
  styleUrl: './team-progress-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamProgressDetailDialogComponent {
  readonly open = input(false);
  /** Opened from a summary card: the section to scroll to (weekly, projects, overdue, members). */
  readonly focusSection = input<string | null>(null);
  readonly summary = input<LedWorkProgressResponse | null>(null);
  /** Due-date window. The card owns it: the dropdown only emits `periodChange`. */
  readonly period = input<LedProgressPeriod>('all');
  readonly closed = output<void>();
  readonly periodChange = output<LedProgressPeriod>();

  private readonly api = inject(TeamProgressDetailApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly formatHours = formatHourValue;

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
  protected readonly overviewEmployeePage = linkedSignal({ source: () => `${this.period()}|${this.membersTab()}`, computation: () => 1 });
  protected readonly overviewEmployees = signal<RemoteState<LedEmployeeProgressPage>>({ status: 'idle', data: null });

  // ---- Period summary (server, week / month only) ----
  protected readonly periodSummary = signal<RemoteState<LedPeriodProgress>>({ status: 'idle', data: null });

  // ---- Weekly completion (server: last 10 weeks for All time, the days of this week or the weeks of this month) ----
  protected readonly weekly = signal<RemoteState<LedWeeklyCompletion>>({ status: 'idle', data: null });
  /** What the chart's buckets cover. A server without period support (no `granularity`) always sends
   * the last 10 weeks, so the tag says so whatever period is selected. */
  protected readonly weeklyRange = computed(() => {
    const period = this.period();
    if (period === 'all' || !this.weekly().data?.granularity) return `Last ${TEAM_PROGRESS_WEEKS} weeks`;
    return period === 'week' ? 'This week' : 'This month';
  });

  // ---- Planned vs worked (server, the period's week / month - All time reads the week - and the filters) ----
  protected readonly time = signal<RemoteState<LedTimeProgress>>({ status: 'idle', data: null });

  /** Team members table: each person's planned / worked time for the time period, by employee id. */
  protected readonly memberTime = computed(() => new Map((this.time().data?.workload ?? []).map((w) => [w.employeeId, w])));
  protected readonly plannerEnabled = computed(() => this.time().data?.plannerEnabled ?? false);
  protected readonly timePeriodLabel = computed(() => (this.time().data?.period === 'month' ? 'This month' : 'This week'));

  /** Team members: a ranked bar list per person (default) or the full table. */
  protected readonly membersView = signal<'chart' | 'table'>('chart');
  /** The bar list's tab: which hours rank the people (sorted on the server, highest first). */
  protected readonly membersTab = signal<MemberTab>('totalHours');
  protected readonly memberTabs: readonly { key: MemberTab; label: string; color: string }[] = [
    { key: 'totalHours', label: 'Total', color: 'var(--color-info)' },
    { key: 'completedHours', label: PROGRESS_STATUS_BY_KEY.completed.label, color: PROGRESS_STATUS_BY_KEY.completed.color },
    { key: 'inProgressHours', label: PROGRESS_STATUS_BY_KEY.inProgress.label, color: PROGRESS_STATUS_BY_KEY.inProgress.color },
    { key: 'notStartedHours', label: PROGRESS_STATUS_BY_KEY.notStarted.label, color: PROGRESS_STATUS_BY_KEY.notStarted.color }
  ];
  protected readonly memberTabColor = computed(() => this.memberTabs.find((t) => t.key === this.membersTab())?.color ?? 'var(--color-info)');
  /** The page's people: the tab's hours, the bar as a share of the page's largest value. */
  protected readonly memberBars = computed(() => {
    const items = this.overviewEmployees().data?.items ?? [];
    const tab = this.membersTab();
    const scale = Math.max(0, ...items.map((e) => e[tab]));
    return items.map((e) => ({ row: e, hours: e[tab], width: scale > 0 ? (e[tab] / scale) * 100 : 0 }));
  });

  setMembersTab(tab: MemberTab): void {
    this.membersTab.set(tab);
  }

  setMembersView(view: 'chart' | 'table'): void {
    this.membersView.set(view);
  }

  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;
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
      { value: '', label: 'All milestones' },
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
  /** Projects for the chart (the picked one alone when filtered): at-risk first, then the largest allocation. */
  protected readonly chartProjects = computed(() => {
    const summary = this.summary();
    if (!summary) return [];
    const selected = this.selectedProject();
    return orderProjectsForChart(selected ? [selected] : summary.projects);
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

  /** All time: overdue hours (as of today) in the filtered scope, split like the hour totals. Null for a period view
   * (its tasks are those due in the window) or when the API sends no split. */
  private readonly overdueSplit = computed<{ inProgress: number; notStarted: number } | null>(() => {
    const rows = this.summary()?.overdueByModule;
    if (!rows || this.isPeriod()) return null;
    const project = this.selectedProject();
    const subtree = this.selectedSubtree();
    let inProgress = 0;
    let notStarted = 0;
    for (const r of rows) {
      if ((project && r.projectId !== project.projectId) || (subtree && !subtree.has(r.objectiveId))) continue;
      inProgress += r.inProgressHours;
      notStarted += r.notStartedHours;
    }
    return inProgress + notStarted > 0 ? { inProgress, notStarted } : null;
  });

  /** The donut and its legend. Overdue tasks are open work, so their hours come out of In progress / Not started and
   * show as their own slice: the parts still add up to the total. */
  /** The Status Distribution slice (or legend row) under the pointer: the shared donut lights it. */
  protected readonly hoveredPart = signal<string | null>(null);
  /** The same for the overdue-by-project pie. */
  protected readonly hoveredOverdue = signal<string | null>(null);
  /** The Status Distribution donut: a little larger than the cards' (the popup has the room). */
  protected readonly statusDonutPx = 192;

  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() =>
    this.donutParts().map((p) => ({
      key: p.key,
      label: p.label,
      value: Math.max(0, p.hours),
      valueText: `${formatHourValue(p.hours)} h`,
      percentText: p.percent,
      color: p.color
    }))
  );

  protected overdueSlices(slices: readonly { projectId: string; name: string; hours: number; color: string; percent: string }[]): DashboardDonutSlice[] {
    return slices.map((s) => ({
      key: s.projectId,
      label: s.name,
      value: s.hours,
      valueText: `${formatHourValue(s.hours)} h`,
      percentText: s.percent,
      color: s.color
    }));
  }

  protected readonly donutParts = computed<DonutPart[]>(() => {
    const ov = this.overview();
    if (!ov) return [];
    const od = this.overdueSplit();
    const rows: { key: string; label: string; color: string; bgClass: string; hours: number }[] = [];
    let overdue = 0;
    for (const t of ov.tiles) {
      let hours = t.hours;
      if (od && (t.meta.key === 'inProgress' || t.meta.key === 'notStarted')) {
        const carve = Math.min(hours, t.meta.key === 'inProgress' ? od.inProgress : od.notStarted);
        hours -= carve;
        overdue += carve;
      }
      rows.push({ key: t.meta.key, label: t.meta.label, color: t.meta.color, bgClass: t.meta.bgClass, hours });
      if (t.meta.key === 'notStarted' && overdue > 0) {
        rows.splice(rows.length - 1, 0, { ...OVERDUE_PART, hours: overdue });
      }
    }
    const scale = rows.reduce((sum, r) => sum + r.hours, 0);
    let cumulative = 0;
    return rows.map((r) => {
      const share = scale > 0 ? (r.hours / scale) * 100 : 0;
      const part: DonutPart = { ...r, percent: formatPercent(r.hours, scale), dash: `${share} ${100 - share}`, offset: 25 - cumulative };
      cumulative += share;
      return part;
    });
  });

  protected readonly donutHasOverdue = computed(() => this.donutParts().some((p) => p.key === OVERDUE_PART.key));

  protected readonly donutLabel = computed(() => {
    const ov = this.overview();
    if (!ov) return '';
    if (!this.donutHasOverdue()) return ov.chartLabel;
    const prefix = ov.chartLabel.slice(0, Math.max(0, ov.chartLabel.indexOf(':')));
    return `${prefix}: ${this.donutParts().map((p) => `${p.label} ${formatHourValue(p.hours)} h (${p.percent})`).join(', ')}`;
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

  protected readonly overduePiePx = DASHBOARD_DONUT_PX;

  /** Overdue estimated hours, the pie by project and the unestimated count. Every overdue task (the server totals)
   * with no filter or a project filter; with a module filter only the listed tasks of that subtree are known, so
   * the figures say "of the listed tasks". */
  protected readonly overdueHoursView = computed<OverdueHoursView | null>(() => {
    const summary = this.summary();
    if (!summary) return null;
    let rows: { projectId: string; name: string; hours: number }[];
    let unestimated: number;
    let taskCount: number;
    let listedOnly = false;
    if (this.selectedModule()) {
      const tasks = this.overdueTasks();
      const names = new Map(summary.projects.map((p) => [p.projectId, p.projectName]));
      const byProject = new Map<string, number>();
      for (const t of tasks) byProject.set(t.projectId, (byProject.get(t.projectId) ?? 0) + (t.estimatedHours ?? 0));
      rows = [...byProject].map(([projectId, hours]) => ({ projectId, name: names.get(projectId) ?? 'Unknown project', hours }));
      unestimated = tasks.filter((t) => t.estimatedHours === null).length;
      taskCount = tasks.length;
      listedOnly = true;
    } else {
      const project = this.selectedProject();
      const all = summary.overdueByProject.filter((p) => !project || p.projectId === project.projectId);
      rows = all.map((p) => ({ projectId: p.projectId, name: p.projectName, hours: p.hours }));
      unestimated = all.reduce((sum, p) => sum + p.unestimatedTaskCount, 0);
      taskCount = project ? all.reduce((sum, p) => sum + p.taskCount, 0) : summary.overdueTotal;
    }
    const total = rows.reduce((sum, r) => sum + r.hours, 0);
    const slices = rows
      .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name))
      .map((r, i) => ({ ...r, color: OVERDUE_PIE_COLORS[i % OVERDUE_PIE_COLORS.length], percent: formatPercent(r.hours, total) }));
    const arcs: DonutArc[] = donutArcs(slices.map((s) => ({ key: s.projectId, count: s.hours, color: s.color })));
    return { total, taskCount, unestimated, listedOnly, slices, arcs };
  });

  protected overdueTaskHours(task: LedOverdueTask): string {
    return task.estimatedHours === null ? '—' : `${formatHourValue(task.estimatedHours)} h`;
  }

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
      sort: this.membersTab(),
      direction: 'desc'
    };
  });

  /** Only for week / month, only while open; narrowed by the project / module filters. */
  private readonly periodQuery = computed<PeriodQuery | null>(() => {
    const period = this.period();
    if (period === 'all' || !this.open() || !this.summary()) return null;
    return { period, filters: this.serverFilters() };
  });

  /** Only while open; narrowed by the project / module filters and the period. */
  private readonly weeklyQuery = computed<WeeklyQuery | null>(() => {
    if (!this.open() || !this.summary()) return null;
    const period = this.period();
    return { filters: this.serverFilters(), period: period === 'all' ? undefined : period };
  });

  private readonly overviewEmployeeRequests = new Subject<LedEmployeeQuery>();
  private readonly overviewEmployeeSearchInput = new Subject<string>();
  /** Query key of the data each section holds (or is loading); the same key isn't fetched again. */
  private overviewEmployeeKey: string | null = null;
  private readonly periodRequests = new Subject<PeriodQuery>();
  private periodKey: string | null = null;
  private readonly weeklyRequests = new Subject<WeeklyQuery>();
  private weeklyKey: string | null = null;
  /** Period summaries and weekly charts by query key, so flipping week / month / filters back and
   * forth doesn't refetch. Dropped when the card hands in a new summary (a refresh). */
  private readonly periodCache = new Map<string, LedPeriodProgress>();
  private readonly weeklyCache = new Map<string, LedWeeklyCompletion>();
  private cacheFor: LedWorkProgressResponse | null = null;

  constructor() {
    injectPopupSectionFocus(this.open, this.focusSection);
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
    inject(DestroyRef).onDestroy(() => {
      this.timeSub?.unsubscribe();
    });

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
      (q) => cached(this.weeklyCache, JSON.stringify(q), () => this.api.getWeeklyCompletion(TEAM_PROGRESS_WEEKS, q.filters, q.period)),
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
  protected timeHours(minutes: number): string {
    return hoursText(minutes);
  }

  /** Every person with time in the period (the whole team, ranked by planned then worked), with their estimate hours
   * when they are on the Team members page shown. */
  exportMembers(): void {
    const t = this.time().data;
    if (!t) return;
    const estimates = new Map((this.overviewEmployees().data?.items ?? []).map((e) => [e.employeeId, e]));
    const n = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
    const header = ['Rank', 'Person', 'Completed h', 'In progress h', 'Not started h', 'Total h', 'Planned min', 'Worked min', 'Unscheduled min', 'Expected min', 'Capacity used %'];
    const lines = t.workload.map((w) => {
      const e = estimates.get(w.employeeId);
      return [String(w.rank), w.displayName, n(e?.completedHours), n(e?.inProgressHours), n(e?.notStartedHours), n(e?.totalHours),
        String(w.plannedMinutes), String(w.clockedMinutes), String(w.unscheduledMinutes), n(w.expectedMinutes), n(w.utilizationPercent)];
    });
    this.downloadFile(`team-members-${t.from}_${t.to}.csv`, toCsv([header, ...lines]));
  }

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
