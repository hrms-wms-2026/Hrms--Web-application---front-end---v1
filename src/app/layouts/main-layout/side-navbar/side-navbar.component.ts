import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  templateUrl: './side-navbar.component.html',
  styleUrl: './side-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavbarComponent {}
