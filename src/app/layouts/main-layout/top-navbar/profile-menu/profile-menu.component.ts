import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ModalSize, PopupIcon } from '../../../../shared/ui/modal/modal.component';
import { PreferencesModalComponent, PreferenceTab } from '../../../../shared/ui/preferences-modal/preferences-modal.component';
import { AppearancePanelComponent } from '../../../../shared/ui/appearance-panel/appearance-panel.component';
import { ProfileTabComponent } from '@modules/profile/feature/profile-tab/profile-tab.component';
import { PROFILE_SUB_TABS, ProfileSubTabId, isProfileSubTabId } from '@modules/profile/models/profile-subtab.model';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [PopoverComponent, AvatarComponent, PreferencesModalComponent, AppearancePanelComponent, ProfileTabComponent],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileMenuComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly avatarUrl = input<string | null | undefined>(undefined);
  readonly userName = input<string | null | undefined>(undefined);
  readonly email = input<string | null | undefined>(undefined);

  readonly isOpen = signal(false);
  /**
   * Viewing the app is what makes someone online (the backend counts web-app requests), so the
   * badge only drops when this browser loses its connection.
   */
  readonly isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly isPreferencesOpen = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;
    const sync = () => this.isOnline.set(navigator.onLine);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    });
  }
  readonly activeMode = signal<'appearance' | 'profile'>('appearance');
  readonly activeProfileSubTab = signal<ProfileSubTabId>('personal');

  readonly activeTabId = computed(() => this.activeMode());

  readonly profilePreferenceTabs: readonly PreferenceTab[] = [
    { id: 'personal', label: 'Personal information', icon: 'user' },
    { id: 'emergency', label: 'Emergency contact', icon: 'user-check' },
    { id: 'job', label: 'Job information', icon: 'briefcase' },
    { id: 'documents', label: 'My documents', icon: 'folder' },
    { id: 'payroll', label: 'Payroll & statutory', icon: 'credit-card' },
    { id: 'security', label: 'Security settings', icon: 'shield' }
  ];

  readonly appearancePreferenceTabs: readonly PreferenceTab[] = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' }
  ];

  readonly activePreferenceTabs = computed<readonly PreferenceTab[]>(() => {
    if (this.activeMode() === 'profile') {
      return this.profilePreferenceTabs;
    }
    return [];
  });

  readonly preferenceModalSize = computed<ModalSize>(() => {
    return this.activeMode() === 'profile' ? '2xl' : 'xl';
  });

  readonly currentActiveSidebarTabId = computed<string>(() => {
    return this.activeMode() === 'profile' ? this.activeProfileSubTab() : 'appearance';
  });

  readonly preferencesTitle = computed(() => {
    return this.activeMode() === 'profile' ? 'Profile' : 'Appearance';
  });

  readonly preferencesIcon = computed<PopupIcon | ''>(() => (this.activeMode() === 'profile' ? 'user' : ''));

  readonly preferencesSubtitle = computed(() =>
    this.activeMode() === 'profile' ? 'Manage your personal and employment information.' : ''
  );

  readonly profileSubTabs = PROFILE_SUB_TABS;

  readonly displayName = computed(() => {
    const name = this.userName()?.trim();
    if (name) return name;

    const mail = this.email()?.trim();
    if (mail) {
      const localPart = mail.split('@')[0];
      const words = localPart.split(/[._-]/).filter(Boolean);
      if (words.length > 0) {
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return 'Account';
  });

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  openPreferences(tabId: 'appearance' | 'profile' = 'appearance'): void {
    this.close();
    this.activeMode.set(tabId);
    if (tabId === 'profile') {
      this.activeProfileSubTab.set('personal');
    }
    this.isPreferencesOpen.set(true);
  }

  closePreferences(): void {
    this.isPreferencesOpen.set(false);
  }

  onSidebarTabIdChange(tabId: string): void {
    if (this.activeMode() === 'profile') {
      if (isProfileSubTabId(tabId)) {
        this.activeProfileSubTab.set(tabId);
      }
    } else {
      if (tabId === 'appearance' || tabId === 'profile') {
        this.activeMode.set(tabId);
      }
    }
  }

  onProfileSubTabChange(subTabId: string): void {
    if (isProfileSubTabId(subTabId)) {
      this.activeProfileSubTab.set(subTabId);
    }
  }

  async onLogout(): Promise<void> {
    this.close();
    const success = await this.authStore.logout();
    if (success) {
      await this.router.navigate(['/auth/login']);
    } else {
      this.notificationService.error('Could not log out. Try again.');
    }
  }
}
