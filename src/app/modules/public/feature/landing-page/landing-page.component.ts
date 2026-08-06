import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { LandingHeaderComponent } from '../../ui/landing-header/landing-header.component';
import { LandingDashboardPreviewComponent } from '../../ui/landing-dashboard-preview/landing-dashboard-preview.component';
import { LandingValuePillarsComponent } from '../../ui/landing-value-pillars/landing-value-pillars.component';

/** Public marketing landing page at "/". Unauthenticated visitors land here; an already
 * signed-in visitor is bounced to /dashboard by redirectIfAuthenticatedGuard before this
 * component is even created (see app.routes.ts). */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, LandingHeaderComponent, LandingDashboardPreviewComponent, LandingValuePillarsComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPageComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle('ONEXSO | Workforce Management Platform');
    this.meta.updateTag({
      name: 'description',
      content:
        'ONEXSO brings employee information, attendance, time off, work and approvals together in one clear workspace for your whole business.'
    });
  }
}
