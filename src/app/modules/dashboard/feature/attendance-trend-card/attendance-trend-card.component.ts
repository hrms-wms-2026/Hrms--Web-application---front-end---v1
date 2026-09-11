import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { AttendanceHistoryRow, TimeTrackingRange } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKLY_GOAL_MINUTES = 40 * 60;
const DAILY_GOAL_HOURS = 8;
const CHART_SCALE_HOURS = 10;

export interface DayBar {
  readonly label: string;
  readonly hours: number;
  readonly heightPercent: number;
}

@Component({
  selector: 'app-attendance-trend-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './attendance-trend-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceTrendCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);

  protected readonly loading = this.store.historyLoading;
  protected readonly goalHours = DAILY_GOAL_HOURS;
  protected readonly goalLinePercent = (DAILY_GOAL_HOURS / CHART_SCALE_HOURS) * 100;

  protected readonly days = computed<DayBar[]>(() => buildWeekBars(this.store.history()));

  protected readonly totalHoursLabel = computed(() => {
    const totalMinutes = this.store.history().reduce((sum, row) => sum + row.totalWorkedMinutes, 0);
    return formatHours(totalMinutes);
  });

  protected readonly weeklyGoalLabel = formatHours(WEEKLY_GOAL_MINUTES);

  ngOnInit(): void {
    void this.store.loadMyHistory(currentWeekRange());
  }
}

function buildWeekBars(history: readonly AttendanceHistoryRow[]): DayBar[] {
  const minutesByDate = new Map(history.map((row) => [row.workDate, row.totalWorkedMinutes]));
  const range = currentWeekRange();
  const monday = new Date(`${range.from}T00:00:00`);

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday.getTime() + index * DAY_IN_MILLISECONDS);
    const workDate = toDateOnly(date);
    const minutes = minutesByDate.get(workDate) ?? 0;
    const hours = minutes / 60;
    return {
      label,
      hours,
      heightPercent: Math.min(100, (hours / CHART_SCALE_HOURS) * 100)
    };
  });
}

function currentWeekRange(reference = new Date()): TimeTrackingRange {
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  const dayOfWeek = referenceDay.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(referenceDay.getTime() + mondayOffset * DAY_IN_MILLISECONDS);
  const sunday = new Date(monday.getTime() + 6 * DAY_IN_MILLISECONDS);
  return { from: toDateOnly(monday), to: toDateOnly(sunday) };
}

function toDateOnly(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}
