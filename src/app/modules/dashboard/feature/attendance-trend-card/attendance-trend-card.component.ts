import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { AttendanceHistoryRow, TimeTrackingRange } from '../../../attendance/models/time-tracking.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface DayBar {
  readonly label: string;
  readonly minutes: number;
  readonly hours: number;
  readonly hoursLabel: string;
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
  private readonly generalSettingsStore = inject(GeneralSettingsStore, { optional: true });
  private readonly legalEntityStore = inject(LegalEntityStore, { optional: true });
  // Company General Settings is an admin endpoint (legal_entity:read/update) - a self-service
  // user would get a 403, so they use today's requiredWorkMinutes fallback instead.
  private readonly canReadCompanySettings = inject(PermissionService).hasAnyPermission(['legal_entity:read', 'legal_entity:update']);

  constructor() {
    effect(() => {
      if (!this.canReadCompanySettings) return;
      const legalEntityId = this.store.today?.()?.legalEntityId || this.legalEntityStore?.selectedLegalEntityId();
      if (legalEntityId && this.generalSettingsStore && this.generalSettingsStore.legalEntityId() !== legalEntityId) {
        void this.generalSettingsStore.load(legalEntityId);
      }
    });
  }

  protected readonly loading = this.store.historyLoading;

  protected readonly dailyGoalMinutes = computed(() => {
    const settings = this.generalSettingsStore?.settings();
    const fromSettings = parseNetWorkMinutes(settings?.workStartTime, settings?.workEndTime, settings?.breakDurationMinutes);
    if (fromSettings && fromSettings > 0) return fromSettings;

    const todayRequired = this.store.today?.()?.requiredWorkMinutes;
    if (todayRequired && todayRequired > 0) return todayRequired;

    return 8 * 60;
  });

  protected readonly workingDaysCount = computed(() => {
    const settings = this.generalSettingsStore?.settings();
    if (settings?.standardWorkingDays && settings.standardWorkingDays.length > 0) {
      return settings.standardWorkingDays.length;
    }
    return 5;
  });

  protected readonly weeklyGoalMinutes = computed(() => {
    return this.dailyGoalMinutes() * this.workingDaysCount();
  });

  protected readonly weeklyGoalLabel = computed(() => {
    return formatHours(this.weeklyGoalMinutes());
  });

  protected readonly dailyGoalHours = computed(() => {
    return this.dailyGoalMinutes() / 60;
  });

  protected readonly dailyGoalLabel = computed(() => {
    const mins = this.dailyGoalMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m/day` : `${h}h/day`;
  });

  protected readonly chartScaleHours = computed(() => {
    return Math.max(10, Math.ceil(this.dailyGoalHours() * 1.25));
  });

  protected readonly goalLinePercent = computed(() => {
    return (this.dailyGoalHours() / this.chartScaleHours()) * 100;
  });

  protected readonly days = computed<DayBar[]>(() => {
    const history = this.store.history();
    const today = this.store.today ? this.store.today() : null;
    return buildWeekBars(history, today, this.chartScaleHours());
  });

  // Summed from `days()` (the same Mon-Sun rows the bars are built from), not raw
  // `store.history()` - that signal can hold rows outside the plotted week (a shared,
  // root-provided store also written by Time Tracking's own history range), which
  // previously produced a nonzero total alongside all-zero bars whenever the two diverged.
  protected readonly totalHoursLabel = computed(() => {
    const totalMinutes = this.days().reduce((sum, day) => sum + day.minutes, 0);
    return formatHours(totalMinutes);
  });

  ngOnInit(): void {
    void this.store.loadMyHistory(currentWeekRange());
  }
}

export function parseNetWorkMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  breakMinutes: number | null | undefined
): number | null {
  if (!startTime || !endTime) return null;
  const startParts = startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);
  if (startParts.length !== 2 || endParts.length !== 2 || isNaN(startParts[0]) || isNaN(endParts[0])) {
    return null;
  }
  const startMins = startParts[0] * 60 + startParts[1];
  const endMins = endParts[0] * 60 + endParts[1];
  if (startMins >= endMins) return null;
  const shiftMins = endMins - startMins;
  const breakM = Math.max(0, breakMinutes ?? 0);
  return Math.max(0, shiftMins - breakM);
}

function buildWeekBars(
  history: readonly AttendanceHistoryRow[],
  today?: { workDate?: string; totalWorkedMinutes?: number } | null,
  scaleHours = 10
): DayBar[] {
  const minutesByDate = new Map(history.map((row) => [row.workDate, row.totalWorkedMinutes]));
  if (today?.workDate && typeof today.totalWorkedMinutes === 'number') {
    const recorded = minutesByDate.get(today.workDate) ?? 0;
    if (today.totalWorkedMinutes > recorded) {
      minutesByDate.set(today.workDate, today.totalWorkedMinutes);
    }
  }
  const range = currentWeekRange();
  const [year, month, day] = range.from.split('-').map(Number);
  const monday = new Date(year, month - 1, day);

  return DAY_LABELS.map((label, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const workDate = toDateOnly(date);
    const minutes = minutesByDate.get(workDate) ?? 0;
    const hours = minutes / 60;
    return {
      label,
      minutes,
      hours,
      hoursLabel: formatHours(minutes),
      heightPercent: Math.min(100, (hours / scaleHours) * 100)
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
