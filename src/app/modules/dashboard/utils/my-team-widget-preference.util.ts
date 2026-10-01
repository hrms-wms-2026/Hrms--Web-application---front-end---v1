import { ALL_MY_TEAM_WIDGET_KEYS, MyTeamWidgetKey } from '../models/my-team-widget-key.model';

const STORAGE_KEY = 'onexso.my_team_widget_order';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** The stored array IS the visible widgets, in the viewer's chosen display order - a widget key
 * absent from it is hidden. Unlike a show/hide-only preference, order is preserved exactly as
 * stored (My Team spec §5 "show/hide/reorder freely"), never re-derived from the canonical list
 * order. Per-viewer only (localStorage); a persisted setting is a later enhancement. */
export function loadMyTeamWidgetPreference(): MyTeamWidgetKey[] {
  if (!hasLocalStorage()) return [...ALL_MY_TEAM_WIDGET_KEYS];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...ALL_MY_TEAM_WIDGET_KEYS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ALL_MY_TEAM_WIDGET_KEYS];
    return parsed.filter((key): key is MyTeamWidgetKey =>
      ALL_MY_TEAM_WIDGET_KEYS.includes(key as MyTeamWidgetKey)
    );
  } catch {
    return [...ALL_MY_TEAM_WIDGET_KEYS];
  }
}

export function saveMyTeamWidgetPreference(order: readonly MyTeamWidgetKey[]): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore - a per-viewer convenience, never load-bearing */
  }
}
