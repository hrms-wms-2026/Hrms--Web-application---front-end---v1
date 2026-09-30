import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarDatum {
  readonly label: string;
  readonly value: number;
}

/** Minimal CSS bar chart for the Work & Activity cards (the spec allows no chart library). */
@Component({
  selector: 'app-work-activity-bar-chart',
  standalone: true,
  template: `
    <div role="img" [attr.aria-label]="summary()" class="flex h-32 items-end gap-1.5">
      @for (bar of scaled(); track bar.label) {
        <div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <div class="flex w-full flex-1 items-end">
            <div
              data-testid="bar"
              class="w-full rounded-t bg-[var(--color-accent)] opacity-80"
              [style.height]="bar.height"
              [attr.title]="bar.label + ': ' + bar.value"
            ></div>
          </div>
          <span class="truncate text-[11px] text-[var(--color-text-secondary)]">{{ bar.label }}</span>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkActivityBarChartComponent {
  readonly bars = input.required<readonly BarDatum[]>();
  readonly ariaLabel = input.required<string>();

  readonly scaled = computed(() => {
    const max = Math.max(0, ...this.bars().map((b) => b.value));
    return this.bars().map((b) => ({ ...b, height: `${max === 0 ? 0 : Math.round((b.value / max) * 100)}%` }));
  });

  readonly summary = computed(
    () => `${this.ariaLabel()}. ${this.bars().map((b) => `${b.label}: ${b.value}`).join(', ')}`
  );
}
