import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/state/auth.store';
import { NavigationStateService } from './nav/navigation-state.service';
import { SideNavbarComponent } from './side-navbar/side-navbar.component';
import { SubSidebarComponent } from './sub-sidebar/sub-sidebar.component';
import { TopNavbarComponent } from './top-navbar/top-navbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SideNavbarComponent, TopNavbarComponent, SubSidebarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  private readonly authStore = inject(AuthStore);
  readonly navState = inject(NavigationStateService);

  readonly email = this.authStore.email;
  readonly announcementMessage = signal('');
}
