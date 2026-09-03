import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center">
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
