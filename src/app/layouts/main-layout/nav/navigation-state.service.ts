import { Portal } from '@angular/cdk/portal';
import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { PlannerAvailabilityService } from '../../../modules/work/planner/state/planner-availability.service';
import { canAccessNavItem } from './nav-access';
import { NavItem } from './nav-item.model';
import { NAV_ITEMS } from './nav-items.config';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  private static readonly STORAGE_KEY = 'crownus.sub_sidebar_collapsed';
  private static readonly PINNED_KEY = 'crownus.mobile_nav_pinned';
  private static readonly RECENT_KEY = 'crownus.mobile_nav_recent';
  private static readonly HOME_ID = 'home';
  /** Icons on the mobile bottom bar, More included. */
  private static readonly MOBILE_BAR_SIZE = 5;
  static readonly MAX_PINS = 3;

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly plannerAvailability = inject(PlannerAvailabilityService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  // Planner = Calendar (2026-10-27 design): once the planner is known on (Planner:Enabled), the Calendar item is the
  // Planner, at /planner and still active on /calendar links (OAuth and email links point there).
  readonly visibleItems = computed(() => {
    const plannerOn = this.plannerAvailability.state() === 'on';
    return NAV_ITEMS.filter((item) => canAccessNavItem(item, this.permissionService))
      .map((item): NavItem => item.id === 'calendar' && plannerOn
        ? { ...item, label: 'Planner', path: '/planner', alsoMatches: [...(item.alsoMatches ?? []), '/calendar'] }
        : item);
  });

  readonly activeItem = computed(() => {
    const rawUrl = this.currentUrl();
    const url = rawUrl.split('?')[0].split('#')[0];
    return this.visibleItems().find((item) => {
      if ([item.path, ...(item.alsoMatches ?? [])].some((path) => url === path || url.startsWith(`${path}/`))) {
        return true;
      }
      if (item.children && item.children.length > 0) {
        return item.children.some((child) => url === child.path || url.startsWith(`${child.path}/`));
      }
      return false;
    });
  });

  readonly activeChildren = computed(() => {
    const active = this.activeItem();
    if (!active?.children || active.children.length === 0) {
      return [];
    }
    return active.children.filter((child) => canAccessNavItem(child, this.permissionService));
  });

  /** The sub-sidebar entry for the current page. Longest match wins: '/attendance/overview' must not claim a deeper '/attendance/overview/...' page. */
  readonly activeChild = computed(() => {
    const url = this.currentUrl().split('?')[0].split('#')[0];
    return [...this.activeChildren()]
      .sort((a, b) => b.path.length - a.path.length)
      .find((child) => url === child.path || url.startsWith(`${child.path}/`)) ?? null;
  });

  /** A rail item's children the caller can open. */
  accessibleChildren(item: NavItem): readonly NavItem[] {
    return (item.children ?? []).filter((child) => canAccessNavItem(child, this.permissionService));
  }

  /** Mobile bottom bar: rail items the user keeps on the bar (Home is always there and cannot be pinned). */
  readonly pinnedIds = signal<readonly string[]>(this.loadIds(NavigationStateService.PINNED_KEY));

  /** Mobile bottom bar: rail items most recently opened first, so a page opened from More takes the slot of the
   *  unpinned item opened longest ago. */
  private readonly recentIds = signal<readonly string[]>(this.loadIds(NavigationStateService.RECENT_KEY));

  /** True when the user can open more rail items than the bar holds, so the rest go behind More. */
  readonly hasMobileMore = computed(() => this.visibleItems().length > NavigationStateService.MOBILE_BAR_SIZE);

  /** The rail items on the mobile bottom bar, in rail order: Home, the pinned items, then the most recently opened
   *  (or else the first) of the rest, up to the bar's size. Everything else is behind More. */
  readonly mobileBarItems = computed(() => {
    const items = this.visibleItems();
    if (!this.hasMobileMore()) {
      return items;
    }
    const others = items.filter((item) => item.id !== NavigationStateService.HOME_ID);
    const slots = NavigationStateService.MOBILE_BAR_SIZE - 2; // Home and More take two
    const chosen = new Set(this.pinnedIds().filter((id) => others.some((item) => item.id === id)).slice(0, slots));
    for (const id of [...this.recentIds(), ...others.map((item) => item.id)]) {
      if (chosen.size >= slots) {
        break;
      }
      if (others.some((item) => item.id === id)) {
        chosen.add(id);
      }
    }
    return items.filter((item) => item.id === NavigationStateService.HOME_ID || chosen.has(item.id));
  });

  /** The rail items behind More, in rail order. */
  readonly mobileMoreItems = computed(() => {
    const onBar = new Set(this.mobileBarItems().map((item) => item.id));
    return this.visibleItems().filter((item) => !onBar.has(item.id));
  });

  isPinned(item: NavItem): boolean {
    return this.pinnedIds().includes(item.id);
  }

  /** Pins of items the user can still open (a pin outlives losing access to its module). */
  private readonly livePinCount = computed(() => this.pinnedIds().filter((id) => this.visibleItems().some((item) => item.id === id)).length);

  canPin(item: NavItem): boolean {
    return item.id !== NavigationStateService.HOME_ID && (this.isPinned(item) || this.livePinCount() < NavigationStateService.MAX_PINS);
  }

  togglePin(item: NavItem): void {
    if (!this.canPin(item)) {
      return;
    }
    const next = this.isPinned(item) ? this.pinnedIds().filter((id) => id !== item.id) : [...this.pinnedIds(), item.id];
    this.pinnedIds.set(next);
    this.persistIds(NavigationStateService.PINNED_KEY, next);
  }

  private rememberOpened(id: string): void {
    if (id === NavigationStateService.HOME_ID || this.recentIds()[0] === id) {
      return;
    }
    const next = [id, ...this.recentIds().filter((recent) => recent !== id)];
    this.recentIds.set(next);
    this.persistIds(NavigationStateService.RECENT_KEY, next);
  }

  /** Where a rail item goes: its first reachable child (a parent like Org may hold pages the caller cannot open, e.g.
   *  a team manager has People but not Organization), or its own path when it has none. */
  entryPath(item: NavItem): string {
    return item.children?.find((child) => canAccessNavItem(child, this.permissionService))?.path ?? item.path;
  }

  readonly isSubSidebarCollapsed = signal<boolean>(this.loadInitialCollapsedState());

  /** Pages opened since the app loaded, so the mobile back arrow knows whether going back stays in the app. */
  private navigationCount = 0;

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.navigationCount++;
        const active = this.activeItem();
        if (active) {
          this.rememberOpened(active.id);
        }
      });
  }

  /** True once the user has moved between pages here, so history back lands on one of ours. */
  hasInAppHistory(): boolean {
    return this.navigationCount > 1;
  }

  /** What the open page shows in the sub-sidebar, for a page whose list needs the page's own state (the Planner's Task list). */
  readonly pageSubSidebar = signal<Portal<unknown> | null>(null);
  /** The page's buttons in the sub-sidebar header, beside the collapse button. */
  readonly pageSubSidebarActions = signal<Portal<unknown> | null>(null);

  readonly hasSubSidebar = computed(() => this.activeChildren().length > 1 || !!this.activeItem()?.customSubSidebar || this.pageSubSidebar() !== null);

  /** The active module's own sub-sidebar, when it renders one instead of child links. */
  readonly customSubSidebar = computed(() => this.activeItem()?.customSubSidebar ?? null);

  readonly hasVisibleSubSidebar = computed(() => this.hasSubSidebar() && !this.isSubSidebarCollapsed());

  readonly canExpandSubSidebar = computed(() => this.hasSubSidebar() && this.isSubSidebarCollapsed());

  collapseSubSidebar(): void {
    this.isSubSidebarCollapsed.set(true);
    this.persistCollapsedState(true);
  }

  expandSubSidebar(): void {
    this.isSubSidebarCollapsed.set(false);
    this.persistCollapsedState(false);
  }

  toggleSubSidebar(): void {
    const next = !this.isSubSidebarCollapsed();
    this.isSubSidebarCollapsed.set(next);
    this.persistCollapsedState(next);
  }

  private loadInitialCollapsedState(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    try {
      return window.localStorage.getItem(NavigationStateService.STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private loadIds(key: string): readonly string[] {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private persistIds(key: string, ids: readonly string[]): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      // Ignore localStorage exceptions in private/restricted environments
    }
  }

  private persistCollapsedState(collapsed: boolean): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem(NavigationStateService.STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore localStorage exceptions in private/restricted environments
    }
  }
}

