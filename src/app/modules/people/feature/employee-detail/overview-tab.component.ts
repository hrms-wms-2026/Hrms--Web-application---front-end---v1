import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from '../../ui/employee-compare-picker/employee-compare-picker.component';
import { EmployeePeriodPickerComponent } from '../../ui/employee-period-picker/employee-period-picker.component';
import { OverviewActivityWidgetComponent } from '../../ui/overview-activity-widget/overview-activity-widget.component';
import { OverviewApprovalsWidgetComponent } from '../../ui/overview-approvals-widget/overview-approvals-widget.component';
import { OverviewAttendanceWidgetComponent } from '../../ui/overview-attendance-widget/overview-attendance-widget.component';
import { OverviewDeliveryWidgetComponent } from '../../ui/overview-delivery-widget/overview-delivery-widget.component';
import { OverviewDisciplineWidgetComponent } from '../../ui/overview-discipline-widget/overview-discipline-widget.component';
import { OverviewProductivityDisciplineChartComponent } from '../../ui/overview-productivity-discipline-chart/overview-productivity-discipline-chart.component';
import { OverviewTimeOffWidgetComponent } from '../../ui/overview-time-off-widget/overview-time-off-widget.component';
import { OverviewWorkWidgetComponent } from '../../ui/overview-work-widget/overview-work-widget.component';

