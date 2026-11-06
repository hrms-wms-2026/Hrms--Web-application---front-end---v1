import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DashboardDonutComponent, DashboardDonutSlice } from '../dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../dashboard-donut/donut-key.component';

/** A slice of the breakdown: the shared dashboard donut slice, with its value text always given. */
export interface DonutSlice extends DashboardDonutSlice {
  /** The value as shown ("3", "7h 52m"). */
  readonly valueText: string;
}

/**
 * A donut with its key beside it, for popups: the shared dashboard donut and donut key (hovering a slice or a
 * key row lights that slice and puts its value in the centre; otherwise the centre shows the whole). Zero
 * slices stay in the key but draw no arc.
 */
@Component({
  selector: 'app-donut-breakdown',
  standalone: true,
  imports: [DashboardDonutComponent, DonutKeyComponent],
  templateUrl: './donut-breakdown.component.html',
  styleUrl: './donut-breakdown.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonutBreakdownComponent {
  readonly slices = input.required<readonly DonutSlice[]>();
  readonly centerValue = input.required<string>();
  readonly centerLabel = input.required<string>();
  readonly ariaLabel = input.required<string>();

  /** The lit slice, shared by the donut and its key. */
  protected readonly active = signal<string | null>(null);
}
