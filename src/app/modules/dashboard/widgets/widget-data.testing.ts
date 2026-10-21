import { signal } from '@angular/core';
import { vi } from 'vitest';
import { WidgetDataState } from '../models/dashboard-layout.model';
import { WIDGET_DATA, WidgetDataContext } from './widget-data';

/** Test double for the per-widget data context a dashboard frame provides to its card. */
export function fakeWidgetData(status: WidgetDataState['status'], data: unknown = null) {
  const state = signal<WidgetDataState>({
    status,
    fetchedAt: status === 'success' ? '2026-10-21T08:00:00Z' : null,
    error: status === 'error' ? 'FORBIDDEN' : null
  });
  const payload = signal<unknown>(data);
  const refresh = vi.fn();
  const ctx: WidgetDataContext = { instanceId: 'widget-1', state, data: payload, refresh };
  return {
    ctx,
    state,
    data: payload,
    refresh,
    provider: { provide: WIDGET_DATA, useValue: ctx },
    /** Simulates the frame's refresh() settling with a new success payload. */
    resolve(next: unknown) {
      payload.set(next);
      state.set({ status: 'success', fetchedAt: '2026-10-21T08:01:00Z', error: null });
    },
    /** Simulates the frame's refresh() failing. */
    fail() {
      state.update((s) => ({ ...s, status: 'error', error: 'REFRESH_FAILED' }));
    }
  };
}
