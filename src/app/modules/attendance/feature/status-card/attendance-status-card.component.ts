import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TimeTrackingAction, TimeTrackingStore } from '../../state/time-tracking.store';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  statusLabel,
  workModeLabel
} from '../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-status-card',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-status-card.component.html',
  styleUrl: './attendance-status-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceStatusCardComponent {
  readonly store = inject(TimeTrackingStore);

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly statusLabel = statusLabel;
  readonly workModeLabel = workModeLabel;

  readonly workedPercent = computed(() => {
    const today = this.store.today();
    if (!today || !today.requiredWorkMinutes) return 0;
    return Math.min(100, Math.round((today.totalWorkedMinutes / today.requiredWorkMinutes) * 100));
  });

  actionIsLoading(action: TimeTrackingAction): boolean {
    return this.store.activeAction() === action;
  }
}
