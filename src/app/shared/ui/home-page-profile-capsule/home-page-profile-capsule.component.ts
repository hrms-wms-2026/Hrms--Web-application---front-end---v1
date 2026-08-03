import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-home-page-profile-capsule',
  standalone: true,
  templateUrl: './home-page-profile-capsule.component.html',
  styleUrl: './home-page-profile-capsule.component.css'
})
export class HomePageProfileCapsuleComponent {
  readonly userName = input<string | null>();
  readonly email = input<string | null>();

  readonly displayText = computed(() => this.userName()?.trim() || this.email()?.trim() || 'User');
}
