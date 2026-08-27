import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { ActivityTimelineSegment } from '../../models/activity-timeline.model';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { SEGMENT_LABELS, TimelineSegment, buildTimelineSegments, formatTime } from '../../util/timeline-segments.util';

const SEGMENT_COLORS: Record<TimelineSegment['type'], string> = {
  working: 'var(--color-accent)',
  break: 'var(--color-border)',
  focus: 'var(--color-accent)',
  idle: 'var(--color-border)'
};

const SEGMENT_OPACITY: Record<TimelineSegment['type'], number> = {
  working: 1,
  break: 1,
  focus: 1,
  idle: 0.4
};

@Component({
  selector: 'app-activity-timeline-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './activity-timeline-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActivityTimelinePageComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly activityApi = inject(ActivityTimelineApiService);

  protected readonly today = this.store.today;
  protected readonly loading = this.store.todayLoading;
  private readonly activitySegments = signal<ActivityTimelineSegment[]>([]);
  private activityRequested = false;

  protected readonly hasClockedInToday = computed(() => !!this.today()?.clockInAt);

  protected readonly rangeStartLabel = computed(() => {
    const clockInAt = this.today()?.clockInAt;
    return clockInAt ? formatTime(new Date(clockInAt)) : null;
  });

  protected readonly rangeEndLabel = computed(() => {
    const today = this.today();
    if (!today?.clockInAt) return null;
    return formatTime(today.clockOutAt ? new Date(today.clockOutAt) : new Date());
  });

  protected readonly segments = computed<TimelineSegment[]>(() => {
    const today = this.today();
    if (!today?.clockInAt) return [];
    const start = new Date(today.clockInAt).getTime();
    const end = (today.clockOutAt ? new Date(today.clockOutAt) : new Date()).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return [];
    return buildTimelineSegments(start, end, today.breaks, this.activitySegments());
  });

  constructor() {
    effect(() => {
      const today = this.today();
      if (!today?.clockInAt || this.activityRequested) return;
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
