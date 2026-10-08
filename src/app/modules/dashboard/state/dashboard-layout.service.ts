import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { MyTeamWidgetKey } from '../models/my-team-widget-key.model';
import {
  ALL_DASHBOARD_CARD_KEYS,
  DASHBOARD_CARD_META,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardCardKey,
  DashboardLayout,
  DashboardZoneId,
  migrateFromMyTeamPreference,
  moveDashboardCard,
  resolveDashboardLayout,
  sanitizeDashboardLayout,
  stepDashboardCard,
  toggleDashboardCard
} from '../utils/dashboard-layout.util';
import { loadMyTeamWidgetPreference } from '../utils/my-team-widget-preference.util';
import { allowedWidgetKeys } from '../utils/my-team-widget-visibility.util';
import { MyTeamCapabilitiesStore } from './my-team-capabilities.store';

const STORAGE_KEY_PREFIX = 'onexso.dashboard_layout';
const LEGACY_MY_TEAM_KEY_PREFIX = 'onexso.my_team_widget_order';

function scoped(prefix: string, employeeId: string | null): string {
  return employeeId ? `${prefix}:${employeeId}` : prefix;
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

/** The saved layout for one employee: the dashboard layout if there is one, otherwise their old My
 * Team Customize choice carried over (only if they ever saved one), otherwise the default. */
export function loadDashboardLayout(employeeId: string | null): DashboardLayout {
  const raw = readStorage(scoped(STORAGE_KEY_PREFIX, employeeId));
  if (raw) {
    try {
      return sanitizeDashboardLayout(JSON.parse(raw));
    } catch {
      return DEFAULT_DASHBOARD_LAYOUT;
    }
  }
  if (readStorage(scoped(LEGACY_MY_TEAM_KEY_PREFIX, employeeId)) !== null) {
    return migrateFromMyTeamPreference(loadMyTeamWidgetPreference(employeeId));
  }
  return DEFAULT_DASHBOARD_LAYOUT;
}

export function saveDashboardLayout(layout: DashboardLayout, employeeId: string | null): void {
  writeStorage(scoped(STORAGE_KEY_PREFIX, employeeId), JSON.stringify(layout));
}

const TEAM_KEYS: readonly DashboardCardKey[] = ['teamKpis', 'teamStatus', 'actionCenter', 'teamProgress'];

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

  private readonly employeeId = computed(() => this.authStore.employeeId() ?? null);
  /** Re-reads storage whenever the signed-in employee changes. */
  private readonly saved = linkedSignal(() => loadDashboardLayout(this.employeeId()));

  readonly editing = signal(false);
  private readonly draft = signal<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT);

  /** Capabilities decide whether the My Team cards exist for this viewer; Customize waits for them. */
  readonly ready = computed(() => this.capabilitiesStore.loaded());

  /** Cards this viewer may have at all: every My Day card, plus the My Team cards their
   * capabilities allow (the KPI tiles whenever any team card is allowed). */
  readonly allowed = computed<ReadonlySet<DashboardCardKey>>(() => {
    const caps = this.capabilitiesStore.capabilities();
    const team = caps?.isAvailable ? allowedWidgetKeys(caps) : [];
    const keys = ALL_DASHBOARD_CARD_KEYS.filter((key) => DASHBOARD_CARD_META[key].group === 'day');
    if (team.length > 0) keys.push('teamKpis', ...(team as DashboardCardKey[]));
    return new Set(keys);
  });

  /** The layout on screen: the draft while customizing, the saved one otherwise. */
  readonly layout = computed(() => (this.editing() ? this.draft() : this.saved()));
  readonly resolved = computed(() => resolveDashboardLayout(this.layout(), this.allowed()));
  readonly hidden = computed(() => new Set(this.layout().hidden));

  /** Team cards on screen, in column order - drives which KPI tiles show. */
  readonly visibleTeamKeys = computed<MyTeamWidgetKey[]>(() =>
    this.resolved().columns.flat().filter((key): key is MyTeamWidgetKey => TEAM_KEYS.includes(key))
  );

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
    saveDashboardLayout(next, this.employeeId());
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
