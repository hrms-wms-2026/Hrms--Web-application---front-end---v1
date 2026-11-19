import { ChangeDetectionStrategy, Component } from '@angular/core';

type SkeletonBody = 'donut' | 'bars' | 'tiles' | 'list';

interface SkeletonCard {
  /** Columns and rows on the 12-column desktop grid. */
  readonly w: number;
  readonly h: number;
  readonly body: SkeletonBody;
}

/** A typical first screen: two charts, the pinned Quick Actions corner, then a ranking and a trend. */
const CARDS: readonly SkeletonCard[] = [
  { w: 4, h: 3, body: 'donut' },
  { w: 5, h: 3, body: 'bars' },
  { w: 3, h: 3, body: 'tiles' },
  { w: 6, h: 4, body: 'list' },
  { w: 6, h: 4, body: 'bars' }
];

/**
 * Placeholder for the dashboard while its layout loads: grey widget cards on the same grid as the real dashboard
 * (12 columns, 96px rows, 12px gap), so the page keeps its shape instead of showing a spinner. Narrower containers
 * drop to 6 columns, then one column with three cards. The shimmer stops under prefers-reduced-motion.
 */
@Component({
  selector: 'app-dashboard-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  templateUrl: './dashboard-skeleton.component.html',
  styleUrl: './dashboard-skeleton.component.css'
})
export class DashboardSkeletonComponent {
  protected readonly cards = CARDS;
  protected readonly bars = [62, 88, 45, 74, 56, 93, 38];
  protected readonly rows = [0, 1, 2, 3, 4];
}
