import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { correctionTypeLabel, correctionStatusLabel } from '../../models/attendance-correction.model';
import { workAreaChangeStatusLabel } from '../../models/work-area-change-request.model';
import { formatDate } from '../../utils/attendance-formatters';

const MAX_ITEMS = 3;

export interface RequestSummaryItem {
  readonly title: string;
  readonly dateLabel: string;
  readonly status: string;
  readonly statusLabel: string;
}

@Component({
  selector: 'app-attendance-requests-summary-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './attendance-requests-summary-card.component.html',
  styleUrl: './attendance-requests-summary-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceRequestsSummaryCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly pendingCount = computed(() =>
    this.store.myCorrections().filter((item) => item.status === 'pending').length
    + this.store.myWorkAreaRequests().filter((item) => item.status === 'pending').length
  );

  // Neither list carries a submission timestamp both share (corrections have no
  // "requestedAt", only the work date the correction applies to) - each API already returns
  // its own list newest-first, so recency is preserved within each type; corrections are
  // shown first since that's the more common request type here.
  protected readonly recentRequests = computed<RequestSummaryItem[]>(() => {
    const corrections: RequestSummaryItem[] = this.store.myCorrections().map((item) => ({
      title: correctionTypeLabel(item.correctionType),
      dateLabel: formatDate(item.workDate),
      status: item.status,
      statusLabel: correctionStatusLabel(item.status)
    }));
    const workAreaChanges: RequestSummaryItem[] = this.store.myWorkAreaRequests().map((item) => ({
      title: 'Work-area change',
      dateLabel: formatDate(item.date),
      status: item.status,
      statusLabel: workAreaChangeStatusLabel(item.status)
    }));
    return [...corrections, ...workAreaChanges].slice(0, MAX_ITEMS);
  });

  ngOnInit(): void {
    if (!this.store.myCorrectionsLoaded()) void this.store.loadMyCorrections();
    if (!this.store.myWorkAreaRequestsLoaded()) void this.store.loadMyWorkAreaRequests();
  }
}
