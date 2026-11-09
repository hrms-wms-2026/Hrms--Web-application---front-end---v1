import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import {
  ModuleForecastItem,
  ModuleForecastResponse,
  ModuleForecastSort,
  ModuleForecastTotals,
} from '../../models/team-module-forecast.model';
import { TeamModuleForecastStore } from '../../state/team-module-forecast.store';
import {
  DashboardDonutComponent,
  DashboardDonutSlice,
} from '../../ui/dashboard-donut/dashboard-donut.component';
import { FORECAST_STATUSES, ForecastStatus } from '../../models/overtime-forecast.model';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { ModuleForecastProjectChartComponent } from '../../ui/module-forecast-project-chart/module-forecast-project-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import {
  FORECAST_STATUS_META,
  forecastHoursText,
  forecastSlices,
  minutesAsHours,
  rateBarPercent,
  overloadLimitText,
  rateText,
  shortDate,
  windowLabel,
} from '../../utils/overtime-forecast-format.util';
import {
  FORECAST_SEARCH_DEBOUNCE_MS,
  FORECAST_STATUS_OPTIONS,
  forecastSortDirection,
  parseForecastStatus,
} from '../../utils/overtime-forecast-table.util';
import { injectPopupSectionFocus } from '../../utils/popup-section-focus.util';
import {
  moduleForecastExplanation,
  moduleRowRateText,
  projectOverloadCounts,
} from '../../utils/team-module-forecast-format.util';

const csvHours = (h: number): string => h.toFixed(1);
const csvRate = (r: number | null): string => (r === null ? '' : (r * 100).toFixed(1));

/** The module table as CSV rows (header first), hours in one decimal, rates as percents. */
export function moduleForecastCsv(items: readonly ModuleForecastItem[]): string[][] {
  const header = [
    '#',
    'Module',
    'Path',
    'Project',
    'Deadline',
    'Working days left',
    'Allocated h',
    'Remaining h',
    'Predicted h',
    'Task rate %',
    'Required rate %',
    "Won't fit h",
    'Status',
    'Team',
  ];
  return [
    header,
    ...items.map((m, i) => [
      String(i + 1),
      m.title,
      m.path,
      m.projectName,
      m.endDate.slice(0, 10),
      String(m.workingDaysLeft),
      csvHours(m.allocatedHours),
      csvHours(m.remainingHours),
      csvHours(m.predictedHours),
      csvRate(m.conversionRate),
      csvRate(m.requiredRate),
      csvHours(m.overtimeHours),
      FORECAST_STATUS_META[m.status].label,
      m.members.map((p) => p.name).join('; '),
    ]),
  ];
}

/**
 * The Module overtime forecast popup, in the Team Progress popup's shell: KPI tiles, where the remaining hours go
 * (pie + plain-words explanation), the project chart, and every module in a server-side paged, searchable,
 * filterable table with CSV export. Expanding a module lists its team members with their own task rate.
 */
