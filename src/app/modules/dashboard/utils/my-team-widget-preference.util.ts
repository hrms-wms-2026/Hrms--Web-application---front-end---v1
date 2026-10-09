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

/** Retired widget keys from before the Action Center consolidation (2026-10-01), mapped to the
 * merged key. A silent allowlist-filter alone would drop both without ever inserting
 * 'actionCenter' - correct only for a viewer who had hidden both legacy widgets, and wrong (loses
 * the merged widget's visibility) for anyone who had either one visible. */
const LEGACY_WIDGET_KEY_MAP: Record<string, MyTeamWidgetKey> = {
  priorityActions: 'actionCenter',
  approvalsExceptions: 'actionCenter'
};

/** Applies the legacy-key mapping once: 'actionCenter' is inserted at the position of whichever
 * legacy key appeared first, a second legacy occurrence collapses into that same single entry
 * (never duplicated), and an array with neither legacy key is returned unchanged. */
function migrateLegacyWidgetKeys(stored: readonly string[]): MyTeamWidgetKey[] {
  const mapped: MyTeamWidgetKey[] = [];
  let actionCenterInserted = false;
  for (const key of stored) {
    const target = LEGACY_WIDGET_KEY_MAP[key] ?? (key as MyTeamWidgetKey);
    if (target === 'actionCenter') {
      if (actionCenterInserted) continue;
      actionCenterInserted = true;
    }
    mapped.push(target);
  }
  return mapped;
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

    const hasLegacyKey = parsed.some((key) => typeof key === 'string' && key in LEGACY_WIDGET_KEY_MAP);
    const migrated = hasLegacyKey ? migrateLegacyWidgetKeys(parsed as string[]) : (parsed as MyTeamWidgetKey[]);
    const result = migrated.filter((key): key is MyTeamWidgetKey =>
      ALL_MY_TEAM_WIDGET_KEYS.includes(key as MyTeamWidgetKey)
    );

    if (hasLegacyKey) saveMyTeamWidgetPreference(result, employeeId);
    return result;
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
