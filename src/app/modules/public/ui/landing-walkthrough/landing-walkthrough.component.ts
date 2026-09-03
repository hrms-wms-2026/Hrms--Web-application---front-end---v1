import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-landing-walkthrough',
  standalone: true,
  templateUrl: './landing-walkthrough.component.html',
  styleUrl: './landing-walkthrough.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingWalkthroughComponent {}
