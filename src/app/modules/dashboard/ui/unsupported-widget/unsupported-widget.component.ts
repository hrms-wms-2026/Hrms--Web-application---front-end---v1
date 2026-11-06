import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Neutral placeholder for a stored widget whose definition no longer exists. */
@Component({
  selector: 'app-unsupported-widget',
  standalone: true,
  template: `
    <section
      class="flex h-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[var(--color-border)]/80 bg-[var(--color-surface)] p-5 text-center"
      data-testid="unsupported-widget"
    >
      @if (title()) {
        <p class="text-sm font-semibold text-[var(--color-text-primary)]">{{ title() }}</p>
      }
      <p class="text-xs text-[var(--color-text-secondary)]">This widget is no longer available.</p>
    </section>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnsupportedWidgetComponent {
  readonly title = input('');
}
