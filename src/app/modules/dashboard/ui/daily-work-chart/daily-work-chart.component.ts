import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { WeekDayProgress } from '../../models/weekly-work-progress.model';
import { WIDGET } from '../../../../shared/utils/widget-palette';
import { barDayTitle, barWeekday } from '../../../../shared/ui/charts/dashboard-bar-chart/bar-chart-dates.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem
} from '../../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';

const SCHEDULED_COLOR = WIDGET.shade3;
const WORKED_COLOR = WIDGET.shade1;
const EXPECTED_COLOR = 'var(--color-text-secondary)';

/** "6h" or "5.5h" from minutes. */
export function formatDayHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

/**
 * Daily Work vs Schedule (Weekly Work Progress card and popup), drawn by the shared dashboard bar chart: per day a
 * Scheduled bar beside a Worked bar, and the Expected hours as a dash across the day. Without the planner the
 * Scheduled bar is left out. With a `heading`, the headline reads the week's worked hours until a day is hovered,
 * then that day's worked hours against its schedule (or expected hours).
 */
@Component({
  selector: 'app-daily-work-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="daily-work-chart"
      axisSuffix="h"
      emptyText="Nothing expected, scheduled or worked this week"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [hideAxis]="compact()"
      [legend]="legend()"
      [ariaLabel]="summary()"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DailyWorkChartComponent {
  readonly days = input.required<readonly WeekDayProgress[]>();
  readonly showScheduled = input(true);
  /** Hides the hour axis where space is tight. */
  readonly compact = input(false);
  /** The headline's label; empty leaves the headline out. */
  readonly heading = input('');
  /** The headline on one line (cards). */
  readonly compactHeadline = input(true);

  protected readonly legend = computed<DashboardBarLegendItem[]>(() => [
    ...(this.showScheduled() ? [{ label: 'Scheduled', color: SCHEDULED_COLOR }] : []),
    { label: 'Worked', color: WORKED_COLOR },
    { label: 'Expected', color: EXPECTED_COLOR, marker: true }
  ]);

  protected readonly bars = computed<DashboardBar[]>(() => {
    const scheduled = this.showScheduled();
    return this.days().map((d) => {
      const title = barDayTitle(d.date);
      const parts = [
        scheduled ? `scheduled ${formatDayHours(d.scheduledMinutes)}` : null,
        `worked ${formatDayHours(d.workedMinutes)}`,
        `expected ${formatDayHours(d.expectedMinutes)}`
      ].filter((p): p is string => p !== null);
      const worked = [{ key: 'worked', value: d.workedMinutes / 60, color: WORKED_COLOR }];
      return {
        key: d.date,
        label: barWeekday(d.date),
        title,
        valueText: `${formatDayHours(d.workedMinutes)} worked`,
        chip: scheduled
          ? `of ${formatDayHours(d.scheduledMinutes)} scheduled`
          : `of ${formatDayHours(d.expectedMinutes)} expected`,
        segments: scheduled ? [{ key: 'scheduled', value: d.scheduledMinutes / 60, color: SCHEDULED_COLOR }] : worked,
        pair: scheduled ? worked : undefined,
        marker: d.expectedMinutes / 60,
        tooltip: `${title}: ${parts.join(', ')}`
      };
    });
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const worked = this.days().reduce((n, d) => n + d.workedMinutes, 0);
    const expected = this.days().reduce((n, d) => n + d.expectedMinutes, 0);
    return {
      label: this.heading(),
      value: `${formatDayHours(worked)} worked`,
      chip: expected > 0 ? { text: `of ${formatDayHours(expected)} expected`, tone: 'neutral' } : null
    };
  });

  protected readonly summary = computed(() => `Daily work against schedule: ${this.bars().map((b) => b.tooltip).join('; ')}`);
}
