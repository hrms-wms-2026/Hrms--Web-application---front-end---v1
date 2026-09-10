import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { AttendanceTrendCardComponent } from '../../../dashboard/feature/attendance-trend-card/attendance-trend-card.component';
import { AttendanceStatusCardComponent } from '../status-card/attendance-status-card.component';
import { AttendanceMonthlyHealthCardComponent } from '../monthly-health-card/attendance-monthly-health-card.component';
import { AttendanceRequestsSummaryCardComponent } from '../requests-summary-card/attendance-requests-summary-card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { fullDateLabel, greetingForTime, statusLabel } from '../../utils/attendance-formatters';

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
export class OverviewComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  readonly today = this.store.today;
  readonly fullDateLabel = fullDateLabel;
  readonly statusLabel = statusLabel;

  readonly canShowTeamLink = computed(() => this.store.today()?.canViewCoveredEmployees ?? false);

  readonly greeting = computed(() => {
    const today = this.store.today();
    return greetingForTime(new Date(), today?.timezone);
  });

  ngOnInit(): void {
    void this.store.loadToday();
  }
}
