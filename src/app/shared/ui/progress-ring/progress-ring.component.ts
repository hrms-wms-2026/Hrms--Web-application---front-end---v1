import { Component, computed, input } from '@angular/core';

let nextGradientId = 0;

@Component({
  selector: 'app-progress-ring',
  standalone: true,
  template: `
    <div
      class="relative inline-flex shrink-0 items-center justify-center"
      [style.width.px]="size()"
      [style.height.px]="size()"
      data-testid="progress-ring"
    >
      <svg
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        [attr.width]="size()"
        [attr.height]="size()"
        class="-rotate-90"
        aria-hidden="true"
      >
        @if (gradient()) {
          <defs>
            <linearGradient [attr.id]="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.4" />
              <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="1" />
            </linearGradient>
          </defs>
        }
        <circle
          [attr.cx]="center()" [attr.cy]="center()" [attr.r]="radius()"
          fill="none" stroke="var(--color-surface-secondary)" [attr.stroke-width]="strokeWidth()"
        />
        <circle
          [attr.cx]="center()" [attr.cy]="center()" [attr.r]="radius()"
          fill="none"
          [attr.stroke]="gradient() ? 'url(#' + gradientId + ')' : 'var(--color-accent)'"
          [attr.stroke-width]="strokeWidth()"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="dashOffset()"
        />
      </svg>
      <span
        class="absolute font-semibold text-[var(--color-text-primary)]"
        [style.font-size.px]="labelFontSize()"
      >{{ clampedProgress() }}%</span>
    </div>
  `
})
export class ProgressRingComponent {
  progress = input.required<number>();
  size = input(64);
  strokeWidth = input(6);
  gradient = input(false);

  readonly gradientId = `progress-ring-gradient-${nextGradientId++}`;

  readonly clampedProgress = computed(() => Math.round(Math.max(0, Math.min(100, this.progress()))));
  readonly center = computed(() => this.size() / 2);
  readonly radius = computed(() => this.size() / 2 - this.strokeWidth() / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  readonly dashOffset = computed(() => this.circumference() * (1 - this.clampedProgress() / 100));
  readonly labelFontSize = computed(() => Math.max(10, Math.round(this.size() * 0.2)));
}
