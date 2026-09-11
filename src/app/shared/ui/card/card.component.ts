import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <section class="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 shadow-xs">
      @if (title()) {
        <h2 class="mb-3 text-base font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
      }
      <ng-content />
    </section>
  `
})
export class CardComponent {
  title = input<string>('');
}
