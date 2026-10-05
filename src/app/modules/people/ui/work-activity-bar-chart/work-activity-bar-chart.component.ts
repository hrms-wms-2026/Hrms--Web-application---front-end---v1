import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarDatum {
  readonly label: string;
  readonly value: number;
  /** Optional second line under the label (e.g. a day range), like the Overview trend chart. */
  readonly sublabel?: string;
}

/**
 * CSS bar chart for the Work & Activity cards (the spec allows no chart library), drawn like the
 * Overview tab's trend chart: a fixed-height plot with slate grid lines, value labels on the
 * y-axis and solid blue bars over bold x-axis labels.
 */
@Component({
  selector: 'app-work-activity-bar-chart',
  standalone: true,
  template: `
    <div role="img" [attr.aria-label]="summary()">
      <div class="relative ml-9 mr-1 h-36">
        <div class="pointer-events-none absolute inset-0 font-mono text-[11px] text-slate-400" aria-hidden="true">
          @for (tick of ticks(); track $index; let last = $last) {
            <div
              class="absolute left-0 right-0 border-t"
              [class.border-slate-100]="!last"
              [class.border-slate-200]="last"
              [style.top.%]="tick.top"
            >
              <span class="absolute right-full mr-2 w-8 -translate-y-1/2 text-right">{{ tick.label }}</span>
            </div>
          }
        </div>

        <div class="relative z-10 flex h-full items-end justify-around gap-1">
          @for (bar of scaled(); track bar.label) {
            <div class="flex h-full min-w-0 max-w-[3.5rem] flex-1 items-end justify-center">
              <div
                data-testid="bar"
                class="w-full max-w-7 rounded-t-sm bg-blue-600 transition-all duration-300 hover:brightness-110"
                [style.height]="bar.height"
                [style.minHeight.px]="bar.value > 0 ? 4 : 0"
                [attr.title]="bar.label + ': ' + bar.value"
              ></div>
            </div>
          }
        </div>
      </div>

      <div class="ml-9 mr-1 mt-2 flex justify-around gap-1" aria-hidden="true">
        @for (bar of bars(); track bar.label) {
          <div class="min-w-0 max-w-[3.5rem] flex-1 text-center">
            <span class="block truncate text-[11px] font-bold text-slate-800">{{ bar.label }}</span>
            @if (bar.sublabel) {
              <span class="mt-0.5 block truncate text-[11px] text-slate-400">{{ bar.sublabel }}</span>
            }
          </div>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkActivityBarChartComponent {
  readonly bars = input.required<readonly BarDatum[]>();
  readonly ariaLabel = input.required<string>();
  /** Formats the y-axis tick values (e.g. minutes as '1h'). */
  readonly formatTick = input<(value: number) => string>((value) => String(value));

  private readonly max = computed(() => Math.max(0, ...this.bars().map((b) => b.value)));

  readonly scaled = computed(() => {
    const max = this.max();
    return this.bars().map((b) => ({ ...b, height: `${max === 0 ? 0 : Math.round((b.value / max) * 100)}%` }));
  });

  /** Top, middle and zero grid lines, labelled with the values they stand for. */
  readonly ticks = computed(() => {
    const max = this.max();
    const fmt = this.formatTick();
    return [
      { top: 0, label: max === 0 ? '' : fmt(max) },
      { top: 50, label: max === 0 ? '' : fmt(Math.round(max / 2)) },
      { top: 100, label: fmt(0) }
    ];
  });

  readonly summary = computed(
    () => `${this.ariaLabel()}. ${this.bars().map((b) => `${b.label}: ${b.value}`).join(', ')}`
  );
}