@Component({
  selector: 'app-team-module-forecast-detail-dialog',
  standalone: true,
  imports: [
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    InputComponent,
    SelectComponent,
    DashboardDonutComponent,
    DonutKeyComponent,
    ModuleForecastProjectChartComponent,
  ],
  templateUrl: './team-module-forecast-detail-dialog.component.html',
  styleUrl: './team-module-forecast-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamModuleForecastDetailDialogComponent {
  readonly open = input(false);
  /** Opened from a summary card: the section to scroll to (summary, forecast, projects, modules). */
  readonly focusSection = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly store = inject(TeamModuleForecastStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly statusOptions = FORECAST_STATUS_OPTIONS;
  protected readonly statusMeta = FORECAST_STATUS_META;
  protected readonly hours = forecastHoursText;
  protected readonly memberHours = minutesAsHours;
  protected readonly rate = rateText;
  protected readonly rowRate = (m: ModuleForecastItem, t: ModuleForecastTotals): string =>
    moduleRowRateText(m, t);
  protected readonly bar = rateBarPercent;
  protected readonly date = shortDate;
  protected readonly donutPx = DASHBOARD_DONUT_PX;

  protected readonly search = signal('');
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  protected readonly exporting = signal(false);
  protected readonly hovered = signal<string | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    injectPopupSectionFocus(this.open, this.focusSection);
    // Each opening reloads the table page it was left on.
    effect(() => {
      if (this.open()) untracked(() => this.store.loadTable());
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
  }

  protected readonly subtitle = computed(() => {
    const data = this.store.data();
    const window = data ? ` (${windowLabel(data.windowStart, data.windowEnd)})` : '';
    return `Can each module finish its remaining hours before the deadline? Predicted from the module team's task rate over the last 4 weeks${window}. ${data ? overloadLimitText(data.totals.maxTaskRate) : ''}`.trim();
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const t = this.store.data()?.totals;
    if (!t) return [];
    const short = t.teamRate !== null && t.requiredRate !== null && t.teamRate < t.requiredRate;
    return [
      {
        label: 'Allocated',
        value: forecastHoursText(t.allocatedHours),
        hint: `${forecastHoursText(t.completedHours)} completed · ${t.modules} modules`,
        icon: 'clipboard-list',
        tone: 'accent',
        testId: 'mfd-tile-allocated',
      },
      {
        label: 'Remaining',
        value: forecastHoursText(t.remainingHours),
        hint: `${forecastHoursText(t.capacityHours)} working capacity left`,
        icon: 'clock',
        tone: 'neutral',
        testId: 'mfd-tile-remaining',
      },
      {
        label: 'Predicted',
        value: forecastHoursText(t.predictedHours),
        hint: 'task hours before the deadlines at the current rate',
        icon: 'trending-up',
        tone: 'success',
        testId: 'mfd-tile-predicted',
      },
      {
        label: 'Task rate vs required',
        value: `${rateText(t.teamRate)} / ${rateText(t.requiredRate)}`,
        hint: 'last 4 weeks / needed to finish in normal hours',
        icon: 'layers',
        tone: short ? 'warning' : 'success',
        testId: 'mfd-tile-rate',
      },
      {
        label: "Won't fit at today's rate",
        value: forecastHoursText(t.overtimeHours),
        hint: `${t.overload} in overload · ${t.raiseRate} at overtime risk`,
        icon: 'alert-triangle',
        tone: t.overtimeHours > 0 ? 'danger' : 'success',
        testId: 'mfd-tile-overtime',
      },
    ];
  });

  /** The status counts beside the tiles: On track / Overtime risk / Overload / No history. */
  protected readonly statusCounts = computed(() => {
    const t = this.store.data()?.totals;
    if (!t) return [];
    const count: Record<ForecastStatus, number> = {
      on_track: t.onTrack,
      raise_rate: t.raiseRate,
      overload: t.overload,
      no_history: t.noHistory,
    };
    return FORECAST_STATUSES.map((s) => ({
      key: s,
      label: FORECAST_STATUS_META[s].label,
      count: count[s],
      color: FORECAST_STATUS_META[s].color,
    }));
  });

  /** Modules in overload per project, for the chart's badges. */
  protected readonly overloadCounts = computed(() => {
    const data = this.store.data();
    return data ? projectOverloadCounts(data.projects, data.items) : {};
  });

  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() => {
    const t = this.store.data()?.totals;
    return t ? forecastSlices(t, t.maxTaskRate) : [];
  });

  protected readonly explanation = computed(() => {
    const t = this.store.data()?.totals;
    return t ? moduleForecastExplanation(t) : '';
  });

  /** The table's current page (null until the first table read lands). */
  protected readonly page = computed<ModuleForecastResponse | null>(() => this.store.table());
  protected readonly offset = computed(() => {
    const p = this.page();
    return p ? (p.page - 1) * p.pageSize : 0;
  });
  protected readonly totalPages = computed(() => {
    const p = this.page();
    return p ? Math.max(1, Math.ceil(p.total / p.pageSize)) : 1;
  });

  onSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.store.loadTable({ search: value.trim() });
    }, FORECAST_SEARCH_DEBOUNCE_MS);
  }

  onStatus(value: string): void {
    this.store.loadTable({ status: parseForecastStatus(value) });
  }

  sortBy(sort: ModuleForecastSort): void {
    this.store.loadTable({ sort });
  }

  protected ariaSort(sort: ModuleForecastSort): 'ascending' | 'descending' | null {
    return this.store.tableQuery().sort === sort ? forecastSortDirection(sort) : null;
  }

  goToPage(page: number): void {
    this.store.loadTable({ page: Math.min(Math.max(1, page), this.totalPages()) });
  }

  toggle(moduleId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  close(): void {
    this.closed.emit();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Every module of the current filter (not just the page) as CSV. */
  exportCsv(): void {
    const data = this.store.data();
    if (!data || this.exporting()) return;
    this.exporting.set(true);
    this.store.fetchAll().subscribe({
      next: (all) => {
        this.exporting.set(false);
        this.downloadFile(
          `module-overtime-forecast-${data.asOf}.csv`,
          toCsv(moduleForecastCsv(all.items)),
        );
      },
      error: () => this.exporting.set(false),
    });
  }
}
