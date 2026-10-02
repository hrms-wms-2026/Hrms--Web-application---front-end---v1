import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Signal, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { WidgetState } from './widget-card.component';

export interface WidgetLoader<T> {
  readonly data: Signal<T | null>;
  readonly state: Signal<WidgetState>;
  /** When the backend last answered successfully (null until the first response). */
  readonly loadedAt: Signal<Date | null>;
  /** True while a refresh() is in flight. */
  readonly refreshing: Signal<boolean>;
  /** Clears the data and shows the loading state while it refetches. */
  reload(): void;
  /** Refetches while keeping the current data on screen (no loading flash); a failed refresh keeps it too. */
  refresh(): void;
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
  const loadedAt = signal<Date | null>(null);
  const refreshing = signal(false);
  const reloadTick = signal(0);
  let subscription: Subscription | undefined;
  let keepDataOnNextRun = false;

  inject(DestroyRef).onDestroy(() => subscription?.unsubscribe());

  effect(() => {
    const request = source();
    reloadTick();

    untracked(() => {
      const keepData = keepDataOnNextRun && data() !== null;
      keepDataOnNextRun = false;
      subscription?.unsubscribe();
      subscription = undefined;
      if (keepData) {
        refreshing.set(true);
      } else {
        data.set(null);
        state.set('loading');
        refreshing.set(false);
      }
      if (request === null) return;

      subscription = request.subscribe({
        next: (value) => {
          data.set(value);
          state.set(options.isEmpty?.(value) ? 'empty' : 'ready');
          loadedAt.set(new Date());
          refreshing.set(false);
        },
        error: (err: unknown) => {
          refreshing.set(false);
          if (keepData) return;
          data.set(null);
          state.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
        }
      });
    });
  });

  return {
    data,
    state,
    loadedAt,
    refreshing,
    reload: () => reloadTick.update((n) => n + 1),
    refresh: () => {
      keepDataOnNextRun = true;
      reloadTick.update((n) => n + 1);
    }
  };
}
