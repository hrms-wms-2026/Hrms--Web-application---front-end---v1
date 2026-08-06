import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Illustrative, static HTML/CSS mock of the ONEVO dashboard for the public landing page hero.
 * Not wired to any API and not interactive - purely decorative, so the whole widget is
 * aria-hidden (the surrounding hero copy already conveys the same information in text).
 */
@Component({
  selector: 'app-landing-dashboard-preview',
  standalone: true,
  templateUrl: './landing-dashboard-preview.component.html',
  styleUrl: './landing-dashboard-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingDashboardPreviewComponent {}
