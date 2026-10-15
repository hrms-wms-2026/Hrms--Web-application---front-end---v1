import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import {
  DeviceActivityEvidence,
  DeviceActivityState,
  ExceptionEvidenceResponse,
  PatternMeasure,
  faceOutcomeLabel,
  faceReasonLabel
} from '../../models/exception-evidence.model';

/**
 * Flow 09 "validate the issue": the day's clock-in/out and, for identity cases, the photo that raised the case, that
 * day's face checks and check-in scans, device activity and the multi-day pattern. Presentational: the host loads the
 * evidence (the Inbox exception renderer passes the item's evidence) - the photo URL is signed for a few minutes, so
 * an expired link asks the reviewer to reopen the item.
 */
@Component({
  selector: 'app-exception-evidence-panel',
  standalone: true,
  templateUrl: './exception-evidence-panel.component.html',
  styleUrl: './exception-evidence-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExceptionEvidencePanelComponent {
  readonly evidence = input<ExceptionEvidenceResponse | null>(null);

  /** The evidence with any section the server left out (monitoring-only data for some viewers) read as empty. */
  readonly safe = computed<ExceptionEvidenceResponse | null>(() => {
    const ev = this.evidence();
    if (!ev) return null;
    return {
      ...ev,
      attendance: ev.attendance ?? null,
      identity: ev.identity ? { ...ev.identity, reasons: ev.identity.reasons ?? [] } : null,
      faceChecks: ev.faceChecks ?? [],
      checkInScans: ev.checkInScans ?? [],
      deviceActivity: ev.deviceActivity ? { ...ev.deviceActivity, segments: ev.deviceActivity.segments ?? [] } : null,
      pattern: ev.pattern ? { ...ev.pattern, days: ev.pattern.days ?? [], measures: ev.pattern.measures ?? [] } : null,
      activityHidden: !!ev.activityHidden
    };
  });

  readonly photoFailed = signal(false);

  readonly reasonLabel = faceReasonLabel;
  readonly outcomeLabel = faceOutcomeLabel;

  constructor() {
    // A different case starts with a fresh photo.
    effect(() => {
      this.evidence();
      this.photoFailed.set(false);
    });
  }

  hasAnything(evidence: ExceptionEvidenceResponse): boolean {
    return !!evidence.attendance
      || !!evidence.identity
      || evidence.faceChecks.length > 0
      || evidence.checkInScans.length > 0
      || (evidence.deviceActivity?.segments.length ?? 0) > 0
      || (evidence.pattern?.days.some((d) => d.activityScore !== null || d.workedMinutes !== null) ?? false);
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
          label: `${segment.state} ${this.formatTime(segment.start, timezone)}–${this.formatTime(segment.end, timezone)}`
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

  statusLabel(status: string | null): string {
    return status ? status.replace(/_/g, ' ') : '—';
  }

  shortDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }

  photoMessage(unavailable: boolean): string {
    if (this.photoFailed()) return 'Photo link expired - reopen evidence';
    return unavailable ? 'Photo unavailable right now - try again' : 'No photo kept';
  }

  sourceLabel(source: string | null): string {
    return source === 'face_check_override'
      ? 'Clock-in/out face check failed and was let through'
      : source === 'check_in_scan'
        ? 'Check-in photo did not match'
        : 'Identity check';
  }

  purposeLabel(purpose: string | null): string {
    return purpose === 'clock_out' ? 'Clock-out' : purpose === 'clock_in' ? 'Clock-in' : '—';
  }

  score(value: number | null): string {
    return value === null || value === undefined ? '—' : `${value.toFixed(1)}%`;
  }

  formatTime(value: string | null, timezone: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: timezone }).format(date);
    } catch {
      return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
    }
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }
}
