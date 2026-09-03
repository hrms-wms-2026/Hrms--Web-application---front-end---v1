import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardInsightsBannerComponent } from '../dashboard-insights-banner/dashboard-insights-banner.component';
import { MyTasksCardComponent } from '../my-tasks-card/my-tasks-card.component';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { TodayAtAGlanceCardComponent } from '../today-at-a-glance-card/today-at-a-glance-card.component';
import { TodaysScheduleCardComponent } from '../todays-schedule-card/todays-schedule-card.component';
import { WellbeingCarouselCardComponent } from '../wellbeing-carousel-card/wellbeing-carousel-card.component';
import { WorkPatternCardComponent } from '../work-pattern-card/work-pattern-card.component';

/**
 * Employee dashboard content area for the authenticated dashboard route.
 * Attendance Trend and Task Progress moved to the My Insights page
 * (see quick-actions-card); Activity Timeline got its own full page too.
 *
 * Layout (V3): normal page flow - the ancestor `.main-content` (main-layout
 * CSS) scrolls the page when content is taller than the viewport. An
 * earlier "fit everything in exactly one screen, no page scroll" version
 * was reverted: it depended on a zero-slack height budget that broke (cards
 * visually overlapping) under real-world zoom/DPI variance we couldn't
 * reproduce or bound reliably. Individual cards still stay a fixed,
 * predictable height with their own internal scroll where content can grow
 * (My Tasks, Today's Schedule) - see those components. Primary row, 3
 * columns: col 1 is a stacked column (Today at a Glance on top, Today's
 * Schedule below it, same width); col 2 is My Tasks; col 3 is a stacked
 * column (Quick Actions on top, Wellbeing below). Work Pattern (This Week)
 * is its own full-width row below that. See docs/dashboard-widget-inventory.md
 * for the per-widget rationale this hierarchy is based on.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  host: { class: 'block' },
  imports: [
    TodayAtAGlanceCardComponent,
    QuickActionsCardComponent,
    MyTasksCardComponent,
    TodaysScheduleCardComponent,
    WorkPatternCardComponent,
    WellbeingCarouselCardComponent,
    DashboardInsightsBannerComponent
  ],
  template: `
    <div class="dashboard-home flex flex-col gap-3">
      <div class="grid grid-cols-1 gap-3 xl:grid-cols-3 xl:items-start" data-testid="dashboard-primary-row">
        <div class="flex flex-col gap-3">
          <app-today-at-a-glance-card />
          <app-todays-schedule-card />
        </div>
        <app-my-tasks-card />
        <div class="flex flex-col gap-3">
          <app-quick-actions-card />
          <app-wellbeing-carousel-card />
        </div>
      </div>

      <div data-testid="dashboard-secondary-row">
        <app-work-pattern-card />
      </div>

      <app-dashboard-insights-banner />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
