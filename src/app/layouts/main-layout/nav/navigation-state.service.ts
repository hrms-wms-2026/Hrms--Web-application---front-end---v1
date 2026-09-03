import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { canAccessNavItem } from './nav-access';
import { NAV_ITEMS } from './nav-items.config';

@Injectable({ providedIn: 'root' })
export class NavigationStateService {
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
    const url = this.currentUrl();
    return this.visibleItems().find((item) => url === item.path || url.startsWith(`${item.path}/`));
  });

  readonly activeChildren = computed(() => {
    const active = this.activeItem();
    if (!active?.children || active.children.length === 0) {
      return [];
    }
    return active.children.filter((child) => canAccessNavItem(child, this.permissionService));
  });
}
