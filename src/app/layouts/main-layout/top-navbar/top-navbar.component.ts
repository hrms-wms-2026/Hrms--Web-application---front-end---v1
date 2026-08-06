import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CompanySelectorComponent } from './company-selector/company-selector.component';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [CompanySelectorComponent, ProfileMenuComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavbarComponent {
  readonly avatarUrl = input<string | null>();
  readonly userName = input<string | null>();
  readonly email = input<string | null>();
}
