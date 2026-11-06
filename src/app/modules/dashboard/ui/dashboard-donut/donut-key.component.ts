import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { DashboardDonutSlice, donutSliceShare } from './dashboard-donut.component';

/** How the key lays out its rows. */
export type DonutKeyVariant = 'list' | 'compact' | 'wrap' | 'chips';

/**
 * The colour key that goes with a dashboard donut (2026-11-06): one row per slice with its dot, its name, its
 * share right beside the name ("Completed 12%") and, when `showValue`, its value at the end. Hovering a row
 * sets `active`, which the donut shares, so the slice lights and the centre reads it.
 *
 * Variants: `list` (default) is one 28px row per slice, the height every widget's layout budgets with
 * (DASHBOARD_DONUT_LEGEND_ROW_PX); `compact` is a short column with small gaps (beside a 2x2 donut); `wrap` puts the rows side by side and wraps (2-row cards); `chips` gives each
 * row a soft background (beside the donut on a wide card).
 *
 * Usage: `<app-donut-key [slices]="slices()" [(active)]="hovered" />` next to
 * `<app-dashboard-donut [slices]="slices()" [(active)]="hovered">`.
 */
@Component({
  selector: 'app-donut-key',
  standalone: true,
  templateUrl: './donut-key.component.html',
  styleUrl: './donut-key.component.css',
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DonutKeyComponent {
  readonly slices = input.required<readonly DashboardDonutSlice[]>();
  /** The slice the donut lights; shared with the donut through two-way binding. */
  readonly active = model<string | null>(null);
  /** Shows each slice's value at the end of its row. */
  readonly showValue = input(false);
  readonly variant = input<DonutKeyVariant>('list');
  readonly ariaLabel = input('');
  /** data-testid of each row; `<id>-percent` and `<id>-value` mark its share and value. */
  readonly rowTestId = input('donut-key-row');
  /** Appends each slice's key to its row's test id (`wbl-count-working`). */
  readonly keyedTestIds = input(false);

  protected testId(slice: DashboardDonutSlice): string {
    return this.keyedTestIds() ? `${this.rowTestId()}-${slice.key}` : this.rowTestId();
  }

  protected valueText(slice: DashboardDonutSlice): string {
    return slice.valueText ?? String(slice.value);
  }

  protected share(slice: DashboardDonutSlice): string {
    return donutSliceShare(slice, this.slices());
  }
}
