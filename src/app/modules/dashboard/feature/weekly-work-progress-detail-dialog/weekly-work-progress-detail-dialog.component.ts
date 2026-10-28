import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { WeeklyWorkProgressApiService } from '../../data-access/weekly-work-progress-api.service';
import { WeeklyWorkProgressResponse } from '../../models/weekly-work-progress.model';
import { DailyWorkChartComponent } from '../../ui/daily-work-chart/daily-work-chart.component';
import { formatMinutes } from '../../util/timeline-segments.util';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import { WeeklyInsight, buildWeeklyInsights, progressDeltaPoints } from '../../utils/weekly-work-progress-insights.util';
import {
  WEEKLY_STATUS_LABELS,
  WeeklyDelta,
  changeAgainst,
  mondayBefore,
  weeklyTiles
} from '../../utils/weekly-work-progress-format.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = { worked: '#22c55e', notWorked: '#f59e0b', scheduled: '#3b82f6', completed: '#22c55e', inProgress: '#3b82f6', notStarted: '#f59e0b' };

/** "Oct 26 – Nov 1, 2026", or with both years when the week spans New Year. */
export function weekRangeLabel(weekStart: string, weekEnd: string): string {
  const [ys, ms, ds] = weekStart.split('-').map(Number);
  const [ye, me, de] = weekEnd.split('-').map(Number);
  const start = `${MONTHS[ms - 1]} ${ds}`;
  const end = `${MONTHS[me - 1]} ${de}, ${ye}`;
  return ys === ye ? `${start} – ${end}` : `${start}, ${ys} – ${end}`;
}

interface LegendRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly share: string;
  readonly color: string;
}

/**
 * The Weekly Work Progress popup: the full week (KPI tiles, Daily Work vs Schedule, schedule adherence, last week
 * comparison, task weightage and key insights), with a This week / Last week switch. Same shell as the Team Progress
 * and Team Attendance popups.
 */
@Component({
  selector: 'app-weekly-work-progress-detail-dialog',
  standalone: true,
  imports: [ModalComponent, KpiTilesComponent, SelectComponent, DailyWorkChartComponent],
  templateUrl: './weekly-work-progress-detail-dialog.component.html',
  styleUrl: './weekly-work-progress-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WeeklyWorkProgressDetailDialogComponent {
  readonly open = input(false);
  /** The current week, as the card has it. */
  readonly initial = input.required<WeeklyWorkProgressResponse>();
  readonly closed = output<void>();

  private readonly api = inject(WeeklyWorkProgressApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedWeek = signal<'this' | 'last'>('this');
  private readonly lastWeek = signal<WeeklyWorkProgressResponse | null>(null);
  protected readonly loadFailed = signal(false);

  protected readonly weekOptions: SelectOption[] = [
    { value: 'this', label: 'This week' },
    { value: 'last', label: 'Last week' }
  ];
  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly statusLabels = WEEKLY_STATUS_LABELS;
  protected readonly formatMinutes = formatMinutes;
  protected readonly colors = COLORS;

  protected readonly data = computed(() => (this.selectedWeek() === 'last' ? this.lastWeek() : null) ?? this.initial());
  protected readonly rangeLabel = computed(() => weekRangeLabel(this.data().weekStart, this.data().weekEnd));
  protected readonly tiles = computed(() => weeklyTiles(this.data().thisWeek, this.data().plannerEnabled));
  protected readonly insights = computed<WeeklyInsight[]>(() => buildWeeklyInsights(this.data()));
  protected readonly ring = computed(() => Math.min(100, Math.max(0, this.data().thisWeek.progressPercent)));

  protected readonly delta = computed<WeeklyDelta | null>(() => {
    const points = progressDeltaPoints(this.data());
    if (points === null) return null;
    const rounded = Math.round(points);
    return { up: rounded >= 0, text: `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)}%` };
  });

  protected readonly workedChange = computed(() =>
    changeAgainst(this.data().thisWeek.workedMinutes, this.data().lastWeek.workedMinutes)
  );

  /** Schedule adherence: of the scheduled time, how much was worked; the centre shows coverage of Expected. */
  protected readonly adherence = computed(() => {
    const w = this.data().thisWeek;
    const worked = Math.min(w.workedMinutes, w.scheduledMinutes);
    const notWorked = Math.max(0, w.scheduledMinutes - w.workedMinutes);
    const arcs: DonutArc[] = donutArcs([
      { key: 'worked', count: worked, color: COLORS.worked },
      { key: 'notWorked', count: notWorked, color: COLORS.notWorked }
    ]);
    return { arcs, coverage: Math.round(w.planningCoveragePercent), worked: w.workedMinutes, scheduled: w.scheduledMinutes, notWorked };
  });

  protected readonly taskTotal = computed(() => {
    const t = this.data().tasks;
    return t.completedHours + t.inProgressHours + t.notStartedHours;
  });

  protected readonly taskArcs = computed(() => {
    const t = this.data().tasks;
    return donutArcs([
      { key: 'completed', count: t.completedHours, color: COLORS.completed },
      { key: 'inProgress', count: t.inProgressHours, color: COLORS.inProgress },
      { key: 'notStarted', count: t.notStartedHours, color: COLORS.notStarted }
    ]);
  });

  protected readonly taskLegend = computed<LegendRow[]>(() => {
    const t = this.data().tasks;
    const total = this.taskTotal();
    const row = (key: string, label: string, hours: number, color: string): LegendRow => ({
      key, label, value: `${hours}h`, share: `(${total > 0 ? Math.round((hours * 100) / total) : 0}%)`, color
    });
    return [
      row('completed', 'Completed', t.completedHours, COLORS.completed),
      row('inProgress', 'In Progress', t.inProgressHours, COLORS.inProgress),
      row('notStarted', 'Not Started', t.notStartedHours, COLORS.notStarted)
    ];
  });

  constructor() {
    // The card refreshes the current week every minute; only a new week (Monday rolled over) makes the cached last
    // week stale. Reloading on every refresh would flash this week while last week is on show.
    let shownWeekStart: string | null = null;
    effect(() => {
      const weekStart = this.initial().weekStart;
      if (weekStart === shownWeekStart) return;
      shownWeekStart = weekStart;
      untracked(() => {
        this.lastWeek.set(null);
        if (this.selectedWeek() === 'last') this.loadLastWeek();
      });
    });
  }

  protected percentText(value: number): string {
    return `${Math.round(value)}%`;
  }

  onWeekSelect(value: string): void {
    const week = value === 'last' ? 'last' : 'this';
    this.selectedWeek.set(week);
    if (week === 'last' && !this.lastWeek()) this.loadLastWeek();
  }

  close(): void {
    this.closed.emit();
  }

  private loadLastWeek(): void {
    this.loadFailed.set(false);
    this.api
      .get(mondayBefore(this.initial().weekStart))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (week) => this.lastWeek.set(week),
        error: () => this.loadFailed.set(true)
      });
  }
}
