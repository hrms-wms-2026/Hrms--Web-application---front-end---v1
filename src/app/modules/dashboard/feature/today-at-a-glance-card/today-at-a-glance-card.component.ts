import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

@Component({
  selector: 'app-today-at-a-glance-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './today-at-a-glance-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayAtAGlanceCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;

  protected readonly statusLabel = computed(() => {
    const today = this.today();
    return today ? STATUS_LABELS[today.attendanceStatus] ?? 'Not specified' : '';
  });

  protected readonly clockInTimeLabel = computed(() => {
    const clockInAt = this.today()?.clockInAt;
    if (!clockInAt) {
      return null;
    }
    const date = new Date(clockInAt);
    return Number.isNaN(date.getTime())
      ? null
      : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  });

  protected readonly workedTimeLabel = computed(() => formatMinutes(this.today()?.totalWorkedMinutes ?? null));

  ngOnInit(): void {
    void this.store.loadToday();
  }
}

function formatMinutes(value: number | null): string {
  if (value === null || value < 0) {
    return '—';
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
