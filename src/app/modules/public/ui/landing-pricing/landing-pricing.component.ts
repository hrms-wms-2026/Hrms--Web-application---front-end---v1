import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-pricing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-pricing.component.html',
  styleUrl: './landing-pricing.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPricingComponent {}
