import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { AttendanceTrendCardComponent } from '../../../dashboard/feature/attendance-trend-card/attendance-trend-card.component';
import { AttendanceStatusCardComponent } from '../status-card/attendance-status-card.component';
import { AttendanceMonthlyHealthCardComponent } from '../monthly-health-card/attendance-monthly-health-card.component';
import { AttendanceRequestsSummaryCardComponent } from '../requests-summary-card/attendance-requests-summary-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

@Component({
  selector: 'app-attendance-overview',
  standalone: true,
  imports: [
    AttendanceMonthlyHealthCardComponent,
    AttendanceRequestsSummaryCardComponent,
    AttendanceStatusCardComponent,
    AttendanceTrendCardComponent,
    BreadcrumbHeaderComponent,
    RouterLink
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewComponent {
  private readonly store = inject(TimeTrackingStore);

  readonly canShowTeamLink = computed(() => this.store.today()?.canViewCoveredEmployees ?? false);
}
