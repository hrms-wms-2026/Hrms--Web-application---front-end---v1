import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-insights-banner',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-insights-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardInsightsBannerComponent {}
