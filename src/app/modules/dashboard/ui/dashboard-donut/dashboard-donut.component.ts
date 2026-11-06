import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { DASHBOARD_DONUT_PX, donutValueFontPx } from '../../utils/dashboard-donut.util';
import { donutArcs } from '../../utils/status-donut.util';
import { formatPercent } from '../../utils/team-progress-format.util';

/** One slice of a dashboard donut. */
export interface DashboardDonutSlice {
  readonly key: string;
  readonly label: string;
  /** Size of the slice (hours, people, tasks). Zero or less draws no arc. */
  readonly value: number;
  /** The value as the hover centre shows it ("12.5 h", "3"); the plain number when left out. */
  readonly valueText?: string;
  /** The share as shown ("12%"); the slice's share of all the slices when left out (a widget whose share is
   * of something else, like an allocation, passes its own). */
  readonly percentText?: string;
  readonly color: string;
}

/** A slice's share as shown: its own percentText, else its part of the slices' total. */
export function donutSliceShare(slice: DashboardDonutSlice, slices: readonly DashboardDonutSlice[]): string {
  if (slice.percentText !== undefined) return slice.percentText;
  return formatPercent(slice.value, slices.reduce((sum, s) => sum + Math.max(0, s.value), 0));
}

/**
 * The one donut every dashboard widget and popup draws (2026-11-06). The ring is the slices in order from
 * 12 o'clock. Hovering a slice, or setting `active` from a legend row, lifts that slice, fades the rest and
 * puts its value, name and share in the centre; otherwise the centre shows the projected content (each widget's
 * own figure). `active` is two-way, so a widget's colour key and the donut light the same slice.
 *
 * Usage: `<app-dashboard-donut [slices]="slices()" [(active)]="hovered" ariaLabel="…">centre</app-dashboard-donut>`
 */
@Component({
  selector: 'app-dashboard-donut',
  standalone: true,
  templateUrl: './dashboard-donut.component.html',
  styleUrl: './dashboard-donut.component.css',
  host: {
    class: 'dd',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '(mouseleave)': 'active.set(null)'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardDonutComponent {
  readonly slices = input.required<readonly DashboardDonutSlice[]>();
  readonly ariaLabel = input.required<string>();
  /** Diameter in px: DASHBOARD_DONUT_PX by default (dashboardDonutPx(view) on a card with a mini view). */
  readonly size = input(DASHBOARD_DONUT_PX);
  /** Ring thickness in viewBox units (the box is 42 wide). */
  readonly strokeWidth = input(6);
  /** The slice under the pointer or picked from a legend row; null shows the projected centre. */
  readonly active = model<string | null>(null);

  protected readonly arcs = computed(() =>
    donutArcs(this.slices().map((s) => ({ key: s.key, count: s.value, color: s.color })))
  );

  /** The lit slice: only one that draws an arc. */
  protected readonly activeSlice = computed(() => {
    const key = this.active();
    return key === null ? null : (this.slices().find((s) => s.key === key && s.value > 0) ?? null);
  });

  protected valueText(slice: DashboardDonutSlice): string {
    return slice.valueText ?? String(slice.value);
  }

  protected share(slice: DashboardDonutSlice): string {
    return donutSliceShare(slice, this.slices());
  }

  protected readonly valueFontPx = donutValueFontPx;
}
