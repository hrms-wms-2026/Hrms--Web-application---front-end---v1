import { ALL_MY_TEAM_WIDGET_KEYS, MyTeamWidgetKey } from '../models/my-team-widget-key.model';

const STORAGE_KEY_PREFIX = 'onexso.my_team_widget_order';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Tenant isolation already comes for free - each ONEXSO tenant is served from its own subdomain,
 * and localStorage is origin-scoped by the browser. Employee isolation does not come for free:
 * two different employees signed into the same tenant on the same browser profile (a shared
 * kiosk, or a dev workstation switching accounts) would otherwise silently overwrite each other's
 * saved widget order. A null/omitted employeeId (not yet known, e.g. before auth resolves) falls
 * back to the unscoped key rather than throwing. */
function storageKey(employeeId: string | null | undefined): string {
  return employeeId ? `${STORAGE_KEY_PREFIX}:${employeeId}` : STORAGE_KEY_PREFIX;
}

/** The stored array IS the visible widgets, in the viewer's chosen display order - a widget key
 * absent from it is hidden. Unlike a show/hide-only preference, order is preserved exactly as
 * stored (My Team spec §5 "show/hide/reorder freely"), never re-derived from the canonical list
 * order. Per-viewer only (localStorage); a persisted setting is a later enhancement. */
export function loadMyTeamWidgetPreference(employeeId?: string | null): MyTeamWidgetKey[] {
  if (!hasLocalStorage()) return [...ALL_MY_TEAM_WIDGET_KEYS];
  try {
    const raw = localStorage.getItem(storageKey(employeeId));
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

export function saveMyTeamWidgetPreference(order: readonly MyTeamWidgetKey[], employeeId?: string | null): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(storageKey(employeeId), JSON.stringify(order));
  } catch {
    /* ignore - a per-viewer convenience, never load-bearing */
  }
}
