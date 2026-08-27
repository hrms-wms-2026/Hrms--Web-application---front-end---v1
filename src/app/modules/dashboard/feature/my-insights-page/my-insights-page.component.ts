import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AttendanceTrendCardComponent } from '../attendance-trend-card/attendance-trend-card.component';
import { TaskProgressCardComponent } from '../task-progress-card/task-progress-card.component';

@Component({
  selector: 'app-my-insights-page',
  standalone: true,
  imports: [RouterLink, AttendanceTrendCardComponent, TaskProgressCardComponent],
  templateUrl: './my-insights-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyInsightsPageComponent {}
