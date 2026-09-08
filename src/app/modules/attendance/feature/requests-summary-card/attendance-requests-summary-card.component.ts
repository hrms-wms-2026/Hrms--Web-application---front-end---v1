import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';

@Component({
  selector: 'app-attendance-requests-summary-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './attendance-requests-summary-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceRequestsSummaryCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly pendingCount = computed(() =>
    this.store.myCorrections().filter((item) => item.status === 'pending').length
    + this.store.myWorkAreaRequests().filter((item) => item.status === 'pending').length
  );

  ngOnInit(): void {
    if (!this.store.myCorrectionsLoaded()) void this.store.loadMyCorrections();
    if (!this.store.myWorkAreaRequestsLoaded()) void this.store.loadMyWorkAreaRequests();
  }
}
