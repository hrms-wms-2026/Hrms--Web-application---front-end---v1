import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
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

const STATUS_LABELS: Record<string, string> = {
  not_clocked_in: 'Not clocked in',
  clocked_in: 'Clocked in',
  on_break: 'On break',
  clocked_out: 'Clocked out'
};

@Component({
  selector: 'app-today-at-a-glance-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './today-at-a-glance-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TodayAtAGlanceCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly activityApi = inject(ActivityTimelineApiService);

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;

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

  protected readonly timelineSegments = computed<TimelineSegment[]>(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return [];
    }
    const start = new Date(today.clockInAt).getTime();
    const end = (today.clockOutAt ? new Date(today.clockOutAt) : new Date()).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return [];
    }
    return buildTimelineSegments(start, end, today.breaks, this.activitySegments());
  });

  protected readonly timelineEndLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) {
      return null;
    }
    return formatTime(today.clockOutAt ? new Date(today.clockOutAt) : new Date());
  });

  constructor() {
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
    void this.store.loadToday();
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
