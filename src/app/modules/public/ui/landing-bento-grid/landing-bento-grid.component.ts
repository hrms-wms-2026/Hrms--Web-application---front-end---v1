import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-landing-bento-grid',
  standalone: true,
  templateUrl: './landing-bento-grid.component.html',
  styleUrl: './landing-bento-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingBentoGridComponent {}
