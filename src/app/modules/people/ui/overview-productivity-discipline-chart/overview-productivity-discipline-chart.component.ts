import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  EmployeeAttendanceDisciplineResponse,
  EmployeeAttendanceOverviewResponse,
  EmployeeDeliveryResponse,
  EmployeeWorkOverviewResponse
} from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { createCompareLoader } from '../../utils/overview-compare';

export interface WeeklyBarGroup {
  readonly label: string;
  readonly periodLabel: string;
  readonly disciplinePercent: number | null;
  /** Null when no tasks fall in the period: there is no delivery to measure, so no bar - never 100%. */
  readonly productivityPercent: number | null;
  readonly disciplineDetails: string;
  readonly productivityDetails: string;
}

interface ChartSources {
  readonly attendance: EmployeeAttendanceOverviewResponse | null;
  readonly discipline: EmployeeAttendanceDisciplineResponse | null;
  readonly work: EmployeeWorkOverviewResponse | null;
  readonly delivery: EmployeeDeliveryResponse | null;
}

function buildChartData(raw: ChartSources | null) {
  if (!raw) return null;

  const att = raw.attendance;
  const disc = raw.discipline;
  const wrk = raw.work;
  const del = raw.delivery;
  const attendedDays = att?.present ?? 0;
  const lateClockIns = disc?.lateClockIns ?? att?.late ?? 0;
  const onTimeDays = Math.max(0, attendedDays - lateClockIns);
  // Nothing attended means nothing to judge: no rate rather than a made-up 100%.
  const punctualityRate = attendedDays > 0 ? Math.min(100, Math.round((onTimeDays / attendedDays) * 100)) : null;
  const tasksAssigned = wrk?.assigned ?? del?.tasksAssigned ?? 0;
  const tasksCompleted = wrk?.completed ?? del?.tasksCompleted ?? 0;
  const completionRate = wrk?.completionRatePercent ?? (tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0);
  const onTimeDeliveryRate =
    wrk?.onTimeRatePercent ??
    (del && del.completedWithDueDate > 0 ? Math.round((del.onTimeCompleted / del.completedWithDueDate) * 100) : completionRate);
  const days = att?.days ?? [];
  const weekRanges = [
    { label: 'Week 1', periodLabel: 'Day 1–7', start: 1, end: 7 },
    { label: 'Week 2', periodLabel: 'Day 8–14', start: 8, end: 14 },
    { label: 'Week 3', periodLabel: 'Day 15–21', start: 15, end: 21 },
    { label: 'Week 4', periodLabel: 'Day 22–31', start: 22, end: 31 }
  ];
  const weeklyGroups: WeeklyBarGroup[] = weekRanges.map((range) => {
    const weekDays = days.filter((day) => {
      const dayNumber = parseInt(day.date.split('-')[2] || '0', 10);
      return dayNumber >= range.start && dayNumber <= range.end;
    });
    const eligibleDays = weekDays.filter(
      (day) => day.status !== 'off' && day.status !== 'none' && day.status !== 'leave'
    );
    const attendedInWeek = eligibleDays.filter(
      (day) => day.status === 'present' || day.status === 'late' || day.status === 'missing_clock_out'
    ).length;
    const disciplinePercent = eligibleDays.length > 0
      ? Math.round((attendedInWeek / eligibleDays.length) * 100)
      : null;
    return {
      label: range.label,
      periodLabel: range.periodLabel,
      disciplinePercent,
      productivityPercent: tasksAssigned > 0 ? completionRate : null,
      disciplineDetails: eligibleDays.length > 0
        ? `${attendedInWeek}/${eligibleDays.length} scheduled days attended`
        : 'No scheduled employment days',
      productivityDetails: tasksAssigned > 0
        ? `${tasksCompleted}/${tasksAssigned} tasks completed (${onTimeDeliveryRate}% on-time)`
        : 'No tasks in this period'
    };
  });

  return {
    punctualityRate,
    attendedDays,
    tasksAssigned,
    tasksCompleted,
    completionRate,
    onTimeDeliveryRate,
    weeklyGroups,
    hasTasks: tasksAssigned > 0,
    summaryLine:
      `${attendedDays} days attended` + (punctualityRate === null ? '' : ` (${punctualityRate}% punctuality)`) +
      ' · ' +
      (tasksAssigned > 0
        ? `${tasksCompleted} of ${tasksAssigned} tasks completed (${completionRate}% delivery rate)`
        : 'no tasks in this period')
  };
}

