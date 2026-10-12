import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { PageToolbarService } from '../../../shared/state/page-toolbar.service';
import { CompanySelectorComponent } from './company-selector/company-selector.component';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [CompanySelectorComponent, ProfileMenuComponent, NotificationBellComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavbarComponent {
  readonly avatarUrl = input<string | null>();
  readonly userName = input<string | null>();
  readonly email = input<string | null>();

  /** Set by whichever page is mounted (e.g. the dashboard's "Customize") - empty on every other page. */
  protected readonly toolbar = inject(PageToolbarService);
}
