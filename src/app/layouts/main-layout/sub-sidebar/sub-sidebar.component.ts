import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../nav/nav-item.model';

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
  sectionLabel = input.required<string>();
  items = input.required<readonly NavItem[]>();
}
