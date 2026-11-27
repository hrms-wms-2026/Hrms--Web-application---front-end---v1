import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { QuickSearchService } from '../quick-search/quick-search.service';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import { CompanySelectorComponent } from './company-selector/company-selector.component';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [CompanySelectorComponent, ProfileMenuComponent, NotificationBellComponent, PageToolbarComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavbarComponent {
  protected readonly quickSearch = inject(QuickSearchService);
  /** Mac users press Cmd, everyone else Ctrl. */
  protected readonly shortcutLabel = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';

  readonly avatarUrl = input<string | null>();
  readonly userName = input<string | null>();
  readonly email = input<string | null>();
}
