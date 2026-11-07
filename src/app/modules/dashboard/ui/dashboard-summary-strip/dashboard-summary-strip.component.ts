import { ChangeDetectionStrategy, Component, computed, effect, input, model, output } from '@angular/core';
import { SummaryCardModel } from '../../models/summary-card.model';
import { DASHBOARD_MINI_DONUT_PX } from '../../utils/dashboard-donut.util';
import { injectHostSize } from '../../utils/host-size.util';
import { SUMMARY_STRIP_PX, SummaryStripPlan, planSummaryStrip } from '../../utils/summary-strip-layout.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../dashboard-donut/donut-key.component';
import { DashboardSummaryCardComponent } from '../dashboard-summary-card/dashboard-summary-card.component';

/**
 * The 2-row view every dashboard widget shares (design 2026-11-07): the mini donut, then its colour key once
 * there is room, then as many summary cards as fit (planSummaryStrip). It measures its own width, so a widget
 * only passes its slices and card models. Project the donut's centre content.
 *
 * Usage: `<app-dashboard-summary-strip [slices] [keySlices] [cards] donutLabel="…" [(active)]="hovered"
 * (cardOpened)="openDetail($event)" (shownCards)="shown.set($event)">centre</app-dashboard-summary-strip>`
 */
@Component({
  selector: 'app-dashboard-summary-strip',
  standalone: true,
  imports: [DashboardDonutComponent, DonutKeyComponent, DashboardSummaryCardComponent],
  templateUrl: './dashboard-summary-strip.component.html',
  styleUrl: './dashboard-summary-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardSummaryStripComponent {
  readonly slices = input.required<readonly DashboardDonutSlice[]>();
  readonly keySlices = input.required<readonly DashboardDonutSlice[]>();
  readonly cards = input.required<readonly SummaryCardModel[]>();
  readonly donutLabel = input.required<string>();
  /** The lit slice, shared by the donut and its key. */
  readonly active = model<string | null>(null);
  /** The popup section a clicked card summarises. */
  readonly cardOpened = output<string>();
  /** The id of a card whose Try again was pressed. */
  readonly cardRetried = output<string>();
  /** How many cards are shown, whenever that changes, so a widget can load a card's data only once it is seen. */
  readonly shownCards = output<number>();

  protected readonly donutPx = DASHBOARD_MINI_DONUT_PX;
  private readonly size = injectHostSize();
  private previous: SummaryStripPlan | null = null;
  private emitted = -1;

  protected readonly plan = computed(() => {
    // The strip fills the card's body; the plan's thresholds are in widget host widths (body + card padding).
    const width = this.size().width;
    const plan = planSummaryStrip(width > 0 ? width + SUMMARY_STRIP_PX.chrome : 0, this.cards().length, this.previous);
    // Only a measured plan is sticky: the first real size picks its plan with no hysteresis.
    if (width > 0) this.previous = plan;
    return plan;
  });

  protected readonly shown = computed(() => this.cards().slice(0, this.plan().cards));

  constructor() {
    effect(() => {
      const count = this.plan().cards;
      if (count === this.emitted) return;
      this.emitted = count;
      this.shownCards.emit(count);
    });
  }
}
