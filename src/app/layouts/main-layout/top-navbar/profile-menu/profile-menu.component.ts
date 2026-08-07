import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PreferencesModalComponent } from '../../../../shared/ui/preferences-modal/preferences-modal.component';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [PopoverComponent, AvatarComponent, PreferencesModalComponent],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileMenuComponent {
  readonly avatarUrl = input<string | null | undefined>(undefined);
  readonly userName = input<string | null | undefined>(undefined);
  readonly email = input<string | null | undefined>(undefined);

  readonly isOpen = signal(false);
  readonly isPreferencesOpen = signal(false);

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

  openPreferences(): void {
    this.close();
    this.isPreferencesOpen.set(true);
  }

  closePreferences(): void {
    this.isPreferencesOpen.set(false);
  }
}
