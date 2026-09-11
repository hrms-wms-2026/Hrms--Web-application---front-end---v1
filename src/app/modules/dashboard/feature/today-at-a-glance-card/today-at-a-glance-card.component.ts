import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { DashboardGreetingComponent } from '../dashboard-greeting/dashboard-greeting.component';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineSegment } from '../../models/activity-timeline.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import {
  SEGMENT_COLORS,
  SEGMENT_LABELS,
  SEGMENT_OPACITY,
  TimelineSegment,
  buildTimelineSegments,
  formatMinutes,
  formatTime
} from '../../util/timeline-segments.util';
import { getTimeOfDayInfo, TimeOfDayInfo } from '../../util/time-of-day.util';

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

@Component({
  selector: 'app-today-at-a-glance-card',
  standalone: true,
  imports: [CardComponent, RouterLink, DashboardGreetingComponent],
  templateUrl: './today-at-a-glance-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayAtAGlanceCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly activityApi = inject(ActivityTimelineApiService);
  private readonly destroyRef = inject(DestroyRef);
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  // Ticks every minute so greeting/timeline/"last updated" labels stay live without a manual
  // page reload - the greeting/timeline calculations below read this instead of calling
  // `new Date()`/`Date.now()` directly so they re-run on each tick.
  private readonly now = signal(Date.now());

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;
  protected readonly timeOfDayInfo = computed<TimeOfDayInfo>(() => getTimeOfDayInfo(new Date(this.now())));

  private readonly activitySegments = signal<ActivityTimelineSegment[]>([]);
  private activityRequested = false;

  protected readonly statusLabel = computed(() => {
    const today = this.today();
    if (!today) {
      return '';
    }
    return today.attendanceStatusLabel?.trim() || STATUS_LABELS[today.attendanceStatus] || 'Not specified';
  });

  protected readonly clockInTimeLabel = computed(() => {
    const clockInAt = this.today()?.clockInAt;
    return clockInAt ? formatTime(new Date(clockInAt)) : null;
  });

  protected readonly workedTimeLabel = computed(() => formatMinutes(this.today()?.totalWorkedMinutes ?? null));

  protected readonly legendTypes: TimelineSegment['type'][] = ['working', 'focus', 'break', 'idle'];

  protected readonly timelineSegments = computed<TimelineSegment[]>(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return [];
    }
    const start = new Date(today.clockInAt).getTime();
    const end = today.clockOutAt ? new Date(today.clockOutAt).getTime() : this.now();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return [];
    }
    // The today-summary endpoint sometimes omits `breaks` entirely (seen live for an
    // in-progress break with no completed break intervals yet) rather than sending an
    // empty array - guard so the timeline still renders instead of throwing in buildTimelineSegments.
    return buildTimelineSegments(start, end, today.breaks ?? [], this.activitySegments());
  });

  protected readonly timelineEndLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return null;
    }
    return formatTime(today.clockOutAt ? new Date(today.clockOutAt) : new Date(this.now()));
  });

  private readonly lastUpdated = signal<Date | null>(null);

  protected readonly lastUpdatedLabel = computed(() => {
    const updated = this.lastUpdated();
    if (!updated) {
      return null;
    }
    const diffMinutes = Math.floor((this.now() - updated.getTime()) / 60_000);
    if (diffMinutes < 1) return 'Last updated: just now';
    if (diffMinutes === 1) return 'Last updated: 1 min ago';
    return `Last updated: ${diffMinutes} min ago`;
  });

  constructor() {
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.tickTimer !== null) clearInterval(this.tickTimer);
    });

    effect(() => {
      const today = this.today();
      if (!today?.allowedClockInMethods.desktopTray || this.activityRequested) {
        return;
      }
      this.activityRequested = true;
      this.activityApi.getMyTimeline().subscribe({
        next: (response) => this.activitySegments.set(response.segments),
        error: () => this.activitySegments.set([])
      });
    });
  }

  ngOnInit(): void {
    void this.store.loadToday().then(() => this.lastUpdated.set(new Date()));
  }

  protected segmentLabel(type: TimelineSegment['type']): string {
    return SEGMENT_LABELS[type];
  }

  protected segmentColor(type: TimelineSegment['type']): string {
    return SEGMENT_COLORS[type];
  }

  protected segmentOpacity(type: TimelineSegment['type']): number {
    return SEGMENT_OPACITY[type];
  }
}
