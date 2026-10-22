import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NavItem } from '../nav/nav-item.model';
import { NavigationStateService } from '../nav/navigation-state.service';
import { NavIconComponent } from '../side-navbar/nav-icon.component';

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, NavIconComponent],
  templateUrl: './mobile-bottom-nav.component.html',
  styleUrl: './mobile-bottom-nav.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileBottomNavComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);

  readonly visibleItems = this.navState.visibleItems;
  readonly entryPath = (item: NavItem): string => this.navState.entryPath(item);
  readonly activeItem = this.navState.activeItem;
  readonly activeChildren = this.navState.activeChildren;

  isChildActive(path: string): boolean {
    return this.router.url === path || this.router.url.startsWith(`${path}/`);
  }
}
