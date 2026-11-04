import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { donutArcs } from '../../utils/status-donut.util';
import { formatPercent } from '../../utils/team-progress-format.util';

export interface DonutSlice {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** The value as shown ("3", "7h 52m"). */
  readonly valueText: string;
  readonly color: string;
}

/** The ring's gap between two slices, on a circumference of 100; a lone slice closes the ring. */
const GAP = 0.8;

/**
 * A donut with its legend: hovering or focusing a slice or legend row lights that slice and puts its value in the
 * centre; otherwise the centre shows the whole. Zero slices stay in the legend but draw no arc. The fixed dashboard
 * donut size (140px), the same stroke geometry as the Team Progress donut.
 */
@Component({
  selector: 'app-donut-breakdown',
  standalone: true,
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

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly active = signal<string | null>(null);

  private readonly total = computed(() =>
    this.slices().reduce((n, s) => n + Math.max(0, s.value), 0),
  );

  protected readonly arcs = computed(() => {
    const arcs = donutArcs(
      this.slices().map((s) => ({ key: s.key, count: s.value, color: s.color })),
    );
    const gap = arcs.length > 1 ? GAP : 0;
    return arcs.map((a) => ({
      ...a,
      dash: `${Math.max(0.01, a.length - gap)} ${100 - a.length + gap}`,
    }));
  });

  protected readonly activeSlice = computed(
    () => this.slices().find((s) => s.key === this.active()) ?? null,
  );

  protected share(slice: DonutSlice): string {
    return formatPercent(slice.value, this.total());
  }

  protected labelOf(key: string): string {
    const slice = this.slices().find((s) => s.key === key);
    return slice ? `${slice.label}: ${slice.valueText} (${this.share(slice)})` : '';
  }

  protected setActive(key: string | null): void {
    this.active.set(key);
  }
}
