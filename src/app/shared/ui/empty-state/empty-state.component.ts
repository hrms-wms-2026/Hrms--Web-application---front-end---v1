import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-6 py-10 text-center">
      <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">{{ title() }}</h3>
      @if (description()) {
        <p class="max-w-sm text-sm text-[var(--color-text-secondary)]">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `
})
export class EmptyStateComponent {
  title = input.required<string>();
  description = input<string>('');
}
