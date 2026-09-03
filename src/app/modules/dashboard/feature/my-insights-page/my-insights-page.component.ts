import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AttendanceTrendCardComponent } from '../attendance-trend-card/attendance-trend-card.component';
import { TaskProgressCardComponent } from '../task-progress-card/task-progress-card.component';
import { BackToHomeLinkComponent } from '../../ui/back-to-home-link/back-to-home-link.component';

@Component({
  selector: 'app-my-insights-page',
  standalone: true,
  imports: [BackToHomeLinkComponent, AttendanceTrendCardComponent, TaskProgressCardComponent],
  templateUrl: './my-insights-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyInsightsPageComponent {}
