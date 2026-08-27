import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { WorkPatternDay } from '../../models/work-pattern.model';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_SCALE_HOURS = 10;

export interface StackedDayBar {
  readonly label: string;
  readonly focusHeightPercent: number;
  readonly meetingHeightPercent: number;
  readonly adminHeightPercent: number;
}

@Component({
  selector: 'app-work-pattern-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './work-pattern-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkPatternCardComponent implements OnInit {
  private readonly api = inject(WorkPatternApiService);

  private readonly rawDays = signal<WorkPatternDay[]>([]);
  protected readonly loading = signal(true);

  protected readonly days = computed<StackedDayBar[]>(() => buildWeekBars(this.rawDays()));

  protected readonly weeklyFocusLabel = computed(() =>
    formatHours(this.rawDays().reduce((sum, d) => sum + d.focusMinutes, 0))
  );

  ngOnInit(): void {
    const range = currentWeekRange();
    this.api.getMyWorkPattern(range.from, range.to).subscribe({
      next: (response) => {
        this.rawDays.set(response.days);
        this.loading.set(false);
      },
      error: () => {
        this.rawDays.set([]);
        this.loading.set(false);
      }
    });
  }
}

function buildWeekBars(days: readonly WorkPatternDay[]): StackedDayBar[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const range = currentWeekRange();
  const monday = new Date(`${range.from}T00:00:00`);

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday.getTime() + index * DAY_IN_MILLISECONDS);
    const day = byDate.get(toDateOnly(date));
    const focusHours = (day?.focusMinutes ?? 0) / 60;
    const meetingHours = (day?.meetingMinutes ?? 0) / 60;
    const adminHours = (day?.adminMinutes ?? 0) / 60;
    return {
      label,
      focusHeightPercent: Math.min(100, (focusHours / CHART_SCALE_HOURS) * 100),
      meetingHeightPercent: Math.min(100, (meetingHours / CHART_SCALE_HOURS) * 100),
      adminHeightPercent: Math.min(100, (adminHours / CHART_SCALE_HOURS) * 100)
    };
  });
}

function currentWeekRange(reference = new Date()): { from: string; to: string } {
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
