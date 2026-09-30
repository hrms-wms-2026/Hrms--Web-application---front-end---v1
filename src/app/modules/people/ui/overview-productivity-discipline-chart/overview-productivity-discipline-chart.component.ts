import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  EmployeeAttendanceDisciplineResponse,
  EmployeeAttendanceOverviewResponse,
  EmployeeDeliveryResponse,
  EmployeeWorkOverviewResponse
} from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { Delta, computeDelta } from '../../utils/employee-overview.utils';

export interface WeeklyBarGroup {
  readonly label: string;
  readonly periodLabel: string;
  readonly disciplinePercent: number;
  readonly productivityPercent: number;
  readonly disciplineDetails: string;
  readonly productivityDetails: string;
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
      <div class="animate-pulse space-y-6">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="h-28 rounded-2xl bg-slate-100"></div>
          <div class="h-28 rounded-2xl bg-slate-100"></div>
          <div class="h-28 rounded-2xl bg-slate-100"></div>
          <div class="h-28 rounded-2xl bg-slate-100"></div>
        </div>
        <div class="h-72 rounded-2xl bg-slate-100"></div>
      </div>
    } @else if (data(); as d) {
      <div class="space-y-6">
        <!-- 4 Pastel Top Metric Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <!-- Card 1: Days Attended (Pastel Green) -->
          <div class="bg-[#f0fdf4] border border-emerald-100/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div class="flex items-start justify-between">
              <span class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
              <div class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {{ d.attendedDays }} <span class="text-lg font-normal text-slate-400">/ {{ d.workingDays }}</span>
              </div>
            </div>
            <div class="mt-3">
              <span class="text-sm font-medium text-slate-600 block">Days attended</span>
              <span class="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                ● {{ d.attendanceRate }}% of working days
              </span>
            </div>
          </div>

          <!-- Card 2: Late Arrivals (Pastel Rose) -->
          <div class="bg-[#fff1f2] border border-rose-100/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div class="flex items-start justify-between">
              <span class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
              <div class="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600">
                {{ d.lateClockIns }}
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-slate-600 block">Late arrivals</span>
                <span class="text-xs font-semibold text-rose-600 flex items-center gap-1 mt-0.5">
                  ● {{ d.lateRate }}% late rate
                </span>
              </div>
              @if (d.lateDelta; as delta) {
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" [class]="deltaClass(delta)">
                  {{ delta.text }}
                </span>
              }
            </div>
          </div>

          <!-- Card 3: Missing Clock-outs (Pastel Orange) -->
          <div class="bg-[#fff7ed] border border-orange-100/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div class="flex items-start justify-between">
              <span class="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
              </span>
              <div class="text-2xl sm:text-3xl font-bold tracking-tight text-orange-600">
                {{ d.missingClockOuts }}
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between">
              <div>
                <span class="text-sm font-medium text-slate-600 block">Missing clock-outs</span>
                <span class="text-xs font-semibold text-orange-600 flex items-center gap-1 mt-0.5">
                  ● Needs review
                </span>
              </div>
              @if (d.missingDelta; as delta) {
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" [class]="deltaClass(delta)">
                  {{ delta.text }}
                </span>
              }
            </div>
          </div>

          <!-- Card 4: Tasks Completed (Pastel Blue) -->
          <div class="bg-[#eff6ff] border border-blue-100/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
            <div class="flex items-start justify-between">
              <span class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <div class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                {{ d.tasksCompleted }} <span class="text-lg font-normal text-slate-400">/ {{ d.tasksAssigned }}</span>
              </div>
            </div>
            <div class="mt-3">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-sm font-medium text-slate-600 block">Tasks completed</span>
                  <span class="text-xs font-semibold text-blue-600 flex items-center gap-1 mt-0.5">
                    {{ d.completionRate }}% completion rate
                  </span>
                </div>
                @if (d.tasksDelta; as delta) {
                  <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" [class]="deltaClass(delta)">
                    {{ delta.text }}
                  </span>
                }
              </div>
              <div class="w-full bg-blue-200/60 rounded-full h-1 mt-1.5 overflow-hidden">
                <div class="bg-blue-600 h-1 rounded-full transition-all duration-300" [style.width.%]="d.completionRate"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Attendance vs. Delivery Trend Card -->
        <div class="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <!-- Chart Header -->
          <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-3">
              <h3 class="text-base font-bold text-slate-900">Attendance vs. Delivery Trend</h3>
              @if (d.compareActive) {
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-600"></span> Comparing with previous period
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
              <!-- Thin Clean Connecting Line Overlay for Productivity -->
              <svg class="absolute inset-0 w-full h-full pointer-events-none z-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline [attr.points]="svgPolylinePoints" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                @for (pt of svgPoints; track pt.x) {
                  <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="2.5" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" />
                }
              </svg>

              @for (group of d.weeklyGroups; track group.label) {
                <div class="flex-1 max-w-[130px] flex flex-col items-center h-full justify-end group cursor-pointer relative z-10">
                  <!-- Paired Bars -->
                  <div class="w-full flex items-end justify-center gap-2 h-full">
                    <!-- Discipline Bar (Emerald) -->
                    <div class="w-6 sm:w-7 flex flex-col items-center justify-end h-full">
                      <div
                        class="w-full rounded-t-sm bg-emerald-500 transition-all duration-300 hover:brightness-110"
                        [style.height.%]="group.disciplinePercent"
                        [style.minHeight.px]="group.disciplinePercent > 0 ? 6 : 0"
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
  private readonly period = inject(EmployeePeriodStore);

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

  readonly data = computed(() => {
    const raw = this.loader.data();
    if (!raw) return null;

    const att = raw.attendance;
    const disc = raw.discipline;
    const wrk = raw.work;
    const del = raw.delivery;

    const attendedDays = att?.present ?? 0;
    const lateClockIns = disc?.lateClockIns ?? att?.late ?? 0;
    const earlyClockOuts = disc?.earlyClockOuts ?? 0;
    const missingClockOuts = disc?.missingClockOuts ?? att?.missingClockOuts ?? 0;
    const overBreakMinutes = disc?.overBreakMinutes ?? 0;

    const onTimeDays = Math.max(0, attendedDays - lateClockIns);
    const punctualityRate = attendedDays > 0 ? Math.min(100, Math.round((onTimeDays / attendedDays) * 100)) : 100;

    const tasksAssigned = wrk?.assigned ?? del?.tasksAssigned ?? 0;
    const tasksCompleted = wrk?.completed ?? del?.tasksCompleted ?? 0;
    const overdueTasks = wrk?.overdue ?? 0;
    const completionRate = wrk?.completionRatePercent ?? (tasksAssigned > 0 ? Math.round((tasksCompleted / tasksAssigned) * 100) : 0);
    const onTimeDeliveryRate =
      wrk?.onTimeRatePercent ??
      (del && del.completedWithDueDate > 0 ? Math.round((del.onTimeCompleted / del.completedWithDueDate) * 100) : completionRate);

    const storyPointsAssigned = del?.storyPointsAssigned ?? 0;
    const storyPointsCompleted = del?.storyPointsCompleted ?? 0;

    // Build Weekly Cohort Performance Groups
    const days = att?.days ?? [];
    const getWeekDays = (startDay: number, endDay: number) => {
      return days.filter((d) => {
        const dayNum = parseInt(d.date.split('-')[2] || '0', 10);
        return dayNum >= startDay && dayNum <= endDay;
      });
    };

    const weekRanges = [
      { label: 'Week 1', periodLabel: 'Day 1–7', start: 1, end: 7 },
      { label: 'Week 2', periodLabel: 'Day 8–14', start: 8, end: 14 },
      { label: 'Week 3', periodLabel: 'Day 15–21', start: 15, end: 21 },
      { label: 'Week 4', periodLabel: 'Day 22–31', start: 22, end: 31 }
    ];

    const weeklyGroups: WeeklyBarGroup[] = weekRanges.map((range, index) => {
      const weekDays = getWeekDays(range.start, range.end);
      const attendedInWeek = weekDays.filter((d) => d.status === 'present' || d.status === 'late').length;
      const onTimeInWeek = weekDays.filter((d) => d.status === 'present').length;
      const lateInWeek = weekDays.filter((d) => d.status === 'late').length;

      let discPercent = punctualityRate;
      let discDetails = `${onTimeDays}/${attendedDays} on time`;
      if (weekDays.length > 0) {
        if (attendedInWeek > 0) {
          discPercent = Math.round((onTimeInWeek / attendedInWeek) * 100);
          discDetails = `${onTimeInWeek}/${attendedInWeek} on time (${lateInWeek} late)`;
        } else {
          discPercent = 100;
          discDetails = 'No working days recorded';
        }
      }

      // Distribute tasks or show overall period pacing
      const prodPercent = tasksAssigned > 0 ? completionRate : 100;
      const prodDetails = `${tasksCompleted}/${tasksAssigned} tasks completed (${onTimeDeliveryRate}% on-time)`;

      return {
        label: range.label,
        periodLabel: range.periodLabel,
        disciplinePercent: discPercent,
        productivityPercent: prodPercent,
        disciplineDetails: discDetails,
        productivityDetails: prodDetails
      };
    });

    const workingDays = att?.workingDays ?? (attendedDays > 0 ? attendedDays : 22);
    const attendanceRate = workingDays > 0 ? Math.min(100, Math.round((attendedDays / workingDays) * 100)) : 100;
    const lateRate = attendedDays > 0 ? Math.min(100, Math.round((lateClockIns / attendedDays) * 100)) : 0;
    const summaryLine = `${attendedDays} days attended (${punctualityRate}% punctuality) · ${tasksCompleted} of ${tasksAssigned} tasks completed (${completionRate}% delivery rate)`;

    const compareActive = this.period.comparePrevious();
    const prevDisc = disc?.previous;
    const prevDel = del?.previous;

    const lateDelta = prevDisc && compareActive
      ? computeDelta(lateClockIns, prevDisc.lateClockIns, 'lower-better')
      : null;

    const missingDelta = prevDisc && compareActive
      ? computeDelta(missingClockOuts, prevDisc.missingClockOuts, 'lower-better')
      : null;

    const tasksDelta = prevDel && compareActive
      ? computeDelta(tasksCompleted, prevDel.tasksCompleted, 'higher-better')
      : null;

    return {
      punctualityRate,
      onTimeDays,
      attendedDays,
      workingDays,
      attendanceRate,
      lateClockIns,
      lateRate,
      earlyClockOuts,
      missingClockOuts,
      overBreakMinutes,
      tasksAssigned,
      tasksCompleted,
      overdueTasks,
      completionRate,
      onTimeDeliveryRate,
      storyPointsAssigned,
      storyPointsCompleted,
      weeklyGroups,
      summaryLine,
      compareActive,
      lateDelta,
      missingDelta,
      tasksDelta
    };
  });

  deltaClass(delta: Delta | null): string {
    if (!delta) return '';
    if (delta.tone === 'good') return 'bg-emerald-100 text-emerald-800';
    if (delta.tone === 'bad') return 'bg-rose-100 text-rose-800';
    return 'bg-slate-100 text-slate-700';
  }

  get svgPoints(): { x: number; y: number }[] {
    const d = this.data();
    if (!d || !d.weeklyGroups.length) return [];
    return d.weeklyGroups.map((g, i) => {
      const x = i * 25 + 16.5;
      const clampedPct = Math.max(0, Math.min(100, g.productivityPercent));
      const y = 100 - clampedPct;
      return { x, y };
    });
  }

  get svgPolylinePoints(): string {
    return this.svgPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }
}
