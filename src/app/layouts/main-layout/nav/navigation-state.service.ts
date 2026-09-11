import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { canAccessNavItem } from './nav-access';
import { NAV_ITEMS } from './nav-items.config';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  private static readonly STORAGE_KEY = 'onevo.sub_sidebar_collapsed';

  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly visibleItems = computed(() => NAV_ITEMS.filter((item) => canAccessNavItem(item, this.permissionService)));

  readonly activeItem = computed(() => {
    const rawUrl = this.currentUrl();
    const url = rawUrl.split('?')[0].split('#')[0];
    return this.visibleItems().find((item) => {
      if (url === item.path || url.startsWith(`${item.path}/`)) {
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

  readonly isSubSidebarCollapsed = signal<boolean>(this.loadInitialCollapsedState());

  readonly hasSubSidebar = computed(() => this.activeChildren().length > 0);

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

