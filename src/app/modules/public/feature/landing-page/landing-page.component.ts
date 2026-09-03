import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { LandingHeaderComponent } from '../../ui/landing-header/landing-header.component';
import { LandingHeroComponent } from '../../ui/landing-hero/landing-hero.component';
import { LandingBentoGridComponent } from '../../ui/landing-bento-grid/landing-bento-grid.component';
import { LandingFeatureTabsComponent } from '../../ui/landing-feature-tabs/landing-feature-tabs.component';
import { LandingWalkthroughComponent } from '../../ui/landing-walkthrough/landing-walkthrough.component';
import { LandingFaqComponent } from '../../ui/landing-faq/landing-faq.component';
import { LandingFooterComponent } from '../../ui/landing-footer/landing-footer.component';

/**
 * Public marketing landing page at "/". Unauthenticated visitors land here;
 * signed-in visitors are redirected to /dashboard by redirectIfAuthenticatedGuard.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingBentoGridComponent,
    LandingFeatureTabsComponent,
    LandingWalkthroughComponent,
    LandingFaqComponent,
    LandingFooterComponent
  ],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPageComponent {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.title.setTitle('ONEVO Workspace | Turning Workforce Visibility Into Performance');
    this.meta.updateTag({
      name: 'description',
      content:
        'ONEVO Workspace unifies zero-touch attendance, Actual vs Reported work intelligence, and exception-based leadership into one clear platform.'
    });
  }
}
