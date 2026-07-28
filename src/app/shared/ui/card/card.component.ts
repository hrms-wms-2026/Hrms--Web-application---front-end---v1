import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      @if (title()) {
        <h2 class="mb-3 text-lg font-semibold text-slate-900">{{ title() }}</h2>
      }
      <ng-content />
    </section>
  `
})
export class CardComponent {
  title = input<string>('');
}
