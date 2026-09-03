import { Component, computed, input } from '@angular/core';
import { AvatarComponent } from '../avatar/avatar.component';

@Component({
  selector: 'app-home-page-profile-capsule',
  standalone: true,
  imports: [AvatarComponent],
  template: `<app-avatar [avatarUrl]="avatarUrl()" [userName]="userName()" [email]="email()" size="md" />`
})
export class HomePageProfileCapsuleComponent {
  readonly avatarUrl = input<string | null>();
  readonly userName = input<string | null>();
  readonly email = input<string | null>();

  readonly displayText = computed(() => this.userName()?.trim() || this.email()?.trim() || 'User');
}
