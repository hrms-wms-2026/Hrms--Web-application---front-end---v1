import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
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

  // Time Tracking shows its own date+status heading here (this is the top of that page);
  // Overview's page-level greeting row already carries the date and status, so it passes
  // false to avoid showing both. The action buttons move down next to the meta row in that
  // case instead of disappearing.
  readonly showHeader = input(true);

  // 'summary' (Overview): Worked/Scheduled/Break-remaining tiles + a worked-vs-scheduled
  // progress bar - a dashboard glance. 'session' (Time Tracking): one big current-session
  // number - Time Tracking has its own separate "Today's total" breakdown lower on the page,
  // so repeating the same tiles up here would just duplicate that detail.
  readonly layout = input<'summary' | 'session'>('summary');
  readonly borderless = input(false);

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

  // Restored from the "Break time" metric card removed from Time Tracking's template -
  // that card's overage/used-up messaging had no equivalent here, so deleting it as a
  // duplicate silently dropped real, previously-tested behavior instead of consolidating it.
  readonly hasBreakOverage = computed(() => {
    const today = this.store.today();
    return !!today && (!!today.isOverBreakAllowance || (today.breakOverageMinutes ?? 0) > 0);
  });

  breakOverageLabel(value: number | null | undefined): string {
    return `Break time exceeded by ${Math.max(0, value ?? 0)} min.`;
  }

  actionIsLoading(action: TimeTrackingAction): boolean {
    return this.store.activeAction() === action;
  }
}
