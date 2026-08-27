import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, untracked } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  sourceLabel,
  statusLabel,
  timelineEventLabel,
  workModeLabel
} from '../../../utils/attendance-formatters';

export interface AttendanceDetailSelection {
  employeeId: string;
  workDate: string;
}

@Component({
  selector: 'app-attendance-detail-drawer',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-detail-drawer.component.html',
  styleUrl: './attendance-detail-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceDetailDrawerComponent {
  readonly store = inject(TimeTrackingStore);

  readonly selection = input<AttendanceDetailSelection | null>(null);
  readonly displayTimezone = input<string>('UTC');
  readonly closed = output<void>();
  readonly requestCorrection = output<AttendanceHistoryRow>();

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly workModeLabel = workModeLabel;
  readonly sourceLabel = sourceLabel;
  readonly statusLabel = statusLabel;
  readonly timelineEventLabel = timelineEventLabel;

  readonly appUsageByCategory = computed(() => {
    const activity = this.store.dayDetail()?.dailyActivity;
    if (!activity) return [];
    const totals = new Map<string, number>();
    for (const app of activity.topApps) {
      const category = app.category || 'unknown';
      totals.set(category, (totals.get(category) ?? 0) + Math.round(app.totalSeconds / 60));
    }
    return Array.from(totals.entries()).map(([category, minutes]) => ({ category, minutes }));
  });

  constructor() {
    effect(() => {
      const selected = this.selection();
      if (selected) {
        untracked(() => {
          void this.store.loadDayDetail(selected.employeeId, selected.workDate);
        });
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  retry(): void {
    const selected = this.selection();
    if (selected) {
      void this.store.loadDayDetail(selected.employeeId, selected.workDate);
    }
  }

  emitRequestCorrection(): void {
    const detail = this.store.dayDetail();
    if (detail) {
      this.requestCorrection.emit(detail.summary);
    }
  }
}
