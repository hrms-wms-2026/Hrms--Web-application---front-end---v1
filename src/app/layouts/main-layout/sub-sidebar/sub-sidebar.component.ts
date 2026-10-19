import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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

  /** Consecutive items with the same section form one titled group; items without a section form an untitled one. */
  readonly groups = computed(() => {
    const groups: { title: string | null; items: NavItem[] }[] = [];
    for (const item of this.items()) {
      const title = item.section ?? null;
      const last = groups[groups.length - 1];
      if (last && last.title === title) {
        last.items.push(item);
      } else {
        groups.push({ title, items: [item] });
      }
    }
    return groups;
  });

  collapse(): void {
    this.navState.collapseSubSidebar();
  }
}
