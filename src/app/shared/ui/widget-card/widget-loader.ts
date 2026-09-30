import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { WidgetState } from './widget-card.component';

export interface WidgetLoader<T> {
  readonly data: Signal<T | null>;
  readonly state: Signal<WidgetState>;
  reload(): void;
}

export interface WidgetLoaderOptions<T> {
  /** When true for a successful response, the widget shows its empty state. */
  readonly isEmpty?: (value: T) => boolean;
}

/**
 * Observable -> signals for one dashboard widget. `source` is re-evaluated whenever a signal it
 * reads changes: the previous request is unsubscribed (so a slow stale response can never
 * overwrite a newer one) and a new one starts. Returning null means "not ready yet".
 * Call from an injection context (a field initializer).
 */
export function createWidgetLoader<T>(
  source: () => Observable<T> | null,
  options: WidgetLoaderOptions<T> = {}
): WidgetLoader<T> {
  const data = signal<T | null>(null);
  const state = signal<WidgetState>('loading');
  const reloadTick = signal(0);
  let subscription: Subscription | undefined;

  inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());

  effect(() => {
    const request = source();
    reloadTick();

    untracked(() => {
      subscription?.unsubscribe();
      subscription = undefined;
      data.set(null);
      state.set('loading');
      if (request === null) return;

      subscription = request.subscribe({
        next: (value) => {
          data.set(value);
          state.set(options.isEmpty?.(value) ? 'empty' : 'ready');
        },
        error: (err: unknown) => {
          data.set(null);
          state.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
    });
  });

  return { data, state, reload: () => reloadTick.update((n) => n + 1) };
}
