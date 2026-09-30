import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type SegmentTone = 'success' | 'info' | 'neutral' | 'danger' | 'warning' | 'accent';

export interface BarSegment {
  readonly value: number;
  readonly tone: SegmentTone;
  readonly label: string;
}

/** Horizontal stacked bar (Work Management status split) or a single progress track. */
@Component({
  selector: 'app-segmented-bar',
  standalone: true,
  template: `
    <div class="track" role="img" [attr.aria-label]="ariaLabel()" [style.height.px]="height()">
      @for (segment of widths(); track $index) {
        <span class="segment" [attr.data-tone]="segment.tone" [style.width.%]="segment.width"></span>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .track { display: flex; width: 100%; overflow: hidden; border-radius: 9999px; background: #e8edf5; }
    .segment { height: 100%; }
    .segment[data-tone='success'] { background: #22c55e; }
    .segment[data-tone='info'] { background: #3b82f6; }
    .segment[data-tone='accent'] { background: var(--color-accent); }
    .segment[data-tone='neutral'] { background: #7c8799; }
    .segment[data-tone='danger'] { background: #ef4444; }
    .segment[data-tone='warning'] { background: #f59e0b; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SegmentedBarComponent {
  readonly segments = input.required<readonly BarSegment[]>();
  /** Denominator; defaults to the segment sum (a full stacked bar). */
  readonly total = input<number | null>(null);
  readonly height = input(10);

  readonly widths = computed(() => {
    const sum = this.segments().reduce((acc, s) => acc + Math.max(0, s.value), 0);
    const total = this.total() ?? sum;
    if (total <= 0) return [];
    return this.segments().map((s) => ({ tone: s.tone, width: (Math.max(0, s.value) / total) * 100 }));
  });
  readonly ariaLabel = computed(() => this.segments().map((s) => `${s.label}: ${s.value}`).join(', '));
}
