import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TrayPresenceStore } from '../../core/tray-presence/state/tray-presence.store';
import { TrayActivationGateComponent } from '../../core/tray-presence/feature/tray-activation-gate/tray-activation-gate.component';
import { LockedWorkspacePreviewComponent } from '../../core/tray-presence/ui/locked-workspace-preview/locked-workspace-preview.component';

import { AuthStore } from '../../core/auth/state/auth.store';
import { PermissionService } from '../../core/auth/state/permission.service';
import { PlannerAvailabilityService } from '../../modules/work/planner/state/planner-availability.service';
import { NavigationStateService } from './nav/navigation-state.service';
import { SideNavbarComponent } from './side-navbar/side-navbar.component';
import { SubSidebarComponent } from './sub-sidebar/sub-sidebar.component';
import { InboxChatSidebarComponent } from '@modules/inbox/ui/chat-sidebar/inbox-chat-sidebar.component';
import { TopNavbarComponent } from './top-navbar/top-navbar.component';
import { ProfileStore } from '@modules/profile/state/profile.store';
import { FileApiService } from '../../shared/data-access/file-api.service';

import { ToastHostComponent } from '../../shared/ui/toast/toast-host.component';
import { MobileBottomNavComponent } from './mobile-bottom-nav/mobile-bottom-nav.component';
import { MobileSectionNavComponent } from './mobile-section-nav/mobile-section-nav.component';
import { UnsavedChangesDialogComponent } from '../../shared/ui/unsaved-changes-dialog/unsaved-changes-dialog.component';
import { DraftsBarComponent } from './drafts-bar/drafts-bar.component';
import { DraftModalHostComponent } from './draft-modal-host/draft-modal-host.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SideNavbarComponent, TopNavbarComponent, SubSidebarComponent, InboxChatSidebarComponent, ToastHostComponent, MobileBottomNavComponent, MobileSectionNavComponent,DraftsBarComponent, DraftModalHostComponent, UnsavedChangesDialogComponent, TrayActivationGateComponent, LockedWorkspacePreviewComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  private readonly authStore = inject(AuthStore);
  private readonly permissionService = inject(PermissionService);
  private readonly profileStore = inject(ProfileStore);
  private readonly fileApi = inject(FileApiService);
  readonly trayPresence = inject(TrayPresenceStore);

  readonly navState = inject(NavigationStateService);
  private readonly plannerAvailability = inject(PlannerAvailabilityService);

  readonly email = this.authStore.email;
  readonly announcementMessage = signal('');

  readonly userName = computed(() => {
    const info = this.profileStore.profile()?.personalInformation;
    if (!info) return null;
    return [info.firstName, info.lastName].filter(Boolean).join(' ').trim() || null;
  });

  readonly avatarUrl = computed(() => {
    const fileId = this.profileStore.profile()?.personalInformation.avatarFileId;
    return fileId ? this.fileApi.getFileUrl(fileId) : null;
  });

  /** Tenants that never enabled the monitoring module have no tray app to connect. */
  readonly monitoringEnabled = this.permissionService.hasModule('activity_monitoring');

  constructor() {
    this.profileStore.loadProfile();
    void this.plannerAvailability.probe();   // decides whether the Planner nav item shows
    if (this.monitoringEnabled) {
      this.trayPresence.start();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === '\\') {
      if (this.navState.hasSubSidebar()) {
        event.preventDefault();
        this.navState.toggleSubSidebar();
      }
    }
  }
}
