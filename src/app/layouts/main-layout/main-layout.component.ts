import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TrayPresenceStore } from '../../core/tray-presence/state/tray-presence.store';
import { TrayActivationGateComponent } from '../../core/tray-presence/feature/tray-activation-gate/tray-activation-gate.component';
import { LockedWorkspacePreviewComponent } from '../../core/tray-presence/ui/locked-workspace-preview/locked-workspace-preview.component';

import { AuthStore } from '../../core/auth/state/auth.store';
import { NavigationStateService } from './nav/navigation-state.service';
import { SideNavbarComponent } from './side-navbar/side-navbar.component';
import { SubSidebarComponent } from './sub-sidebar/sub-sidebar.component';
import { TopNavbarComponent } from './top-navbar/top-navbar.component';

import { ToastHostComponent } from '../../shared/ui/toast/toast-host.component';
import { MobileBottomNavComponent } from './mobile-bottom-nav/mobile-bottom-nav.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
    imports: [RouterOutlet, SideNavbarComponent, TopNavbarComponent, SubSidebarComponent, ToastHostComponent, MobileBottomNavComponent, TrayActivationGateComponent, LockedWorkspacePreviewComponent],

  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
    private readonly authStore = inject(AuthStore);
  readonly trayPresence = inject(TrayPresenceStore);

  readonly navState = inject(NavigationStateService);

  readonly email = this.authStore.email;
    readonly announcementMessage = signal('');

  constructor() {
    this.trayPresence.start();
  }

}
