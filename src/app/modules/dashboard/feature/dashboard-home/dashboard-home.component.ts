import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';
import { WellbeingCarouselCardComponent } from '../wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../work-pattern-card/work-pattern-card.component';

/**
 * Employee dashboard content area for the authenticated dashboard route.
 * Attendance Trend and Task Progress moved to the My Insights page
 * (see quick-actions-card); Activity Timeline got its own full page too.
 * See docs/superpowers/specs (2nd brain vault) for the remaining later phase
 * (Today's Schedule).
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    TodayAtAGlanceCardComponent,
    QuickActionsCardComponent,
    MyTasksCardComponent,
    WorkPatternCardComponent,
    WellbeingCarouselCardComponent
  ],
  template: `
    <div class="dashboard-home grid grid-cols-1 gap-4 lg:grid-cols-2">
      <app-today-at-a-glance-card />
      <app-quick-actions-card />
      <app-my-tasks-card />
      <app-work-pattern-card />
      <app-wellbeing-carousel-card class="lg:col-start-2" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
