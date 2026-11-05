import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '../icon/icon.component';

export type MetricStatTone = 'blue' | 'green' | 'amber' | 'red' | 'violet';

/** Fixed hex per tone (not the tenant-configurable --color-accent) so Assigned/Completed/In-progress/
 * Overdue/Story-points stay visually distinct regardless of the active theme preset. Mirrors the
 * raw-hex precedent already used for the completed/in-progress/overdue segments in
 * OverviewWorkWidgetComponent's progress bar. */
const TONE_HEX: Record<MetricStatTone, string> = {
  blue: 'var(--color-cat-blue)',
  green: 'var(--color-cat-green)',
  amber: 'var(--color-cat-amber)',
  red: 'var(--color-cat-red)',
  violet: 'var(--color-cat-violet)'
};

/** One icon-badge stat: a colored round icon plus a value/label pair. Used by cards that show a row of period metrics (Work Summary, Recorded Activity). */
@Component({
  selector: 'app-metric-stat',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex min-w-0 items-center gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        [style.backgroundColor]="badgeBackground()"
        [style.color]="badgeColor()"
      >
        <app-icon [name]="icon()" />
      </div>
      <div class="min-w-0">
        <p class="truncate text-xl font-semibold leading-tight text-[var(--color-text-primary)]" data-testid="metric-stat-value">{{ value() }}</p>
        <p class="truncate text-xs text-[var(--color-text-secondary)]">{{ label() }}</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricStatComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly tone = input<MetricStatTone>('blue');

  readonly badgeColor = computed(() => TONE_HEX[this.tone()]);
  readonly badgeBackground = computed(() => `color-mix(in srgb, ${this.badgeColor()} 15%, transparent)`);
}
