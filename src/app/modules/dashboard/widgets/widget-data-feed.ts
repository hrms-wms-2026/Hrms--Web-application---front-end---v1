import { effect, untracked } from '@angular/core';
import { injectWidgetData } from './widget-data';

export interface WidgetDataFeedHandlers<T> {
  /** Applies a payload exactly as the card applies its own API's success response. */
  apply(data: T): void;
  /** The card's existing fetch path, unchanged. Used outside a dashboard, when the bootstrap had no
   * success payload for this widget, and when a refresh through the dashboard fails. */
  fetch(): void;
  /** Called when a reload goes through the dashboard (e.g. so a store shows its "refreshing" state). */
  refreshing?(): void;
}

export interface WidgetDataFeed {
  /** First load: takes the bootstrap payload when the frame has a successful one, else fetch(). */
  start(): void;
  /** Later loads (polls, visibility, retry): through ctx.refresh() when the first load came from the
   * bootstrap, else fetch(). A failed refresh falls back to fetch(), reproducing today's error handling. */
  reload(): void;
}

/** Lets a card take its data from the dashboard widget context while keeping its own fetch path as the
 * fallback. Outside a dashboard frame it simply calls fetch(). Call in an injection context. */
export function injectWidgetDataFeed<T>(handlers: WidgetDataFeedHandlers<T>): WidgetDataFeed {
  const ctx = injectWidgetData<T>();
  let viaContext = false;
  let awaitingRefresh = false;

  if (ctx) {
    effect(() => {
      const state = ctx.state();
      const data = ctx.data();
      if (!awaitingRefresh || state.status === 'loading') return;
      untracked(() => {
        awaitingRefresh = false;
        if (state.status === 'success' && data != null) handlers.apply(data);
        else handlers.fetch();
      });
    });
  }

  return {
    start(): void {
      const data = ctx?.data();
      if (ctx && ctx.state().status === 'success' && data != null) {
        viaContext = true;
        handlers.apply(data);
      } else {
        handlers.fetch();
      }
    },
    reload(): void {
      if (!ctx || !viaContext) {
        handlers.fetch();
        return;
      }
      awaitingRefresh = true;
      handlers.refreshing?.();
      ctx.refresh();
    }
  };
}
