import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeUpcomingItem, EmployeeUpcomingKind } from '../../models/employee-overview.model';
import { formatUpcomingWhen } from '../../utils/employee-overview.utils';

const UPCOMING_DAYS = 14;

const CHIP_LABELS: Record<EmployeeUpcomingKind, string> = {
  calendar: 'Calendar',
  leave: 'Approved',
  release: 'Release'
};

/** Forward-looking: not period-aware, so it never refetches when the month changes. */
@Component({
  selector: 'app-overview-upcoming-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Upcoming Items"
      [state]="loader.state()"
      errorMessage="Could not load upcoming items."
      emptyMessage="Nothing coming up in the next 14 days."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of d.items; track $index) {
            <li class="flex items-start justify-between gap-3 py-2 text-sm" data-testid="upcoming-item">
              <div class="min-w-0">
                <p class="truncate font-medium text-[var(--color-text-primary)]">{{ item.title }}</p>
                <p class="text-xs text-[var(--color-text-secondary)]">
                  {{ when(item) }}@if (item.detail && item.kind !== 'leave') { · {{ item.detail }} }
                </p>
              </div>
              <span class="chip" data-testid="upcoming-chip" [class]="'chip--' + item.kind">{{ chip(item.kind) }}</span>
            </li>
          }
        </ul>
      }
    </app-widget-card>
  `,
  styles: [`
    .chip { flex-shrink: 0; border-radius: 9999px; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; }
    .chip--calendar { background: #dbeafe; color: #1e40af; }
    .chip--leave { background: #dcfce7; color: #166534; }
    .chip--release { background: #ede9fe; color: #5b21b6; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewUpcomingWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewUpcoming(this.employeeId(), UPCOMING_DAYS),
    { isEmpty: (v) => v.items.length === 0 }
  );

  when(item: EmployeeUpcomingItem): string {
    return formatUpcomingWhen(item);
  }

  chip(kind: EmployeeUpcomingKind): string {
    return CHIP_LABELS[kind];
  }
}
