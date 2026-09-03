import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <div
      class="flex flex-col items-center gap-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger-subtle)] px-6 py-8 text-center"
      role="alert"
    >
      <p class="text-sm font-medium text-[var(--color-danger-text)]">{{ message() }}</p>
      @if (retryable()) {
        <button
          type="button"
          class="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent-contrast)] transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
          (click)="retry.emit()"
        >
          {{ retryLabel() }}
        </button>
      }
    </div>
  `
})
export class ErrorStateComponent {
  message = input.required<string>();
  retryable = input(false);
  retryLabel = input('Try again');
  retry = output<void>();
}
