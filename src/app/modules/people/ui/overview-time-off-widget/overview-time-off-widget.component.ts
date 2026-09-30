import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeTimeOffBalance } from '../../models/employee-overview.model';
import { formatHours, formatLeaveRange } from '../../utils/employee-overview.utils';

/** Year-based: intentionally independent of the month period, so it never refetches on a month change. */
@Component({
  selector: 'app-overview-time-off-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  host: { class: 'block h-full' },
  template: `
    <app-widget-card
      title="Time Off Balance"
      [state]="loader.state()"
      errorMessage="Could not load time off."
      emptyMessage="No leave entitlements for this year."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        @if (d.balances.length > 3) {
          <button
            widget-actions
            type="button"
            class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            (click)="toggleShowAll()"
          >
            {{ showAll() ? 'Show less' : 'See all (' + d.balances.length + ')' }}
          </button>
        }

        <div class="flex-1 flex flex-col justify-between">
          <!-- 3 Circular Balance Rings (Shows 3 normally, all if expanded) -->
          <div class="grid grid-cols-3 gap-2 py-3">
            @for (b of displayedBalances(d.balances); track b.leaveTypeId; let idx = $index) {
              <div class="flex flex-col items-center text-center" data-testid="balance-row">
                <div class="relative w-20 h-20 my-1">
                  <svg viewBox="0 0 36 36" class="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="14.5" fill="none" class="stroke-slate-100" stroke-width="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="14.5"
                      fill="none"
                      [attr.stroke]="getRingStroke(b, idx)"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-dasharray="91.1 91.1"
                      [attr.stroke-dashoffset]="getRingDashoffset(b)"
                      class="transition-all duration-500"
                    />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1">
                    <span class="text-base font-bold text-slate-900 leading-tight">
                      @if (b.isNegative) { {{ hours(-b.remainingHours) }} overdrawn } @else { {{ hours(b.remainingHours) }} }
                    </span>
                    <span class="text-[10px] text-slate-400 mt-0.5">of {{ hours(b.entitledHours) }}</span>
                  </div>
                </div>
                <span class="text-xs font-bold text-slate-800 mt-2 block truncate max-w-full" [title]="b.leaveTypeName">
                  {{ b.leaveTypeName }}
                </span>
              </div>
            }
          </div>

          @if (d.nextLeave; as next) {
            <div class="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm flex items-center justify-between" data-testid="next-leave">
              <div>
                <p class="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Next Leave Scheduled</p>
                <p class="font-bold text-slate-900 mt-0.5">{{ range(next.startDate, next.endDate) }}</p>
                <p class="text-xs text-slate-500">{{ next.leaveTypeName || 'Leave' }} · {{ hours(next.totalHours) }}</p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Approved
              </span>
            </div>
          }
        </div>
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTimeOffWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();
  readonly showAll = signal(false);

  readonly loader = createWidgetLoader(() => this.api.getOverviewTimeOff(this.employeeId()), {
    isEmpty: (v) => v.balances.length === 0 && v.nextLeave === null
  });

  hours = formatHours;
  range = formatLeaveRange;

  displayedBalances(balances: readonly EmployeeTimeOffBalance[]): readonly EmployeeTimeOffBalance[] {
    return this.showAll() ? balances : balances.slice(0, 3);
  }

  toggleShowAll(): void {
    this.showAll.update((v) => !v);
  }

  getRingStroke(b: EmployeeTimeOffBalance, index: number): string {
    if (b.isNegative) return '#e11d48'; // rose-600
    const colors = ['#059669', '#2563eb', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'];
    return colors[index % colors.length];
  }

  getRingDashoffset(b: EmployeeTimeOffBalance): number {
    const circumference = 91.1; // 2 * PI * 14.5
    if (b.isNegative || b.entitledHours <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, b.remainingHours / b.entitledHours));
    return circumference * (1 - ratio);
  }
}
