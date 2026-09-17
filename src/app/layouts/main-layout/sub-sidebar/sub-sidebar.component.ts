import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../nav/nav-item.model';
import { NavigationStateService } from '../nav/navigation-state.service';

/**
 * Reusable module-specific sub-navigation shell (Organization, Settings, and any future
 * module with sub-pages). Takes the already-permission-filtered children of one top-level
 * NavItem; does not filter or call APIs itself.
 */
@Component({
  selector: 'app-sub-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sub-sidebar.component.html',
  styleUrl: './sub-sidebar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubSidebarComponent {
  private readonly navState = inject(NavigationStateService);

  sectionLabel = input.required<string>();
  items = input.required<readonly NavItem[]>();

  collapse(): void {
    this.navState.collapseSubSidebar();
  }
}
