import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  DeviceActivityEvidence,
  DeviceActivityState,
  ExceptionEvidenceResponse,
  PatternMeasure
} from '../../models/exception-evidence.model';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../data-table/data-table.component';

/** Attendance record statuses (AttendanceRecord.Status* on the server) in plain words. */
const ATTENDANCE_STATUS_LABELS: Record<string, string | undefined> = {
  normal: 'No issues',
  on_time: 'On time',
  late: 'Late',
  active: 'Still clocked in',
  clocked_out: 'Clocked out',
  on_break: 'On break',
  over_break: 'Break ran over',
  short_hours: 'Short hours',
  missing_clock_out: 'Forgot to clock out',
  not_clocked_in: 'Did not clock in',
  off_day: 'Day off',
  non_working_day: 'Non-working day',
  worked_on_non_working_day: 'Worked on a non-working day',
  on_time_off: 'On leave',
  worked_during_time_off: 'Worked while on leave',
  no_schedule: 'No work schedule',
  policy_not_configured: 'No attendance policy'
};

/** Statuses that are not worth a reviewer's attention: the Attendance line is left out for these. */
const UNREMARKABLE_STATUSES = new Set(['normal', 'on_time', 'active', 'clocked_out']);

const SEGMENT_LABELS: Record<string, string | undefined> = { active: 'Working', idle: 'Idle', offline: 'Off' };

/** A time of day in the evidence's own timezone. */
export function evidenceTime(value: string | null, timezone: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: timezone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
  }
}

/**
 * Flow 09 "validate the issue", the short version for the ticket details: the day's clock-in/out, when the computer
 * was on, a working/idle/off bar and, for multi-day alerts, the pattern. The face photo and clock-in attempts are
 * shown in the conversation instead (FaceEvidenceCardComponent).
 */
@Component({
  selector: 'app-exception-evidence-panel',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective],
  templateUrl: './exception-evidence-panel.component.html',
  styleUrl: './exception-evidence-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExceptionEvidencePanelComponent {
  readonly evidence = input<ExceptionEvidenceResponse | null>(null);

  /** The pattern days read through the app's shared table. */
  protected readonly patternColumns: readonly DataTableColumn[] = [
    { key: 'day', label: 'Day' },
    { key: 'score', label: 'Activity score' },
    { key: 'active', label: 'Active' },
    { key: 'worked', label: 'Worked' },
    { key: 'attendance', label: 'Attendance' }
  ];
  protected readonly trackByDate = (day: { date: string }): string => day.date;
  protected readonly patternRowClass = (day: { inRule: boolean }): string => (day.inRule ? 'evidence-table__rule' : '');

  /** The evidence with any section the server left out (monitoring-only data for some viewers) read as empty. */
  readonly safe = computed<ExceptionEvidenceResponse | null>(() => {
    const ev = this.evidence();
    if (!ev) return null;
    return {
      ...ev,
      attendance: ev.attendance ?? null,
      deviceActivity: ev.deviceActivity ? { ...ev.deviceActivity, segments: ev.deviceActivity.segments ?? [] } : null,
      pattern: ev.pattern ? { ...ev.pattern, days: ev.pattern.days ?? [], measures: ev.pattern.measures ?? [] } : null,
      activityHidden: !!ev.activityHidden
    };
  });

  readonly formatTime = evidenceTime;

  /** "9:20 AM – 4:40 PM" while the desktop app saw the computer, or null when it reported nothing. */
  computerOn(ev: ExceptionEvidenceResponse): string | null {
    const activity = ev.deviceActivity;
    if (ev.activityHidden || !activity?.firstSeenAt || !activity.lastSeenAt) return null;
    return `${evidenceTime(activity.firstSeenAt, ev.timezone)} – ${evidenceTime(activity.lastSeenAt, ev.timezone)}`;
  }

  /** The attendance status only when it says something is off (late, forgot to clock out, ...). */
  attendanceIssue(ev: ExceptionEvidenceResponse): string | null {
    const status = ev.attendance?.status;
    return status && !UNREMARKABLE_STATUSES.has(status) ? this.attendanceLabel(status) : null;
  }

  /** Position of each run on the bar, as a share of first-seen → last-seen. */
  timelineBars(activity: DeviceActivityEvidence, timezone: string): { left: number; width: number; state: DeviceActivityState; label: string }[] {
    if (!activity.firstSeenAt || !activity.lastSeenAt) return [];
    const from = new Date(activity.firstSeenAt).getTime();
    const span = Math.max(new Date(activity.lastSeenAt).getTime() - from, 1);
    return activity.segments
      .filter((segment) => segment.end > segment.start)
      .map((segment) => {
        const start = new Date(segment.start).getTime();
        const end = new Date(segment.end).getTime();
        return {
          left: ((start - from) / span) * 100,
          width: Math.max(((end - start) / span) * 100, 0.4),
          state: segment.state,
          label: `${SEGMENT_LABELS[segment.state] ?? segment.state} ${evidenceTime(segment.start, timezone)}–${evidenceTime(segment.end, timezone)}`
        };
      });
  }

  duration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }

  measureValue(measure: PatternMeasure): string {
    switch (measure.unit) {
      case 'minutes': return this.duration(Math.round(measure.value));
      case 'days': return `${measure.value} days`;
      case 'points': return `${measure.value} points`;
      default: return `${measure.value}`;
    }
  }

  patternValue(value: number | null, unit: 'score' | 'minutes'): string {
    if (value === null || value === undefined) return '—';
    return unit === 'minutes' ? this.duration(value) : `${Math.round(value)}`;
  }

  /** The attendance record's status in plain words. */
  attendanceLabel(status: string | null): string {
    if (!status) return '—';
    const known = ATTENDANCE_STATUS_LABELS[status];
    if (known) return known;
    const words = status.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }

  shortDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
}
