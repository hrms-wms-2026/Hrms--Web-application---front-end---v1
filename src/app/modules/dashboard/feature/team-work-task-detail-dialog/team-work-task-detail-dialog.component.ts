import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { TeamWorkTaskEmployeeRow } from '../../models/team-work-task.model';
import { TeamWorkTaskStore } from '../../state/team-work-task.store';
import { WorkTaskDayChartComponent } from '../../ui/work-task-day-chart/work-task-day-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DashboardBarChip } from '../../ui/dashboard-bar-chart/dashboard-bar-chart.component';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import {
  TEAM_WORK_TASK_COLORS,
  hoursText,
  teamWorkTaskDelta,
  teamWorkTaskRangeLabel,
  teamWorkTaskSlices,
  utilizationText,
} from '../../utils/team-work-task-format.util';

export type WorkTaskSortKey = 'rank' | 'name' | 'worked' | 'break' | 'task' | 'gap' | 'completed';

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** Worked minus task time: positive = working time not covered by completed estimates. */
export function gapMinutes(row: { workedMinutes: number; taskMinutes: number }): number {
  return row.workedMinutes - row.taskMinutes;
}

/** Rows ordered by a column. Rank sorts unranked people last; every other column breaks ties by name. */
export function sortWorkTaskRows(
  rows: readonly TeamWorkTaskEmployeeRow[],
  key: WorkTaskSortKey,
  descending: boolean,
): TeamWorkTaskEmployeeRow[] {
  const value = (r: TeamWorkTaskEmployeeRow): number | string => {
    switch (key) {
      case 'rank':
        return r.rank ?? Number.MAX_SAFE_INTEGER;
      case 'name':
        return r.name.toLowerCase();
      case 'worked':
        return r.workedMinutes;
      case 'break':
        return r.breakMinutes;
      case 'task':
        return r.taskMinutes;
      case 'gap':
        return gapMinutes(r);
      case 'completed':
        return r.completedTasks;
    }
  };
  const dir = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return a.name.localeCompare(b.name);
  });
}

/**
 * The Work vs task hours popup, in the Team Progress popup's shell: the selected day, week or month in full. KPI
 * tiles, the daily work-vs-task bar chart, the time-split pie with an explanation, and every team member in a
 * sortable, searchable table with CSV export. Period and anchor are the card's store state, so opening and closing
 * never resets them.
 */
