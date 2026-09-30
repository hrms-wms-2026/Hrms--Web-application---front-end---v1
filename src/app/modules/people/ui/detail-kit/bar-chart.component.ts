import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BarTone = 'success' | 'success-soft' | 'warning' | 'danger' | 'muted' | 'accent';

export interface ChartBar {
  readonly value: number;
  readonly label: string;
  readonly tone?: BarTone;
}

/**
 * Plain CSS column chart. `yTicks` draws a left axis (Delivery Health / Recorded Activity);
 * without it the bars fill the height (Attendance day strip). `axisLabels` are placed under
 * evenly spaced bars by index.
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <figure class="chart" [attr.aria-label]="ariaLabel()">
      <div class="chart__body" [style.height.px]="height()">
        @if (yTicks().length) {
          <div class="chart__axis" aria-hidden="true">
            @for (tick of reversedTicks(); track tick) {
              <span>{{ tick }}</span>
            }
          </div>
        }
        <div class="chart__plot" [class.chart__plot--grid]="yTicks().length > 0" [style.gap.px]="gap()">
          @for (bar of scaled(); track $index) {
            <span class="chart__bar" [attr.data-tone]="bar.tone" [style.height.%]="bar.height" [attr.title]="bar.label + ': ' + bar.value"></span>
          }
        </div>
      </div>
      @if (axisLabels().length) {
        <div class="chart__labels" [class.chart__labels--offset]="yTicks().length > 0" aria-hidden="true">
          @for (label of axisLabels(); track $index) {
            <span>{{ label }}</span>
          }
        </div>
      }
    </figure>
  `,
  styles: [`
    :host { display: block; }
    .chart { margin: 0; }
    .chart__body { display: flex; gap: 0.5rem; }
    .chart__axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 0.6875rem; color: var(--color-text-secondary); text-align: right; min-width: 1.25rem; }
    .chart__plot { flex: 1; display: flex; align-items: flex-end; min-width: 0; }
    .chart__plot--grid { border-bottom: 1px solid var(--color-border); background: repeating-linear-gradient(to top, transparent 0, transparent calc(33.333% - 1px), #eef1f6 calc(33.333% - 1px), #eef1f6 33.333%); }
    .chart__bar { flex: 1; min-width: 3px; border-radius: 3px 3px 0 0; background: #93b4f5; }
    .chart__bar[data-tone='accent'] { background: linear-gradient(to top, #8fb0f7, #5b8def); }
    .chart__bar[data-tone='success'] { background: #22c55e; border-radius: 3px; }
    .chart__bar[data-tone='success-soft'] { background: #86dfa4; border-radius: 3px; }
    .chart__bar[data-tone='warning'] { background: #f59e0b; border-radius: 3px; }
    .chart__bar[data-tone='danger'] { background: #ef4444; border-radius: 3px; }
    .chart__bar[data-tone='muted'] { background: #eef1f6; border-radius: 3px; }
    .chart__labels { display: flex; justify-content: space-between; margin-top: 0.375rem; font-size: 0.6875rem; color: var(--color-text-secondary); }
    .chart__labels--offset { padding-left: 1.75rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarChartComponent {
  readonly bars = input.required<readonly ChartBar[]>();
  readonly axisLabels = input<readonly string[]>([]);
  readonly yTicks = input<readonly number[]>([]);
  readonly height = input(120);
  readonly gap = input(4);
  readonly defaultTone = input<BarTone>('accent');
  readonly ariaLabel = input('Bar chart');

  readonly reversedTicks = computed(() => [...this.yTicks()].reverse());
  readonly scaled = computed(() => {
    const ticks = this.yTicks();
    const max = ticks.length ? Math.max(...ticks) : Math.max(1, ...this.bars().map((b) => b.value));
    return this.bars().map((bar) => ({
      ...bar,
      tone: bar.tone ?? this.defaultTone(),
      height: max > 0 ? Math.min(100, (bar.value / max) * 100) : 0
    }));
  });
}
