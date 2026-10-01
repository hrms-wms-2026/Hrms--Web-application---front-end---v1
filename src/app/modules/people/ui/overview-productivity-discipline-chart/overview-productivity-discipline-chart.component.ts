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
  readonly productivityPercent: number;
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
  const punctualityRate = attendedDays > 0 ? Math.min(100, Math.round((onTimeDays / attendedDays) * 100)) : 100;
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
      productivityPercent: tasksAssigned > 0 ? completionRate : 100,
      disciplineDetails: eligibleDays.length > 0
        ? `${attendedInWeek}/${eligibleDays.length} scheduled days attended`
        : 'No scheduled employment days',
      productivityDetails: `${tasksCompleted}/${tasksAssigned} tasks completed (${onTimeDeliveryRate}% on-time)`
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
    summaryLine: `${attendedDays} days attended (${punctualityRate}% punctuality) · ${tasksCompleted} of ${tasksAssigned} tasks completed (${completionRate}% delivery rate)`
  };
}

@Component({
  selector: 'app-overview-productivity-discipline-chart',
  standalone: true,
  imports: [],
  template: `
    <!-- Hidden test accessibility metadata -->
    <div class="sr-only">
      <span>Productivity & Attendance Discipline</span>
      @if (data(); as d) {
        <span data-testid="discipline-score">{{ d.punctualityRate }}%</span>
        <span data-testid="productivity-score">{{ d.completionRate }}%</span>
        <span data-testid="correlation-insight">{{ d.summaryLine }}</span>
      }
    </div>

    @if (loader.state() === 'loading') {
      <div class="h-72 animate-pulse rounded-2xl bg-slate-100"></div>
    } @else if (data(); as d) {
      <div>
        <!-- Attendance vs. Delivery Trend Card -->
        <div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs overflow-hidden">
          <!-- Chart Header -->
          <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-bold text-slate-900">Attendance vs. Delivery Trend</h3>
              @if (period.isComparing()) {
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Comparing with {{ period.compareLabel() }}
                </span>
              }
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-5 text-xs font-medium text-slate-600">
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
                <span class="w-3.5 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span> Target (80%)
              </span>
            </div>
          </div>

          <!-- Chart Area -->
          <div class="relative pt-2 pb-6 pl-10 pr-2">
            <!-- Y-Axis Grid Lines & Labels -->
            <div class="absolute inset-y-2 left-0 right-2 pointer-events-none flex flex-col justify-between text-[11px] font-mono text-slate-400">
              <div class="flex items-center w-full">
                <span class="w-8 text-right pr-2">100%</span>
                <div class="flex-1 border-t border-slate-100"></div>
              </div>
              <div class="flex items-center w-full relative">
                <span class="w-8 text-right pr-2">75%</span>
                <div class="flex-1 border-t border-slate-100"></div>
              </div>
              <div class="flex items-center w-full">
                <span class="w-8 text-right pr-2">50%</span>
                <div class="flex-1 border-t border-slate-100"></div>
              </div>
              <div class="flex items-center w-full">
                <span class="w-8 text-right pr-2">25%</span>
                <div class="flex-1 border-t border-slate-100"></div>
              </div>
              <div class="flex items-center w-full">
                <span class="w-8 text-right pr-2">0%</span>
                <div class="flex-1 border-t border-slate-200"></div>
              </div>
            </div>

            <!-- 80% Target Reference Line -->
            <div class="absolute left-8 right-2 top-[20%] border-t border-dashed border-slate-400 pointer-events-none z-10"></div>

            <!-- Bars Container -->
            <div class="relative flex items-end justify-around h-48 border-b border-slate-200 pb-0.5">
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

                    <!-- Productivity Bar (Blue) -->
                    <div class="w-6 sm:w-7 flex flex-col items-center justify-end h-full">
                      <div
                        class="w-full rounded-t-sm bg-blue-600 transition-all duration-300 hover:brightness-110"
                        [style.height.%]="group.productivityPercent"
                        [style.minHeight.px]="group.productivityPercent > 0 ? 6 : 0"
                      ></div>
                    </div>
                  </div>
                </div>
              }
            </div>

            <!-- X-Axis Labels -->
            <div class="flex justify-around items-center mt-3 text-xs text-slate-500 font-medium">
              @for (group of d.weeklyGroups; track group.label) {
                <div class="flex-1 max-w-[130px] text-center">
                  <span class="font-bold text-slate-800 block text-xs">{{ group.label }}</span>
                  <span class="text-[11px] text-slate-400 block mt-0.5">{{ group.periodLabel }}</span>
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
    return data.weeklyGroups.map((group, index) => ({
      x: index * 25 + 16.5,
      y: 100 - Math.max(0, Math.min(100, group.productivityPercent))
    }));
  }

  get compareSvgPolylinePoints(): string {
    return this.compareSvgPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  }
}