@Component({
  selector: 'app-overview-productivity-discipline-chart',
  host: { class: 'block h-full' },
  standalone: true,
  imports: [],
  template: `
    <!-- Hidden test accessibility metadata -->
    <div class="sr-only">
      <span>Productivity & Attendance Discipline</span>
      @if (data(); as d) {
        <span data-testid="discipline-score">{{ d.punctualityRate === null ? 'n/a' : d.punctualityRate + '%' }}</span>
        <span data-testid="productivity-score">{{ d.hasTasks ? d.completionRate + '%' : 'n/a' }}</span>
        <span data-testid="correlation-insight">{{ d.summaryLine }}</span>
      }
    </div>

    @if (loader.state() === 'loading') {
      <div class="h-60 animate-pulse rounded-2xl bg-[var(--color-surface-secondary)]"></div>
    } @else if (data(); as d) {
      <div class="h-full">
        <!-- Attendance vs. Delivery Trend Card -->
        <div class="flex h-full flex-col rounded-2xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] p-5 shadow-xs overflow-hidden">
          <!-- Chart Header -->
          <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-bold text-[var(--color-text-primary)]">Attendance vs. Delivery Trend</h3>
              @if (period.isComparing()) {
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Comparing with {{ period.compareLabel() }}
                </span>
              }
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-5 text-xs font-medium text-[var(--color-text-secondary)]">
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Attendance Discipline
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> Work Productivity
              </span>
              @if (period.isComparing()) {
                <span class="flex items-center gap-1.5">
                  <span class="w-3.5 h-0.5 border-t-2 border-dashed border-blue-600 opacity-50 inline-block"></span> {{ period.compareLabel() }}
                </span>
              }
              <span class="flex items-center gap-1.5">
                <span class="w-3.5 h-0.5 border-t-2 border-dashed border-[var(--color-border-strong)] inline-block"></span> Target (80%)
              </span>
            </div>
          </div>

          <!-- Chart Area -->
          <div class="relative mt-auto pb-1 pt-2">
            <!-- Keep the grid, target line and bars in the same fixed-height plot so their percentages align. -->
            <div data-testid="weekly-chart-plot" class="relative ml-10 mr-2 h-36">
              <!-- Y-Axis Grid Lines & Labels -->
              <div class="pointer-events-none absolute inset-0 text-[11px] font-mono text-[var(--color-text-muted)]">
                <div data-testid="chart-grid-100" class="absolute left-0 right-0 top-0 border-t border-[var(--color-border)]">
                  <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">100%</span>
                </div>
                <div class="absolute left-0 right-0 top-1/4 border-t border-[var(--color-border)]">
                  <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">75%</span>
                </div>
                <div class="absolute left-0 right-0 top-1/2 border-t border-[var(--color-border)]">
                  <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">50%</span>
                </div>
                <div class="absolute left-0 right-0 top-3/4 border-t border-[var(--color-border)]">
                  <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">25%</span>
                </div>
                <div data-testid="chart-grid-0" class="absolute bottom-0 left-0 right-0 border-t border-[var(--color-border)]">
                  <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">0%</span>
                </div>
              </div>

              <!-- 80% Target Reference Line -->
              <div class="pointer-events-none absolute left-0 right-0 top-[20%] z-20 border-t border-dashed border-[var(--color-border-strong)]"></div>

              @if (!d.hasTasks) {
                <!-- Inside the plot (not the legend) so the header stays on one line. -->
                <p data-testid="productivity-no-tasks-note" class="pointer-events-none absolute inset-x-0 top-[38%] z-30 text-center text-xs text-[var(--color-text-muted)]">
                  No tasks this period, so there is no work productivity to show.
                </p>
              }

              <!-- Bars Container -->
              <div class="relative z-10 flex h-full items-end justify-around border-b border-[var(--color-border)]">
              @if (compareData()) {
                <svg class="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    data-testid="trend-compare"
                    [attr.points]="compareSvgPolylinePoints"
                    fill="none"
                    stroke="#2563eb"
                    stroke-width="2"
                    stroke-dasharray="4 4"
                    opacity="0.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              }

              @for (group of d.weeklyGroups; track group.label) {
                <div class="flex-1 max-w-[130px] flex flex-col items-center h-full justify-end group cursor-pointer relative z-10">
                  <!-- Paired Bars -->
                  <div class="w-full flex items-end justify-center gap-2 h-full">
                    <!-- Discipline Bar (Emerald) -->
                    <div class="w-6 sm:w-7 flex flex-col items-center justify-end h-full">
                      <div
                        class="w-full rounded-t-sm bg-emerald-500 transition-all duration-300 hover:brightness-110"
                        [style.height.%]="group.disciplinePercent"
                        [style.minHeight.px]="group.disciplinePercent !== null && group.disciplinePercent > 0 ? 6 : 0"
                      ></div>
                    </div>

                    <!-- Productivity Bar (Blue); no tasks = an empty dashed slot, not a full bar -->
                    <div class="w-6 sm:w-7 flex flex-col items-center justify-end h-full" [title]="group.productivityDetails">
                      @if (group.productivityPercent !== null) {
                        <div
                          class="w-full rounded-t-sm bg-blue-600 transition-all duration-300 hover:brightness-110"
                          [style.height.%]="group.productivityPercent"
                          [style.minHeight.px]="group.productivityPercent > 0 ? 6 : 0"
                        ></div>
                      } @else {
                        <div data-testid="productivity-no-tasks" class="h-2 w-full rounded-t-sm border border-dashed border-[var(--color-border-strong)]"></div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
            </div>

            <!-- X-Axis Labels -->
            <div data-testid="chart-x-labels" class="ml-10 mr-2 mt-2 flex items-center justify-around text-xs font-medium text-[var(--color-text-secondary)]">
              @for (group of d.weeklyGroups; track group.label) {
                <div class="flex-1 max-w-[130px] text-center">
                  <span class="font-bold text-[var(--color-text-primary)] block text-xs">{{ group.label }}</span>
                  <span class="text-[11px] text-[var(--color-text-muted)] block mt-0.5">{{ group.periodLabel }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewProductivityDisciplineChartComponent {
  private readonly api = inject(PeopleApiService);
  readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () =>
      forkJoin({
        attendance: this.api
          .getOverviewAttendance(this.employeeId(), this.period.from(), this.period.to())
          .pipe(catchError(() => of(null))),
        discipline: this.api
          .getOverviewAttendanceDiscipline(
            this.employeeId(),
            this.period.from(),
            this.period.to(),
            false
          )
          .pipe(catchError(() => of(null))),
        work: this.api
          .getOverviewWork(this.employeeId(), this.period.from(), this.period.to())
          .pipe(catchError(() => of(null))),
        delivery: this.api
          .getOverviewDelivery(
            this.employeeId(),
            this.period.from(),
            this.period.to(),
            false
          )
          .pipe(catchError(() => of(null)))
      }),
    {
      isEmpty: (data) =>
        (!data.attendance || data.attendance.workingDays === 0) &&
        (!data.work || data.work.assigned === 0) &&
        (!data.discipline ||
          (data.discipline.lateClockIns === 0 &&
            data.discipline.earlyClockOuts === 0 &&
            data.discipline.missingClockOuts === 0))
    }
  );
  readonly compareLoader = createCompareLoader(this.period, (from, to) =>
    forkJoin({
      attendance: this.api.getOverviewAttendance(this.employeeId(), from, to),
      work: this.api.getOverviewWork(this.employeeId(), from, to)
    })
  );

  readonly data = computed(() => buildChartData(this.loader.data()));
  readonly compareData = computed(() => {
    const raw = this.compareLoader.data();
    return raw
      ? buildChartData({ attendance: raw.attendance, work: raw.work, discipline: null, delivery: null })
      : null;
  });

  get compareSvgPoints(): { x: number; y: number }[] {
    const data = this.compareData();
    if (!data) return [];
    // Weeks without tasks have no delivery value, so they are left off the comparison line.
    return data.weeklyGroups.flatMap((group, index) =>
      group.productivityPercent === null
        ? []
        : [{ x: index * 25 + 16.5, y: 100 - Math.max(0, Math.min(100, group.productivityPercent)) }]
    );
  }

  get compareSvgPolylinePoints(): string {
    return this.compareSvgPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }
}
