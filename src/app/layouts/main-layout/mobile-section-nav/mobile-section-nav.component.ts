import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MobileBackBarState } from '../nav/mobile-back-bar.state';
import { NavItem } from '../nav/nav-item.model';
import { NavigationStateService } from '../nav/navigation-state.service';

/**
 * Mobile stand-in for the sub-sidebar. A page in a section of several shows a back bar whose title opens a list of
 * the section's pages, to switch between them.
 */
@Component({
  selector: 'app-mobile-section-nav',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mobile-section-nav.component.html',
  styleUrl: './mobile-section-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeSwitcher()' }
})
export class MobileSectionNavComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** The page being viewed, when it is one of several in its section (so there are pages to switch to). */
  readonly currentPage = computed(() => (this.navState.activeChildren().length > 1 ? this.navState.activeChild() : null));

  readonly sectionTitle = computed(() => {
    const active = this.navState.activeItem();
    return active ? (active.menuTitle ?? active.label) : '';
  });

  /** Consecutive pages with the same section form one titled group, as on the sub-sidebar. */
  readonly pageGroups = computed(() => {
    const groups: { title: string | null; items: NavItem[] }[] = [];
    for (const child of this.navState.activeChildren()) {
      const title = child.section ?? null;
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.items.push(child);
      } else {
        groups.push({ title, items: [child] });
      }
    }
    return groups;
  });

  readonly switcherOpen = signal(false);

  constructor() {
    const backBar = inject(MobileBackBarState);
    effect(() => backBar.label.set(this.currentPage()?.label ?? null));
    inject(DestroyRef).onDestroy(() => backBar.label.set(null));
  }

  toggleSwitcher(): void {
    this.switcherOpen.update((open) => !open);
  }

  closeSwitcher(): void {
    this.switcherOpen.set(false);
  }

  /** Back through history while it stays in the app; a page opened directly goes back to Home. */
  back(): void {
    if (this.navState.hasInAppHistory()) {
      this.location.back();
    } else {
      void this.router.navigateByUrl('/dashboard');
    }
  }
}
