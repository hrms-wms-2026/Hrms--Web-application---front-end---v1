import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HomePageProfileCapsuleComponent } from '../../../shared/ui/home-page-profile-capsule/home-page-profile-capsule.component';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [HomePageProfileCapsuleComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavbarComponent {
  readonly userName = input<string | null>();
  readonly email = input<string | null>();
}
