import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatDateWithYear } from '../../utils/employee-overview.utils';

const HISTORY_LIMIT = 10;

/**
 * Lifetime timeline of recorded employment events. Employment status/type/work-mode changes are
 * not recorded anywhere, so they cannot appear here.
 */
@Component({
  selector: 'app-overview-history-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Employee History"
      [state]="loader.state()"
      errorMessage="Could not load employee history."
      emptyMessage="No history recorded yet."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ol class="relative ml-2 space-y-4 border-l border-[var(--color-border)] pl-4">
          @for (event of d.events; track $index) {
            <li class="relative text-sm" data-testid="history-event">
              <span class="dot" aria-hidden="true"></span>
              <p class="font-medium text-[var(--color-text-primary)]">{{ event.title }}</p>
              @if (event.detail) {
                <p class="text-xs text-[var(--color-text-secondary)]" data-testid="history-detail">{{ event.detail }}</p>
              }
              <p class="text-xs text-[var(--color-text-secondary)]">{{ dated(event.date) }}</p>
            </li>
          }
        </ol>
      }
    </app-widget-card>
  `,
  styles: [`
    .dot { position: absolute; left: -1.3125rem; top: 0.3rem; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: var(--color-accent); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewHistoryWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewHistory(this.employeeId(), HISTORY_LIMIT),
    { isEmpty: (v) => v.events.length === 0 }
  );

  dated = formatDateWithYear;
}
