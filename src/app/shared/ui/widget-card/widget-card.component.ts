import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ErrorStateComponent } from '../error-state/error-state.component';

export type WidgetState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

/**
 * Shared frame for per-widget data cards: title header plus one of five states, so each widget
 * fails, loads and denies access independently of the rest of the page.
 */
@Component({
  selector: 'app-widget-card',
  standalone: true,
  imports: [ErrorStateComponent],
  template: `
    <section
      class="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
      [attr.aria-busy]="state() === 'loading'"
    >
      <header class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
        <ng-content select="[widget-actions]" />
      </header>

      @switch (state()) {
        @case ('loading') {
          <div data-testid="widget-loading" class="animate-pulse space-y-3" aria-hidden="true">
            <div class="h-4 w-2/3 rounded bg-[var(--color-surface-secondary)]"></div>
            <div class="h-4 w-1/2 rounded bg-[var(--color-surface-secondary)]"></div>
            <div class="h-24 rounded bg-[var(--color-surface-secondary)]"></div>
          </div>
        }
        @case ('error') {
          <app-error-state [message]="errorMessage()" [retryable]="true" (retry)="retry.emit()" />
        }
        @case ('forbidden') {
          <p data-testid="widget-forbidden" class="text-sm text-[var(--color-text-secondary)]">
            You do not have access to this section.
          </p>
        }
        @case ('empty') {
          <p data-testid="widget-empty" class="text-sm text-[var(--color-text-secondary)]">{{ emptyMessage() }}</p>
        }
        @default {
          <ng-content />
        }
      }
    </section>
  `,
  // `title` is an input; clear the native attribute Angular also leaves on the host so it does not show a hover tooltip.
  host: { class: 'block h-full', '[attr.title]': 'null' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetCardComponent {
  readonly title = input.required<string>();
  readonly state = input<WidgetState>('ready');
  readonly errorMessage = input('Something went wrong loading this section.');
  readonly emptyMessage = input('Nothing to show yet.');
  readonly retry = output<void>();
}
