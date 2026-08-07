import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-landing-stats-bar',
  standalone: true,
  templateUrl: './landing-stats-bar.component.html',
  styleUrl: './landing-stats-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingStatsBarComponent {}
