import { DestroyRef, inject, Injectable, InjectionToken, Signal, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { DashboardLayoutApiService } from '../data-access/dashboard-layout-api.service';
import { WidgetDataState } from '../models/dashboard-layout.model';

/** What a widget card sees when rendered inside a dashboard frame. */
export interface WidgetDataContext<T = unknown> {
  readonly instanceId: string;
  readonly state: Signal<WidgetDataState>;
  readonly data: Signal<T | null>;
  refresh(): void;
}

export interface WidgetDataSeed {
  instanceId: string;
  state: WidgetDataState;
  data: unknown;
}

/** Provided by WidgetFrameComponent (one instance per widget); the frame calls bind() with the bootstrap widget. */
export const WIDGET_DATA = new InjectionToken<WidgetDataContext>('WIDGET_DATA');

@Injectable()
export class WidgetDataStore implements WidgetDataContext {
  private readonly api = inject(DashboardLayoutApiService);
  private readonly _state = signal<WidgetDataState>({ status: 'not_loaded', fetchedAt: null, error: null });
  private readonly _data = signal<unknown>(null);
  private inFlight: Subscription | null = null;
  private id = '';

  readonly state = this._state.asReadonly();
  readonly data = this._data.asReadonly();

  get instanceId(): string {
    return this.id;
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
  }

  /** Seeds the context from the bootstrap widget. Re-binding with new bootstrap data resets any in-flight refresh. */
  bind(seed: WidgetDataSeed): void {
    this.cancel();
    this.id = seed.instanceId;
    this._state.set(seed.state);
    this._data.set(seed.data);
  }

  refresh(): void {
    if (this.inFlight) {
      return;
    }
    this._state.update((s) => ({ ...s, status: 'loading' }));
    const sub = this.api.widgetData(this.id).subscribe({
      next: (res) => {
        this._state.set({ status: res.status, fetchedAt: res.fetchedAt, error: null });
        this._data.set(res.payload);
      },
      error: () => {
        this.inFlight = null;
        this._state.update((s) => ({ ...s, status: 'error', error: 'REFRESH_FAILED' }));
      },
      complete: () => {
        this.inFlight = null;
      }
    });
    // A synchronous completion has already run complete(); only remember still-open subscriptions.
    this.inFlight = sub.closed ? null : sub;
  }

  private cancel(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
  }
}

/** Returns the widget data context, or null when the card is rendered outside a dashboard frame. */
export function injectWidgetData<T = unknown>(): WidgetDataContext<T> | null {
  return inject(WIDGET_DATA, { optional: true }) as WidgetDataContext<T> | null;
}
