import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  template: `
    <span
      data-testid="progress-bar"
      class="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-secondary)]"
      role="progressbar"
      [attr.aria-valuenow]="clampedProgress()"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span
        data-testid="progress-fill"
        class="block h-full rounded-full bg-[var(--color-accent)]"
        [style.width.%]="clampedProgress()"
      ></span>
    </span>
  `
})
export class ProgressBarComponent {
  progress = input.required<number>();

  readonly clampedProgress = computed(() => Math.round(Math.max(0, Math.min(100, this.progress()))));
}
