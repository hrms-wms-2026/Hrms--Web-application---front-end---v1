import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { MyTeamWidgetKey } from '../models/my-team-widget-key.model';
import { loadMyTeamWidgetPreference, saveMyTeamWidgetPreference } from '../utils/my-team-widget-preference.util';
import { allowedWidgetKeys, resolveVisibleWidgets } from '../utils/my-team-widget-visibility.util';
import { MyTeamCapabilitiesStore } from './my-team-capabilities.store';

/**
 * The viewer's My Team widget show/hide/order preference, shared by the My Team section (which
 * owns the Customize picker) and the dashboard columns the widgets render in. One instance per app,
 * so a change in the picker moves the cards at once. Persisted per employee (see
 * my-team-widget-preference.util).
 */
@Injectable({ providedIn: 'root' })
export class MyTeamWidgetPreferenceService {
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly authStore = inject(AuthStore);

  private readonly stored = signal<MyTeamWidgetKey[]>(loadMyTeamWidgetPreference(this.authStore.employeeId()));

  /** Widgets the viewer's capabilities allow at all, in canonical order. */
  readonly allowedKeys = computed(() => allowedWidgetKeys(this.capabilitiesStore.capabilities()));
  /** Widgets shown, in the viewer's order - position N fills dashboard column N. */
  readonly visibleKeys = computed(() => resolveVisibleWidgets(this.capabilitiesStore.capabilities(), this.stored()));
  readonly hiddenAllowedKeys = computed(() => {
    const visible = new Set(this.visibleKeys());
    return this.allowedKeys().filter((key) => !visible.has(key));
  });

  toggle(key: MyTeamWidgetKey): void {
    const current = this.visibleKeys();
    this.save(current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);
  }

  move(previousIndex: number, currentIndex: number): void {
    const next = [...this.visibleKeys()];
    const [moved] = next.splice(previousIndex, 1);
    next.splice(currentIndex, 0, moved);
    this.save(next);
  }

  private save(next: MyTeamWidgetKey[]): void {
    this.stored.set(next);
    saveMyTeamWidgetPreference(next, this.authStore.employeeId());
  }
}
