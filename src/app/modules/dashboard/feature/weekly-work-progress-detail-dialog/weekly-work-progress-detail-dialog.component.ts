import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { WeeklyWorkProgressApiService } from '../../data-access/weekly-work-progress-api.service';
import { WeeklyWorkProgressResponse } from '../../models/weekly-work-progress.model';
import { DailyWorkChartComponent } from '../../ui/daily-work-chart/daily-work-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { WeeklyInsight, buildWeeklyInsights, progressDeltaPoints } from '../../utils/weekly-work-progress-insights.util';
import { WIDGET } from '../../utils/widget-palette';
import {
  WEEKLY_STATUS_LABELS,
  WeeklyDelta,
  changeAgainst,
  deltaOf,
  formatWeekHours,
  mondayBefore,
  weeklyTiles
} from '../../utils/weekly-work-progress-format.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COLORS = { worked: 'var(--color-widget-shade-1)', notWorked: 'var(--color-widget-shade-3)', scheduled: 'var(--color-widget-shade-2)', completed: 'var(--color-widget-shade-1)', inProgress: 'var(--color-widget-shade-2)', notStarted: 'var(--color-widget-shade-3)' };

/** "Oct 26 – Nov 1, 2026", or with both years when the week spans New Year. */
export function weekRangeLabel(weekStart: string, weekEnd: string): string {
  const [ys, ms, ds] = weekStart.split('-').map(Number);
  const [ye, me, de] = weekEnd.split('-').map(Number);
  const start = `${MONTHS[ms - 1]} ${ds}`;
  const end = `${MONTHS[me - 1]} ${de}, ${ye}`;
  return ys === ye ? `${start} – ${end}` : `${start}, ${ys} – ${end}`;
}

/**
 * The Weekly Work Progress popup: the full week (KPI tiles, Daily Work vs Schedule, schedule adherence, last week
 * comparison, task weightage and key insights), with a This week / Last week switch. Same shell as the Team Progress
 * and Team Attendance popups.
 */
@Component({
  selector: 'app-weekly-work-progress-detail-dialog',
  standalone: true,
  imports: [ModalComponent, KpiTilesComponent, SelectComponent, DailyWorkChartComponent, DashboardDonutComponent, DonutKeyComponent],
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
  protected readonly formatMinutes = formatWeekHours;
  protected readonly colors = COLORS;

  protected readonly data = computed(() => (this.selectedWeek() === 'last' ? this.lastWeek() : null) ?? this.initial());
  protected readonly rangeLabel = computed(() => weekRangeLabel(this.data().weekStart, this.data().weekEnd));
  protected readonly tiles = computed(() => weeklyTiles(this.data().thisWeek, this.data().plannerEnabled));
  protected readonly insights = computed<WeeklyInsight[]>(() => buildWeeklyInsights(this.data()));
  protected readonly ring = computed(() => Math.min(100, Math.max(0, this.data().thisWeek.progressPercent)));

  protected readonly delta = computed<WeeklyDelta | null>(() => {
    const points = progressDeltaPoints(this.data());
    if (points === null) return null;
    return deltaOf(Math.round(points));
  });

  protected readonly workedChange = computed(() =>
    changeAgainst(this.data().thisWeek.workedMinutes, this.data().lastWeek.workedMinutes)
  );

  /** Schedule adherence: of the scheduled time, how much was worked; the centre shows coverage of Expected. */
  protected readonly adherence = computed(() => {
    const w = this.data().thisWeek;
    const notWorked = Math.max(0, w.scheduledMinutes - w.workedMinutes);
    return { coverage: Math.round(w.planningCoveragePercent), worked: w.workedMinutes, scheduled: w.scheduledMinutes, notWorked };
  });

  protected readonly taskTotal = computed(() => {
    const t = this.data().tasks;
    return t.completedHours + t.inProgressHours + t.notStartedHours;
  });

  /** The task donut and its key: completed, in progress and not started estimate hours, each with its share. */
  protected readonly taskSlices = computed<DashboardDonutSlice[]>(() => {
    const t = this.data().tasks;
    const slice = (key: string, label: string, hours: number, color: string): DashboardDonutSlice =>
      ({ key, label, value: hours, valueText: `${hours}h`, color });
    return [
      slice('completed', 'Completed', t.completedHours, COLORS.completed),
      slice('inProgress', 'In progress', t.inProgressHours, COLORS.inProgress),
      slice('notStarted', 'Not started', t.notStartedHours, COLORS.notStarted)
    ];
  });

  /** The adherence donut and its key: of the scheduled time, worked and not worked. */
  protected readonly adherenceSlices = computed<DashboardDonutSlice[]>(() => {
    const a = this.adherence();
    return [
      { key: 'worked', label: 'Worked', value: Math.min(a.worked, a.scheduled), valueText: formatWeekHours(a.worked), color: COLORS.worked },
      { key: 'notWorked', label: 'Not Worked', value: a.notWorked, valueText: formatWeekHours(a.notWorked), color: COLORS.notWorked }
    ];
  });

  /** The progress ring as two slices: worked, then what is left of the week's expected hours. */
  protected readonly ringSlices = computed<DashboardDonutSlice[]>(() => {
    const w = this.data().thisWeek;
    const ring = this.ring();
    const left = Math.max(0, w.expectedMinutes - w.workedMinutes);
    return [
      { key: 'worked', label: 'Worked', value: w.workedMinutes, valueText: formatWeekHours(w.workedMinutes), percentText: `${Math.round(ring)}%`, color: WIDGET.shade1 },
      { key: 'left', label: 'Left', value: left, valueText: formatWeekHours(left), percentText: `${Math.round(100 - ring)}%`, color: 'transparent' }
    ];
  });

  /** The slice each donut lights while hovered (there or on its key). */
  protected readonly hoveredRing = signal<string | null>(null);
  protected readonly hoveredAdherence = signal<string | null>(null);
  protected readonly hoveredTask = signal<string | null>(null);

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
