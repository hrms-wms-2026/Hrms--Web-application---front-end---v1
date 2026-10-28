import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { InboxStore } from '../../../modules/inbox/state/inbox.store';
import { NavItem } from '../nav/nav-item.model';
import { NavigationStateService } from '../nav/navigation-state.service';
import { NavIconComponent } from '../side-navbar/nav-icon.component';

/**
 * Mobile stand-in for the rail: icons only, Home first. When the user can open more modules than the bar holds, the
 * rest sit behind More, a sheet where modules can also be pinned to the bar.
 */
@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, NavIconComponent],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrl: './mobile-bottom-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeMore()' }
})
export class MobileBottomNavComponent {
  private readonly navState = inject(NavigationStateService);
  /** Pending requests + unread chat messages ('' when none, capped at 9+). */
  readonly inboxBadge = inject(InboxStore).badgeLabel;

  readonly maxPins = NavigationStateService.MAX_PINS;
  readonly barItems = this.navState.mobileBarItems;
  readonly moreItems = this.navState.mobileMoreItems;
  readonly hasMore = this.navState.hasMobileMore;
  readonly activeId = computed(() => this.navState.activeItem()?.id ?? null);
  readonly entryPath = (item: NavItem): string => this.navState.entryPath(item);

  /** Bar items other than Home, listed in the sheet so they can be pinned or unpinned too. */
  readonly pinnableBarItems = computed(() => this.barItems().filter((item) => item.id !== 'home'));
  readonly pinCount = computed(() => this.navState.pinnedIds().filter((id) => this.navState.visibleItems().some((item) => item.id === id)).length);

  readonly moreOpen = signal(false);
  /** The sheet's "On your bar" list, hidden until asked for from the sheet's header. */
  readonly showBarItems = signal(false);

  /** More is lit while its sheet is open, or while the current page is one of its modules. */
  readonly moreActive = computed(() => this.moreOpen() || this.moreItems().some((item) => item.id === this.activeId()));

  isPinned(item: NavItem): boolean {
    return this.navState.isPinned(item);
  }

  canPin(item: NavItem): boolean {
    return this.navState.canPin(item);
  }

  togglePin(item: NavItem): void {
    this.navState.togglePin(item);
  }

  toggleBarItems(): void {
    this.showBarItems.update((show) => !show);
  }

  toggleMore(): void {
    if (this.moreOpen()) {
      this.closeMore();
    } else {
      this.moreOpen.set(true);
    }
  }

  closeMore(): void {
    this.moreOpen.set(false);
    this.showBarItems.set(false);
  }
}
