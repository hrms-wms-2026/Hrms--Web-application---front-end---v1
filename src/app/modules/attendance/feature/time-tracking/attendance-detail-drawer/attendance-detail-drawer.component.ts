import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { AttendanceHistoryRow, DayScreenshot } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import {
  checkInLocationLabel,
  formatClockTime,
  formatDate,
  formatMinutes,
  sourceLabel,
  statusLabel,
  timelineEventLabel,
  workModeLabel
} from '../../../utils/attendance-formatters';

interface TimelineRow {
  key: string;
  label: string;
  time: string;
  source: string;
  pending: boolean;
}

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
  readonly fallbackSummary = input<AttendanceHistoryRow | null>(null);
  readonly displayTimezone = input<string>('UTC');
  readonly closed = output<void>();
  readonly requestCorrection = output<AttendanceHistoryRow>();

  readonly formatDate = formatDate;
  readonly formatClockTime = formatClockTime;
  readonly formatMinutes = formatMinutes;
  readonly workModeLabel = workModeLabel;
  readonly sourceLabel = sourceLabel;
  readonly statusLabel = statusLabel;
  readonly timelineEventLabel = timelineEventLabel;
  readonly checkInLocationLabel = checkInLocationLabel;
  readonly selectedShotId = signal<string | null>(null);
  readonly galleryExpanded = signal(false);

  readonly summary = computed(() => this.store.dayDetail()?.summary ?? this.fallbackSummary());
  readonly shots = computed(() => this.store.dayDetail()?.screenshots ?? []);
  readonly activityChecks = computed(() =>
    (this.store.dayDetail()?.activityChecks ?? []).filter((check) => {
      const outcome = check.outcome.trim().toLowerCase();
      return outcome === 'captured' || outcome === 'declined' || outcome === 'timed_out' || outcome === 'activity_resumed'
        || outcome === 'confirmed_working' || outcome === 'not_working';
    }));
  readonly selectedShot = computed(() => {
    const shots = this.shots();
    if (shots.length === 0) return null;
    return shots.find((shot) => shot.id === this.selectedShotId()) ?? shots[0];
  });
  readonly activityState = computed(() => {
    const activity = this.store.dayDetail()?.dailyActivity;
    if (!activity) return null;
    if (activity.totalIdleMinutes > activity.totalActiveMinutes && activity.totalActiveMinutes === 0) {
      return { label: 'Idle time', idle: true };
    }
    return { label: 'Active time', idle: false };
  });
  readonly timelineRows = computed((): TimelineRow[] => {
    const summary = this.summary();
    const events = this.store.dayDetail()?.timelineEvents ?? [];
    const zone = this.displayTimezone();
    if (events.length === 0) {
      if (!summary || !this.store.dayDetail()) return [];
      return [
        this.clockRow('in', summary.clockInAt, summary.attendanceSource, zone),
        this.clockRow('out', summary.clockOutAt, summary.clockOutAt ? summary.attendanceSource : null, zone)
      ];
    }

    const rows = events.map((event, index) => ({
      key: `${event.eventType}-${event.timestamp}-${index}`,
      label: timelineEventLabel(event.eventType),
      time: formatClockTime(event.timestamp, zone),
      source: sourceLabel(event.source),
      pending: false
    }));
    if (!events.some((event) => event.eventType === 'ClockOut')) {
      rows.push({
        key: 'clock-out-pending',
        label: 'Clocked out',
        time: '—',
        source: '',
        pending: true
      });
    }
    return rows;
  });

  readonly topApps = computed(() => {
    const activity = this.store.dayDetail()?.dailyActivity;
    if (!activity) return [];
    return activity.topApps
      .filter((app) => app.appName.trim().length > 0 && app.totalSeconds > 0)
      .map((app) => ({
        appName: app.appName,
        category: (app.category || 'unknown').toLowerCase(),
        minutes: Math.round(app.totalSeconds / 60)
      }));
  });

  constructor() {
    effect((onCleanup) => {
      const selected = this.selection();
      if (!selected) return;
      untracked(() => {
        this.selectedShotId.set(null);
        this.galleryExpanded.set(false);
        void this.store.loadDayDetail(selected.employeeId, selected.workDate);
      });
      const timer = window.setInterval(() => {
        void this.store.refreshDayDetail(selected.employeeId, selected.workDate);
      }, 15_000);
      onCleanup(() => window.clearInterval(timer));
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
    const summary = this.summary();
    if (summary) {
      this.requestCorrection.emit(summary);
    }
  }

  selectShot(shot: DayScreenshot): void {
    this.selectedShotId.set(shot.id);
  }

  isLiveStatus(status: string): boolean {
    const key = status.trim().toLowerCase();
    return key === 'active' || key === 'working' || key === 'clocked_in';
  }

  openScreenshot(shot: DayScreenshot): void {
    if (!shot.url) return;
    window.open(shot.url, '_blank', 'noopener');
  }

  openCheck(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  checkLabel(outcome: string): string {
    const key = outcome.trim().toLowerCase();
    if (key === 'captured') return 'Allow';
    if (key === 'declined') return 'Skip';
    // "Were you working?" answers from employees without screenshot capture.
    if (key === 'confirmed_working') return 'Was working';
    if (key === 'not_working') return 'Not working';
    return 'Nothing done';
  }

  appLabel(name: string): string {
    const trimmed = name.trim().replace(/\.exe$/i, '');
    const key = trimmed.toLowerCase();
    const known: Record<string, string> = {
      chrome: 'Chrome',
      msedge: 'Microsoft Edge',
      windowsterminal: 'Windows Terminal',
      explorer: 'File Explorer',
      'whatsapp.root': 'WhatsApp',
      whatsapp: 'WhatsApp',
      code: 'Visual Studio Code',
      cmd: 'Command Prompt',
      searchhost: 'Windows Search',
      snippingtool: 'Snipping Tool',
      'onevo.agent.trayapp': 'WorkPulse'
    };
    return known[key] ?? trimmed;
  }

  triggerLabel(triggerType: string): string {
    const key = triggerType.trim().toLowerCase();
    if (key.includes('inactiv')) return 'Activity check';
    if (key.includes('period') || key.includes('auto')) return 'Periodic capture';
    if (key.includes('manual') || key.includes('demand') || key.includes('request')) return 'Requested capture';
    if (!key) return 'Screenshot';
    return key.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  private clockRow(which: 'in' | 'out', at: string | null, source: string | null, zone: string): TimelineRow {
    return {
      key: `clock-${which}`,
      label: which === 'in' ? 'Clocked in' : 'Clocked out',
      time: formatClockTime(at, zone),
      source: at ? sourceLabel(source) : '',
      pending: !at
    };
  }
}
