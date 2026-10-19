import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/state/auth.store';
import {
  ALL_DASHBOARD_CARD_KEYS,
  DASHBOARD_CARD_META,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardCardKey,
  DashboardLayout,
  DashboardZoneId,
  moveDashboardCard,
  resolveDashboardLayout,
  sanitizeDashboardLayout,
  stepDashboardCard,
  toggleDashboardCard
} from '../utils/dashboard-layout.util';
import { allowedWidgetKeys } from '../utils/my-team-widget-visibility.util';
import { MyTeamCapabilitiesStore } from './my-team-capabilities.store';

const STORAGE_KEY_PREFIX = 'onexso.dashboard_layout';

/** Per-viewer storage key, or null while the viewer is unknown - never a shared unscoped key, so
 * one person's layout can't leak into another's first visit. */
function storageKey(viewerId: string | null): string | null {
  return viewerId ? `${STORAGE_KEY_PREFIX}:${viewerId}` : null;
}

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
  } catch {
    /* a per-viewer convenience - never load-bearing */
  }
}

/** The viewer's saved layout if they ever pressed Done in Customize; otherwise - first login,
 * nothing customized - the full default layout with every allowed card shown. */
export function loadDashboardLayout(viewerId: string | null): DashboardLayout {
  const key = storageKey(viewerId);
  const raw = key ? readStorage(key) : null;
  if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
  try {
    return sanitizeDashboardLayout(JSON.parse(raw));
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT;
  }
}

export function saveDashboardLayout(layout: DashboardLayout, viewerId: string | null): void {
  const key = storageKey(viewerId);
  if (key) writeStorage(key, JSON.stringify(layout));
}

/**
 * The dashboard's card layout - what is shown, where - saved per employee in this browser.
 * Customize edits a draft: Done saves it, Cancel drops it, Reset puts the default in the draft.
 * Cards the viewer may not see are filtered out only when rendering, never in what is saved, so
 * they keep their place if access comes back.
 */
@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly authStore = inject(AuthStore);

  /** Who the layout belongs to: the employee, or the login email for a user with no employee record. */
  private readonly viewerId = computed(() => this.authStore.employeeId() ?? this.authStore.email() ?? null);
  /** Re-reads storage whenever the signed-in viewer changes. */
  private readonly saved = linkedSignal(() => loadDashboardLayout(this.viewerId()));

  readonly editing = signal(false);
  private readonly draft = signal<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT);

  /** Capabilities decide whether the My Team cards exist for this viewer; Customize waits for them. */
  readonly ready = computed(() => this.capabilitiesStore.loaded());

  /** Cards this viewer may have here: every My Day card, plus Action Center when their capabilities
   * allow it - it shows on both dashboards. Team Status and Team Progress live only on the separate
   * My Team dashboard (/dashboard/my-team); their keys stay in the layout model, so layouts saved
   * before the split still load. */
  readonly allowed = computed<ReadonlySet<DashboardCardKey>>(() => {
    const caps = this.capabilitiesStore.capabilities();
    const team = caps?.isAvailable ? allowedWidgetKeys(caps) : [];
    const keys: DashboardCardKey[] = ALL_DASHBOARD_CARD_KEYS.filter((key) => DASHBOARD_CARD_META[key].group === 'day');
    if (team.includes('actionCenter')) keys.push('actionCenter');
    return new Set(keys);
  });

  /** The layout on screen: the draft while customizing, the saved one otherwise. */
  readonly layout = computed(() => (this.editing() ? this.draft() : this.saved()));
  readonly resolved = computed(() => resolveDashboardLayout(this.layout(), this.allowed()));
  readonly hidden = computed(() => new Set(this.layout().hidden));

  /** The Customize list: the viewer's allowed cards, grouped. */
  readonly customizeGroups = computed(() => {
    const allowed = this.allowed();
    const keys = ALL_DASHBOARD_CARD_KEYS.filter((key) => allowed.has(key));
    return [
      { id: 'team' as const, label: 'My Team', keys: keys.filter((k) => DASHBOARD_CARD_META[k].group === 'team') },
      { id: 'day' as const, label: 'My Day', keys: keys.filter((k) => DASHBOARD_CARD_META[k].group === 'day') }
    ].filter((group) => group.keys.length > 0);
  });

  startEditing(): void {
    if (!this.ready()) return;
    this.draft.set(this.saved());
    this.editing.set(true);
  }

  cancel(): void {
    this.editing.set(false);
  }

  done(): void {
    if (!this.editing()) return;
    const next = this.draft();
    this.saved.set(next);
    saveDashboardLayout(next, this.viewerId());
    this.editing.set(false);
  }

  /** Puts the default layout in the draft; it is saved only on Done. */
  reset(): void {
    if (this.editing()) this.draft.set(DEFAULT_DASHBOARD_LAYOUT);
  }

  isShown(key: DashboardCardKey): boolean {
    return !this.hidden().has(key);
  }

  toggle(key: DashboardCardKey): void {
    if (this.editing()) this.draft.update((layout) => toggleDashboardCard(layout, key));
  }

  /** A drag-and-drop: `toIndex` is the position among the cards shown in that zone. */
  drop(key: DashboardCardKey, toZone: DashboardZoneId, toIndex: number): void {
    if (this.editing()) this.draft.update((layout) => moveDashboardCard(layout, key, toZone, toIndex, this.visible));
  }

  /** ↑ / ↓ from the Customize list. */
  step(key: DashboardCardKey, direction: -1 | 1): void {
    if (this.editing()) this.draft.update((layout) => stepDashboardCard(layout, key, direction, this.visible));
  }

  private readonly visible = (key: DashboardCardKey): boolean => this.allowed().has(key) && !this.hidden().has(key);
}
