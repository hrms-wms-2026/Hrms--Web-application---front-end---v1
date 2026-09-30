import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatHours, formatLeaveRange } from '../../utils/employee-overview.utils';

/** Year-based: intentionally independent of the month period, so it never refetches on a month change. */
@Component({
  selector: 'app-overview-time-off-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Time Off"
      [state]="loader.state()"
      errorMessage="Could not load time off."
      emptyMessage="No leave entitlements for this year."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="space-y-3">
          @for (b of d.balances; track b.leaveTypeId) {
            <li class="flex items-baseline justify-between gap-3 text-sm" data-testid="balance-row">
              <span class="text-[var(--color-text-secondary)]">{{ b.leaveTypeName }}</span>
              <span class="text-right">
                <span class="font-semibold" [class.text-[var(--color-danger-text)]]="b.isNegative" [class.text-[var(--color-text-primary)]]="!b.isNegative">
                  @if (b.isNegative) { {{ hours(-b.remainingHours) }} overdrawn } @else { {{ hours(b.remainingHours) }} }
                </span>
                <span class="block text-xs text-[var(--color-text-secondary)]">of {{ hours(b.entitledHours) }}</span>
              </span>
            </li>
          }
        </ul>

        @if (d.nextLeave; as next) {
          <div class="mt-4 rounded-lg bg-[var(--color-surface-secondary)] p-3 text-sm" data-testid="next-leave">
            <p class="text-xs text-[var(--color-text-secondary)]">Next leave</p>
            <p class="font-semibold text-[var(--color-text-primary)]">{{ range(next.startDate, next.endDate) }}</p>
            <p class="text-xs text-[var(--color-text-secondary)]">{{ next.leaveTypeName || 'Leave' }} · {{ hours(next.totalHours) }}</p>
          </div>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewTimeOffWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() => this.api.getOverviewTimeOff(this.employeeId()), {
    isEmpty: (v) => v.balances.length === 0 && v.nextLeave === null
  });

  hours = formatHours;
  range = formatLeaveRange;
}
