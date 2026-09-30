import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LinePoint {
  readonly label: string;
  readonly value: number;
}

const WIDTH = 600;
const HEIGHT = 110;
const PAD_X = 16;

/** Area line chart with point markers and a left tick axis (Productivity trend). */
@Component({
  selector: 'app-line-chart',
  standalone: true,
  template: `
    <figure class="line" [attr.aria-label]="ariaLabel()">
      <div class="line__body">
        <div class="line__axis" aria-hidden="true">
          @for (tick of reversedTicks(); track tick) {
            <span>{{ tick }}</span>
          }
        </div>
        <svg class="line__svg" [attr.viewBox]="'0 0 ' + width + ' ' + height" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="line-area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#3b6fe0" stop-opacity="0.28" />
              <stop offset="100%" stop-color="#3b6fe0" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          @for (y of gridLines(); track y) {
            <line x1="0" [attr.y1]="y" [attr.x2]="width" [attr.y2]="y" stroke="#eef1f6" stroke-width="1" />
          }
          <path [attr.d]="areaPath()" fill="url(#line-area-fill)" />
          <path [attr.d]="linePath()" fill="none" stroke="#2f5fd6" stroke-width="2.5" vector-effect="non-scaling-stroke" />
        </svg>
        <div class="line__dots" aria-hidden="true">
          @for (p of coords(); track $index) {
            <span class="line__dot" [style.left.%]="(p.x / width) * 100" [style.top.%]="(p.y / height) * 100"></span>
          }
        </div>
      </div>
      <div class="line__labels" aria-hidden="true">
        @for (p of coords(); track $index) {
          <span [style.left.%]="(p.x / width) * 100">{{ p.label }}</span>
        }
      </div>
    </figure>
  `,
  styles: [`
    :host { display: block; }
    .line { margin: 0; }
    .line__body { position: relative; display: flex; gap: 0.5rem; height: 6.5rem; }
    .line__axis { display: flex; flex-direction: column; justify-content: space-between; font-size: 0.6875rem; color: var(--color-text-secondary); text-align: right; min-width: 1.5rem; }
    .line__svg { flex: 1; width: 100%; height: 100%; overflow: visible; }
    .line__dots { position: absolute; inset: 0 0 0 2rem; pointer-events: none; }
    .line__dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 9999px; background: #2f5fd6; box-shadow: 0 0 0 2px var(--color-surface); }
    .line__labels { position: relative; height: 1rem; margin: 0.25rem 0 0 2rem; font-size: 0.6875rem; color: var(--color-text-secondary); }
    .line__labels span { position: absolute; transform: translateX(-50%); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LineChartComponent {
  readonly points = input.required<readonly LinePoint[]>();
  readonly yTicks = input<readonly number[]>([0, 25, 50, 75, 100]);
  readonly ariaLabel = input('Trend');

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  readonly reversedTicks = computed(() => [...this.yTicks()].reverse());
  readonly gridLines = computed(() => {
    const n = this.yTicks().length;
    return n > 1 ? this.yTicks().map((_, i) => (HEIGHT / (n - 1)) * i) : [];
  });
  readonly coords = computed(() => {
    const pts = this.points();
    const max = Math.max(...this.yTicks(), 1);
    const min = Math.min(...this.yTicks(), 0);
    const span = pts.length > 1 ? (WIDTH - PAD_X * 2) / (pts.length - 1) : 0;
    return pts.map((p, i) => ({
      label: p.label,
      x: PAD_X + span * i,
      y: HEIGHT - ((p.value - min) / (max - min || 1)) * HEIGHT
    }));
  });
  readonly linePath = computed(() => this.coords().map((c, i) => `${i ? 'L' : 'M'}${c.x},${c.y}`).join(' '));
  readonly areaPath = computed(() => {
    const c = this.coords();
    if (!c.length) return '';
    return `${this.linePath()} L${c[c.length - 1].x},${HEIGHT} L${c[0].x},${HEIGHT} Z`;
  });
}