@Component({
  selector: 'app-team-work-task-detail-dialog',
  standalone: true,
  imports: [
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    InputComponent,
    SelectComponent,
    WorkTaskDayChartComponent,
    DashboardDonutComponent,
    DonutKeyComponent,
  ],
  templateUrl: './team-work-task-detail-dialog.component.html',
  styleUrl: './team-work-task-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamWorkTaskDetailDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly store = inject(TeamWorkTaskStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly periodOptions = PERIOD_OPTIONS;
  protected readonly colors = TEAM_WORK_TASK_COLORS;
  protected readonly hours = hoursText;
  protected readonly util = utilizationText;
  protected readonly gap = gapMinutes;

  protected readonly search = signal('');
  protected readonly sortKey = signal<WorkTaskSortKey>('rank');
  protected readonly sortDesc = signal(false);

  protected readonly rangeLabel = computed(() => {
    const data = this.store.data();
    return data ? teamWorkTaskRangeLabel(data.period, data.rangeStart, data.rangeEnd) : '';
  });

  /** The change against the previous period, as the chart headline's pill. */
  protected readonly deltaChip = computed<DashboardBarChip | null>(() => {
    const d = this.delta();
    return d ? { text: d.text, tone: d.down ? 'down' : 'up' } : null;
  });

  protected readonly delta = computed(() => {
    const data = this.store.data();
    return data
      ? teamWorkTaskDelta(data.totals.utilization, data.previous.utilization, data.period)
      : null;
  });

  protected readonly chartTitle = computed(() =>
    this.store.data()?.period === 'day' ? 'Work vs task by day · this week' : 'Work vs task by day',
  );

  protected readonly tiles = computed<KpiTile[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const t = data.totals;
    const p = data.previous;
    const people = data.employees.filter((e) => e.workedMinutes > 0).length;
    const delta = this.delta();
    return [
      {
        label: 'Working time',
        value: hoursText(t.workedMinutes),
        hint: `${people} of ${data.teamSize} people clocked · was ${hoursText(p.workedMinutes)}`,
        icon: 'clock',
        tone: 'accent',
        testId: 'wtd-tile-worked',
      },
      {
        label: 'Task hours',
        value: hoursText(t.taskMinutes),
        hint: `estimates of completed tasks · was ${hoursText(p.taskMinutes)}`,
        icon: 'check-circle',
        tone: 'success',
        testId: 'wtd-tile-task',
      },
      {
        label: 'Task share of work',
        value: utilizationText(t.utilization),
        hint: delta?.text ?? 'no earlier figure to compare',
        icon: 'layers',
        tone: t.utilization !== null && t.utilization < 50 ? 'warning' : 'success',
        testId: 'wtd-tile-utilization',
      },
      {
        label: 'Break',
        value: hoursText(t.breakMinutes),
        hint: 'not counted as working time',
        icon: 'clock',
        tone: 'neutral',
        testId: 'wtd-tile-break',
      },
      {
        label: 'Tasks completed',
        value: t.completedTasks,
        hint:
          t.unestimatedTasks > 0
            ? `${t.unestimatedTasks} without an estimate (count 0h)`
            : 'all estimated',
        icon: 'clipboard-list',
        tone: t.unestimatedTasks > 0 ? 'warning' : 'neutral',
        testId: 'wtd-tile-completed',
      },
    ];
  });

  protected readonly slices = computed(() => {
    const data = this.store.data();
    return data ? teamWorkTaskSlices(data.totals) : [];
  });

  /** The pie and its key: task, other work and break time, each with its share. */
  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() =>
    this.slices().map((s) => ({
      key: s.key,
      label: s.label,
      value: s.minutes,
      valueText: hoursText(s.minutes),
      percentText: `${s.percent}%`,
      color: s.color,
    })),
  );
  protected readonly totalMinutes = computed(() => this.slices().reduce((sum, s) => sum + s.minutes, 0));
  /** The slice the pie lights (hovered there or on a key row). */
  protected readonly hovered = signal<string | null>(null);
  /** The popup's pie: the dashboard donut size. */
  protected readonly donutPx = DASHBOARD_DONUT_PX;

  /** Plain-words reading of the pie, so the numbers explain themselves. */
  protected readonly explanation = computed(() => {
    const t = this.store.data()?.totals;
    if (!t) return '';
    if (t.workedMinutes === 0)
      return 'Nobody clocked working time in this period, so there is nothing to compare yet.';
    const over = t.taskMinutes - t.workedMinutes;
    if (over > 0)
      return `Completed task estimates (${hoursText(t.taskMinutes)}) are ${hoursText(over)} more than the time worked (${hoursText(t.workedMinutes)}): tasks were finished faster than estimated, or worked on in an earlier period.`;
    return `Of ${hoursText(t.workedMinutes)} worked, ${hoursText(t.taskMinutes)} is covered by completed tasks. The other ${hoursText(t.workedMinutes - t.taskMinutes)} went to tasks still in progress, meetings or other work.`;
  });

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.store.data()?.employees ?? [];
    const filtered = term
      ? all.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            (r.department ?? '').toLowerCase().includes(term),
        )
      : all;
    return sortWorkTaskRows(filtered, this.sortKey(), this.sortDesc());
  });

  onPeriodSelect(value: string): void {
    if (value === 'day' || value === 'week' || value === 'month') this.store.setPeriod(value);
  }

  shift(step: -1 | 1): void {
    this.store.shift(step);
  }

  onSearch(value: string): void {
    this.search.set(value);
  }

  /** Clicking the sorted column flips its direction; a new column starts high-to-low (names and rank: A-Z / 1-n). */
  sortBy(key: WorkTaskSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((d) => !d);
      return;
    }
    this.sortKey.set(key);
    this.sortDesc.set(key !== 'name' && key !== 'rank');
  }

  protected ariaSort(key: WorkTaskSortKey): 'ascending' | 'descending' | null {
    if (this.sortKey() !== key) return null;
    return this.sortDesc() ? 'descending' : 'ascending';
  }

  close(): void {
    this.closed.emit();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected barWidth(value: number | null): number {
    return value === null ? 0 : Math.min(100, Math.max(0, value));
  }

  /** The shown rows (search and sort applied) as CSV, hours in decimals, with spreadsheet-formula escaping. */
  exportCsv(): void {
    const data = this.store.data();
    if (!data) return;
    const h = (minutes: number) => (minutes / 60).toFixed(2);
    const header = [
      'Rank',
      'Name',
      'Department',
      'Worked h',
      'Break h',
      'Task h',
      'Gap h',
      'Tasks completed',
      'Without estimate',
      'Task share %',
    ];
    const lines = this.rows().map((r) => [
      r.rank === null ? '' : String(r.rank),
      r.name,
      r.department ?? '',
      h(r.workedMinutes),
      h(r.breakMinutes),
      h(r.taskMinutes),
      h(gapMinutes(r)),
      String(r.completedTasks),
      String(r.unestimatedTasks),
      r.utilization === null ? '' : String(r.utilization),
    ]);
    this.downloadFile(
      `work-vs-task-${data.rangeStart}_${data.rangeEnd}.csv`,
      toCsv([header, ...lines]),
    );
  }
}
