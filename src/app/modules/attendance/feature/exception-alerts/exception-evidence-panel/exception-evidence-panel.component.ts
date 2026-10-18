import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ExceptionAlertsApiService } from '../../../data-access/exception-alerts-api.service';
import {
  DeviceActivityEvidence,
  DeviceActivityState,
  ExceptionEvidenceResponse,
  PatternMeasure,
  faceOutcomeLabel,
  faceReasonLabel
} from '../../../models/exception-alert.model';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../../shared/ui/data-table/data-table.component';

/**
 * Flow 09 "validate the issue": the day's clock-in/out and, for identity cases, the photo that
 * raised the case, that day's face checks and check-in scans. Fetches on every open - the photo
 * URL is signed for a few minutes only - so the state lives here, not in the store.
 */
@Component({
  selector: 'app-exception-evidence-panel',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective, ButtonComponent],
  templateUrl: './exception-evidence-panel.component.html',
  styleUrl: './exception-evidence-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExceptionEvidencePanelComponent implements OnInit {
  protected readonly patternColumns: readonly DataTableColumn[] = [
    { key: 'day', label: 'Day' },
    { key: 'score', label: 'Activity score' },
    { key: 'active', label: 'Active' },
    { key: 'worked', label: 'Worked' },
    { key: 'attendance', label: 'Attendance' }
  ];
  protected readonly trackByDate = (day: { date: string }): string => day.date;
  protected readonly patternRowClass = (day: { inRule: boolean }): string => (day.inRule ? 'evidence-table__rule' : '');

  private readonly api = inject(ExceptionAlertsApiService);

  readonly alertId = input.required<string>();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly evidence = signal<ExceptionEvidenceResponse | null>(null);
  readonly photoFailed = signal(false);

  readonly reasonLabel = faceReasonLabel;
  readonly outcomeLabel = faceOutcomeLabel;

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.photoFailed.set(false);
    try {
      this.evidence.set(await firstValueFrom(this.api.evidence(this.alertId())));
    } catch (error) {
      this.error.set(toSafeErrorMessage(error, 'Could not load the evidence for this alert.'));
    } finally {
      this.loading.set(false);
    }
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
