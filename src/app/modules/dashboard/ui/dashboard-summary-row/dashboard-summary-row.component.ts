import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SummaryCardModel } from '../../models/summary-card.model';
import { DashboardSummaryCardComponent } from '../dashboard-summary-card/dashboard-summary-card.component';

/**
 * A taller dashboard view's row of summary cards, in the KPI tiles' place (summary-row.util decides which cards and
 * whether the row replaces the tiles at all). Equal columns, SUMMARY_ROW_PX tall.
 */
@Component({
  selector: 'app-dashboard-summary-row',
  standalone: true,
  imports: [DashboardSummaryCardComponent],
  template: `
    <div class="sr" data-testid="summary-row" [style.grid-template-columns]="'repeat(' + cards().length + ', minmax(0, 1fr))'">
      @for (card of cards(); track card.id; let i = $index) {
        <app-dashboard-summary-card [card]="card" [index]="i" (opened)="cardOpened.emit($event)" (retried)="cardRetried.emit(card.id)" />
      }
    </div>
  `,
  styleUrl: './dashboard-summary-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardSummaryRowComponent {
  readonly cards = input.required<readonly SummaryCardModel[]>();
  /** The popup section a clicked card summarises. */
  readonly cardOpened = output<string>();
  /** The id of a card whose Try again was pressed. */
  readonly cardRetried = output<string>();
}
