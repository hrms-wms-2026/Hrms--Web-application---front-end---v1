import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TeamWorkingHoursDay } from '../../models/my-team-today.model';
import { minutesText } from '../../utils/team-presence-format.util';
import { WIDGET } from '../../../../shared/utils/widget-palette';
import { barDayTitle, barHours, barWeekday } from '../../../../shared/ui/charts/dashboard-bar-chart/bar-chart-dates.util';
import {
  DashboardBar,
  DashboardBarChartComponent,
  DashboardBarHeadline,
  DashboardBarLegendItem
} from '../../../../shared/ui/charts/dashboard-bar-chart/dashboard-bar-chart.component';

const WORKED_COLOR = WIDGET.shade1;
const BREAK_COLOR = WIDGET.shade3;

/** Worked minutes per person with a record that day; 0 without one. */
function perPerson(d: TeamWorkingHoursDay): number {
  return d.peopleWithRecord > 0 ? d.workedMinutes / d.peopleWithRecord : 0;
}

/**
 * The team's attendance minutes per day of a week as stacked bars (worked at the bottom, break on top), drawn by the
 * shared dashboard bar chart. Attendance time only: never task or planned time. With `teamAverage`, each day's worked
 * time per person with a record joins the hover readout (and the week's average the headline); with `showLeave`, a
 * red count marks the days with people on approved leave. With a `heading`, the headline reads the week's worked
 * hours until a day is hovered.
 */
@Component({
  selector: 'app-working-hours-chart',
  standalone: true,
  imports: [DashboardBarChartComponent],
  template: `
    <app-dashboard-bar-chart
      class="min-h-0 flex-1"
      data-testid="working-hours-chart"
      axisSuffix="h"
      emptyText="No time clocked this week"
      [bars]="bars()"
      [headline]="headline()"
      [compactHeadline]="compactHeadline()"
      [legend]="legend"
      [ariaLabel]="summary()"
    />
  `,
  host: { class: 'flex min-h-0 flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkingHoursChartComponent {
  readonly days = input.required<readonly TeamWorkingHoursDay[]>();
  /** Adds each day's worked time per person with a record to the readout (per person, not team totals). */
  readonly teamAverage = input(false);
  /** A red count over each day with people on approved leave (people, never minutes). */
  readonly showLeave = input(false);
  /** The headline's label; empty leaves the headline out. */
  readonly heading = input('');
  /** The headline on one line (cards). */
  readonly compactHeadline = input(true);

  protected readonly legend: DashboardBarLegendItem[] = [
    { label: 'Worked', color: WORKED_COLOR },
    { label: 'Break', color: BREAK_COLOR }
  ];

  protected readonly bars = computed<DashboardBar[]>(() => {
    const showLeave = this.showLeave();
    const average = this.teamAverage();
    return this.days().map((d) => ({
      key: d.date,
      label: barWeekday(d.date),
      title: barDayTitle(d.date),
      valueText: `${barHours(d.workedMinutes)} worked`,
      chip:
        average && d.peopleWithRecord > 0
          ? `${minutesText(perPerson(d))} per person`
          : `${minutesText(d.breakMinutes)} break`,
      segments: [
        { key: 'worked', value: d.workedMinutes / 60, color: WORKED_COLOR },
        { key: 'break', value: d.breakMinutes / 60, color: BREAK_COLOR }
      ],
      badge: showLeave && d.onLeaveCount > 0 ? { text: String(d.onLeaveCount), title: `${d.onLeaveCount} on leave` } : undefined,
      tooltip:
        `${barWeekday(d.date)} ${d.date}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break` +
        `, ${d.peopleWithRecord} clocked in` +
        (d.onLeaveCount > 0 ? `, ${d.onLeaveCount} on leave` : '')
    }));
  });

  /** The week's worked time per person with a record; null before anyone clocked in. */
  private readonly weekAverage = computed(() => {
    const records = this.days().reduce((n, d) => n + d.peopleWithRecord, 0);
    const worked = this.days().reduce((n, d) => n + d.workedMinutes, 0);
    return records > 0 ? worked / records : null;
  });

  protected readonly headline = computed<DashboardBarHeadline | null>(() => {
    if (!this.heading()) return null;
    const worked = this.days().reduce((n, d) => n + d.workedMinutes, 0);
    const average = this.teamAverage() ? this.weekAverage() : null;
    return {
      label: this.heading(),
      value: `${barHours(worked)} worked`,
      chip: average === null ? null : { text: `${minutesText(average)} avg per person`, tone: 'neutral' }
    };
  });

  protected readonly summary = computed(() => {
    const byDay = this.days()
      .map((d) => `${barWeekday(d.date)}: ${minutesText(d.workedMinutes)} worked, ${minutesText(d.breakMinutes)} break`)
      .join('; ');
    if (!this.teamAverage()) return `Team working hours by day. ${byDay}`;
    const average = this.weekAverage();
    return `Team working hours by day, ${average === null ? 'no average yet' : `${minutesText(average)} average per person`}. ${byDay}`;
  });
}