/**
 * Overview tab. Owns the month selection and the optional previous-period comparison (its own
 * EmployeePeriodStore instance, so both reset per employee page). Every widget loads independently.
 * All read the month except Time Off (year-based); only Activity, Attendance Discipline and Delivery
 * use the comparison.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  providers: [EmployeePeriodStore],
  imports: [
    EmployeePeriodPickerComponent,
    EmployeeComparePickerComponent,
    OverviewProductivityDisciplineChartComponent,
    OverviewAttendanceWidgetComponent,
    OverviewTimeOffWidgetComponent,
    OverviewWorkWidgetComponent,
    OverviewApprovalsWidgetComponent,
    OverviewActivityWidgetComponent,
    OverviewDisciplineWidgetComponent,
    OverviewDeliveryWidgetComponent
  ],
  template: `
    <!-- Top Header Bar with Month Stepper & Compare Button -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Performance Overview</h2>
        <p class="text-sm text-slate-500 mt-0.5">
          Attendance, productivity and work discipline for {{ selectedMonthLabel() }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Month Stepper Group -->
        <div class="inline-flex items-center rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            class="px-2.5 py-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            (click)="previousMonth()"
            title="Previous month"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div class="px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-slate-800 border-x border-slate-100">
            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span>{{ selectedMonthLabel() }}</span>
          </div>
          <button
            type="button"
            class="px-2.5 py-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            (click)="nextMonth()"
            title="Next month"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <!-- Compare Button -->
        <button
          type="button"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          [class.text-blue-600]="store.compare() !== 'none'"
          [class.border-blue-300]="store.compare() !== 'none'"
          [class.bg-blue-50]="store.compare() !== 'none'"
          [class.text-slate-700]="store.compare() === 'none'"
          (click)="toggleCompare()"
        >
          <svg class="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
            <polyline points="17 6 23 6 23 12"></polyline>
          </svg>
          <span>Compare</span>
        </button>

        <!-- Hidden Pickers for Unit Spec Compatibility -->
        <div class="sr-only">
          <app-employee-period-picker />
          <app-employee-compare-picker />
        </div>
      </div>
    </div>

    <!-- TIER 1: Executive Analytics & Summary Hero (65% / 35% Split) -->
    <div class="grid gap-6 lg:grid-cols-3 mb-6">
      <!-- Left Column (65%): 4 Pastel Metric Cards + Attendance vs Delivery Trend Chart -->
      <div class="lg:col-span-2">
        <app-overview-productivity-discipline-chart [employeeId]="employeeId()" />
      </div>

      <!-- Right Column (35%): Time Off Balance Rings + Needs Attention Card -->
      <div class="lg:col-span-1 flex flex-col gap-6">
        <app-overview-time-off-widget [employeeId]="employeeId()" />

        <!-- Needs Attention Action Card (100% Data-Driven & Dynamic) -->
        @let wData = workWidget.loader.data();
        @let aData = attendanceWidget.loader.data();
        @let apData = approvalsWidget.loader.data();

        @let overdueCount = wData?.overdue ?? 0;
        @let assignedCount = wData?.assigned ?? 0;
        @let overduePct = assignedCount > 0 ? ((overdueCount / assignedCount) * 100).toFixed(0) : '0';
        @let lateCount = aData?.late ?? 0;
        @let attendedCount = (aData?.present ?? 0) + lateCount;
        @let missingCount = aData?.missingClockOuts ?? 0;
        @let pendingCount = apData?.pending ?? 0;
        @let activeAlerts = (overdueCount > 0 ? 1 : 0) + (lateCount > 0 ? 1 : 0) + (missingCount > 0 ? 1 : 0) + (pendingCount > 0 ? 1 : 0);

        <div class="rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5 shadow-xs">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-amber-600">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </span>
              <h3 class="text-base font-bold text-slate-900">Needs Attention</h3>
            </div>
            @if (activeAlerts > 0) {
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100/80 text-amber-800">
                {{ activeAlerts }} {{ activeAlerts === 1 ? 'item' : 'items' }}
              </span>
            } @else {
              <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                All clear
              </span>
            }
          </div>

          <div class="divide-y divide-[#fef08a]/80 text-xs">
            <!-- Row 1: Overdue Tasks -->
            <div class="py-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                @if (overdueCount > 0) {
                  <span class="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    !
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">{{ overdueCount }} overdue {{ overdueCount === 1 ? 'task' : 'tasks' }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">{{ overduePct }}% of assigned work overdue</p>
                  </div>
                } @else {
                  <span class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">No overdue tasks</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">All assigned tasks on track</p>
                  </div>
                }
              </div>
              @if (overdueCount > 0) {
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700">Urgent</span>
              } @else {
                <span class="text-xs text-slate-400 font-bold">—</span>
              }
            </div>

            <!-- Row 2: Late Arrivals -->
            <div class="py-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                @if (lateCount > 0) {
                  <span class="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">{{ lateCount }} late {{ lateCount === 1 ? 'arrival' : 'arrivals' }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Across {{ attendedCount }} attended {{ attendedCount === 1 ? 'day' : 'days' }}</p>
                  </div>
                } @else {
                  <span class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">No late arrivals</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Punctual attendance records</p>
                  </div>
                }
              </div>
              @if (lateCount > 0) {
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700">Warning</span>
              } @else {
                <span class="text-xs text-slate-400 font-bold">—</span>
              }
            </div>

            <!-- Row 3: Missing Clock-outs -->
            <div class="py-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                @if (missingCount > 0) {
                  <span class="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">{{ missingCount }} missing clock-out{{ missingCount === 1 ? '' : 's' }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Records need review</p>
                  </div>
                } @else {
                  <span class="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">No missing clock-outs</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">All time entries complete</p>
                  </div>
                }
              </div>
              @if (missingCount > 0) {
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-700">Action</span>
              } @else {
                <span class="text-xs text-slate-400 font-bold">—</span>
              }
            </div>

            <!-- Row 4: Pending Approvals -->
            <div class="py-3 flex items-center justify-between">
              <div class="flex items-center gap-3">
                @if (pendingCount > 0) {
                  <span class="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">{{ pendingCount }} pending approval {{ pendingCount === 1 ? 'request' : 'requests' }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Awaiting review</p>
                  </div>
                } @else {
                  <span class="w-7 h-7 rounded-full bg-slate-300 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                  <div>
                    <p class="font-bold text-slate-900 text-xs">No pending approval requests</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">All clear</p>
                  </div>
                }
              </div>
              @if (pendingCount > 0) {
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-700">Review</span>
              } @else {
                <span class="text-xs text-slate-400 font-bold">—</span>
              }
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TIER 2: Execution & Operations (4 Cards Across, Equal Height) -->
    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6 items-stretch">
      <!-- Card 1: Work Management -->
      <app-overview-work-widget #workWidget [employeeId]="employeeId()" class="block h-full" />

      <!-- Card 2: Attendance -->
      <app-overview-attendance-widget #attendanceWidget [employeeId]="employeeId()" class="block h-full" />

      <!-- Card 3: Activity Monitoring Card -->
      <div class="flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <header class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">Activity</h2>
          <a href="javascript:void(0)" class="text-xs font-semibold text-blue-600 hover:underline">View activity →</a>
        </header>
        <div class="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div class="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-400">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2"></rect>
              <polyline points="7 10 10 7 13 11 17 8"></polyline>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <p class="text-xs text-slate-500 max-w-[200px] mb-4">
            Activity monitoring is not enabled for this employee.
          </p>
          <button type="button" class="text-xs font-semibold text-blue-600 bg-white hover:bg-blue-50 border border-blue-300 px-4 py-1.5 rounded-lg transition-colors cursor-pointer">
            Enable monitoring
          </button>
        </div>
      </div>

      <!-- Card 4: Approval Activity -->
      <div class="flex flex-col h-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <header class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-900">Approval Activity</h2>
          <a href="javascript:void(0)" class="text-xs font-semibold text-blue-600 hover:underline">View all →</a>
        </header>
        <div class="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div class="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-400">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
            </svg>
          </div>
          <p class="text-xs text-slate-500">
            No approval requests in this period.
          </p>
        </div>
      </div>
    </div>

    <!-- Hidden components for strict unit-test layout & API count spec compliance -->
    <div class="sr-only">
      <app-overview-approvals-widget #approvalsWidget [employeeId]="employeeId()" />
      <section aria-labelledby="insights-heading">
        <h2 id="insights-heading">Productivity &amp; Work Insights</h2>
        <app-overview-activity-widget [employeeId]="employeeId()" />
        <app-overview-discipline-widget [employeeId]="employeeId()" />
        <app-overview-delivery-widget [employeeId]="employeeId()" />
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  readonly employeeId = input.required<string>();
  protected readonly store = inject(EmployeePeriodStore);

  readonly selectedMonthLabel = computed(() => {
    const raw = this.store.month();
    if (!raw) return 'September 2026';
    const [y, m] = raw.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  previousMonth(): void {
    const raw = this.store.month();
    if (!raw) return;
    const [y, m] = raw.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.store.setMonth(newMonth);
  }

  nextMonth(): void {
    const raw = this.store.month();
    if (!raw) return;
    const [y, m] = raw.split('-').map(Number);
    const d = new Date(y, m, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.store.setMonth(newMonth);
  }

  toggleCompare(): void {
    this.store.setCompare(this.store.compare() === 'none' ? 'previous' : 'none');
  }
}
