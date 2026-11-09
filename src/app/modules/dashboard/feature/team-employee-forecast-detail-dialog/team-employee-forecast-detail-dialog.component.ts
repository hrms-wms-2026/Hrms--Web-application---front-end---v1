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
  EmployeeForecastItem,
  EmployeeForecastResponse,
  EmployeeForecastSort,
} from '../../models/team-employee-forecast.model';
import { TeamEmployeeForecastStore } from '../../state/team-employee-forecast.store';
import {
  DashboardDonutComponent,
  DashboardDonutSlice,
} from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { EmployeeForecastRateChartComponent } from '../../ui/employee-forecast-rate-chart/employee-forecast-rate-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import {
  FORECAST_STATUS_META,
  forecastHoursText,
  forecastSlices,
  rateBarPercent,
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
import { employeeForecastExplanation } from '../../utils/team-employee-forecast-format.util';

const csvHours = (h: number): string => h.toFixed(1);
const csvRate = (r: number | null): string => (r === null ? '' : (r * 100).toFixed(1));

/** The employee table as CSV rows (header first), hours in one decimal, rates as percents. */
export function employeeForecastCsv(items: readonly EmployeeForecastItem[]): string[][] {
  const header = [
    '#',
    'Name',
    'Department',
    'Task rate % (4 wk)',
    'Worked h (4 wk)',
    'Task h (4 wk)',
    'Required rate %',
    'Deadline',
    'Remaining h',
    'Predicted h',
    'Overtime h',
    'Status',
    'Modules',
  ];
  return [
    header,
    ...items.map((e, i) => [
      String(i + 1),
      e.name,
      e.department ?? '',
      csvRate(e.conversionRate),
      csvHours(e.workedMinutes / 60),
      csvHours(e.taskMinutes / 60),
      csvRate(e.requiredRate),
      e.deadline?.slice(0, 10) ?? '',
      csvHours(e.remainingHours),
      csvHours(e.predictedHours),
      csvHours(e.overtimeHours),
      FORECAST_STATUS_META[e.status].label,
      e.modules.map((m) => `${m.projectName} › ${m.title}`).join('; '),
    ]),
  ];
}

/**
 * The Employee overtime forecast popup, in the Team Progress popup's shell: KPI tiles, where the remaining hours go
 * (pie + explanation), each person's rate against the rate they need, and every team member in a server-side paged,
 * searchable, filterable table with CSV export. Expanding a person lists the modules they are connected to.
 */
@Component({
  selector: 'app-team-employee-forecast-detail-dialog',
  standalone: true,
  imports: [
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    InputComponent,
    SelectComponent,
    DashboardDonutComponent,
    DonutKeyComponent,
    EmployeeForecastRateChartComponent,
  ],
  templateUrl: './team-employee-forecast-detail-dialog.component.html',
  styleUrl: './team-employee-forecast-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamEmployeeForecastDetailDialogComponent {
  readonly open = input(false);
  /** Opened from a summary card: the section to scroll to (summary, forecast, rates, employees). */
  readonly focusSection = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly store = inject(TeamEmployeeForecastStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly statusOptions = FORECAST_STATUS_OPTIONS;
  protected readonly statusMeta = FORECAST_STATUS_META;
  protected readonly hours = forecastHoursText;
  protected readonly rate = rateText;
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
    return `Can each team member finish their open tasks before the deadline? Predicted from their own task rate over the last 4 weeks${window}.`;
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const t = this.store.data()?.totals;
    if (!t) return [];
    const short = t.teamRate !== null && t.requiredRate !== null && t.teamRate < t.requiredRate;
    return [
      {
        label: 'Remaining',
        value: forecastHoursText(t.remainingHours),
        hint: `open estimated tasks · ${t.people} people`,
        icon: 'clipboard-list',
        tone: 'accent',
        testId: 'efd-tile-remaining',
      },
      {
        label: 'Capacity',
        value: forecastHoursText(t.capacityHours),
        hint: 'working hours to the deadlines',
        icon: 'clock',
        tone: 'neutral',
        testId: 'efd-tile-capacity',
      },
      {
        label: 'Predicted',
        value: forecastHoursText(t.predictedHours),
        hint: 'task hours before the deadlines at the current rates',
        icon: 'trending-up',
        tone: 'success',
        testId: 'efd-tile-predicted',
      },
      {
        label: 'Task rate vs required',
        value: `${rateText(t.teamRate)} / ${rateText(t.requiredRate)}`,
        hint: 'team, last 4 weeks / needed to finish in normal hours',
        icon: 'layers',
        tone: short ? 'warning' : 'success',
        testId: 'efd-tile-rate',
      },
      {
        label: 'Overtime',
        value: forecastHoursText(t.overtimeHours),
        hint: `${t.overtime} need overtime · ${t.raiseRate} need a higher rate`,
        icon: 'alert-triangle',
        tone: t.overtimeHours > 0 ? 'danger' : 'success',
        testId: 'efd-tile-overtime',
      },
    ];
  });

  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() => {
    const t = this.store.data()?.totals;
    return t ? forecastSlices(t) : [];
  });

  protected readonly explanation = computed(() => {
    const t = this.store.data()?.totals;
    return t ? employeeForecastExplanation(t) : '';
  });

  protected readonly page = computed<EmployeeForecastResponse | null>(() => this.store.table());
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

  sortBy(sort: EmployeeForecastSort): void {
    this.store.loadTable({ sort });
  }

  protected ariaSort(sort: EmployeeForecastSort): 'ascending' | 'descending' | null {
    return this.store.tableQuery().sort === sort ? forecastSortDirection(sort) : null;
  }

  goToPage(page: number): void {
    this.store.loadTable({ page: Math.min(Math.max(1, page), this.totalPages()) });
  }

  toggle(employeeId: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  close(): void {
    this.closed.emit();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Every person of the current filter (not just the page) as CSV. */
  exportCsv(): void {
    const data = this.store.data();
    if (!data || this.exporting()) return;
    this.exporting.set(true);
    this.store.fetchAll().subscribe({
      next: (all) => {
        this.exporting.set(false);
        this.downloadFile(
          `employee-overtime-forecast-${data.asOf}.csv`,
          toCsv(employeeForecastCsv(all.items)),
        );
      },
      error: () => this.exporting.set(false),
    });
  }
}
