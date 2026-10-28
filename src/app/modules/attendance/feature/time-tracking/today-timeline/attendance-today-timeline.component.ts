import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  fullDateLabel,
  statusLabel,
  timelineEventLabel
} from '../../../utils/attendance-formatters';
import { StopClickPropagationDirective } from '../../../../../shared/directives/stop-click-propagation.directive';

const LIVE_STATUSES = new Set(['working', 'clocked_in', 'on_break']);
const CIRCLE_RADIUS = 60;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS; // ~376.99

export function formatTimelineSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.toLowerCase().trim();
  if (s === 'desktop_tray' || s === 'tray_app' || s === 'tray') {
    return 'via tray app';
  }
  if (s === 'web') {
    return 'via web';
  }
  if (s === 'biometric') {
    return 'via biometric';
  }
  if (s === 'mobile') {
    return 'via mobile';
  }
  return `via ${source}`;
}

export interface EnrichedTimelineItem {
  readonly id: string;
  readonly type: 'event' | 'now';
  readonly eventType?: string;
  readonly label: string;
  readonly time: string;
  readonly isNow?: boolean;
  readonly iconType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'now';
  readonly durationLabel?: string | null;
  readonly source?: string | null;
  readonly sourceLabel?: string | null;
}

@Component({
  selector: 'app-attendance-today-timeline',
  standalone: true,
  imports: [StopClickPropagationDirective],
  templateUrl: './attendance-today-timeline.component.html',
  styleUrl: './attendance-today-timeline.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceTodayTimelineComponent {
  readonly store = inject(TimeTrackingStore);
  readonly formatDateTime = formatDateTime;
  readonly timelineEventLabel = timelineEventLabel;

  readonly isModalOpen = signal(false);

  readonly CIRCLE_RADIUS = CIRCLE_RADIUS;
  readonly CIRCLE_CIRCUMFERENCE = CIRCLE_CIRCUMFERENCE;

  readonly nowRow = computed(() => {
    const today = this.store.today();
    if (!today || !LIVE_STATUSES.has(today.attendanceStatus)) return null;
    return {
      statusText: statusLabel(today.attendanceStatus, today.attendanceStatusLabel),
      workedLabel: formatMinutes(today.totalWorkedMinutes)
    };
  });

  readonly allTimelineItems = computed<EnrichedTimelineItem[]>(() => {
    const rawEvents = this.store.todayTimelineEvents();
    const today = this.store.today();
    const timezone = today?.timezone;
    const items: EnrichedTimelineItem[] = [];

    let lastBreakStartTimestamp: string | null = null;

    for (let i = 0; i < rawEvents.length; i++) {
      const event = rawEvents[i];
      let iconType: EnrichedTimelineItem['iconType'] = 'clock_in';
      let durationLabel: string | null = null;

      if (event.eventType === 'ClockIn') {
        iconType = 'clock_in';
      } else if (event.eventType === 'BreakStart') {
        iconType = 'break_start';
        lastBreakStartTimestamp = event.timestamp;
      } else if (event.eventType === 'BreakEnd') {
        iconType = 'break_end';
        if (lastBreakStartTimestamp) {
          const diffMs = new Date(event.timestamp).getTime() - new Date(lastBreakStartTimestamp).getTime();
          if (!isNaN(diffMs) && diffMs > 0) {
            const mins = Math.round(diffMs / 60000);
            durationLabel = mins > 0 ? `${mins}m break` : '< 1m break';
          }
          lastBreakStartTimestamp = null;
        }
      } else if (event.eventType === 'ClockOut') {
        iconType = 'clock_out';
      }

      items.push({
        id: `${event.timestamp}-${event.eventType}-${i}`,
        type: 'event',
        eventType: event.eventType,
        label: timelineEventLabel(event.eventType),
        time: formatDateTime(event.timestamp, timezone),
        iconType,
        durationLabel,
        source: event.source ?? null,
        sourceLabel: formatTimelineSource(event.source)
      });
    }

    const now = this.nowRow();
    if (now) {
      items.push({
        id: 'live-now-row',
        type: 'now',
        label: `${now.statusText} · ${now.workedLabel}`,
        time: 'Now',
        isNow: true,
        iconType: 'now'
      });
    }

    return items;
  });

  readonly visibleItems = computed(() => this.allTimelineItems().slice(0, 3));
  readonly hasMore = computed(() => this.allTimelineItems().length > 3);
  readonly moreCount = computed(() => Math.max(0, this.allTimelineItems().length - 3));
  readonly totalCount = computed(() => this.allTimelineItems().length);

  readonly chartMetrics = computed(() => {
    const today = this.store.today();
    const scheduledMinutes = today?.requiredWorkMinutes && today.requiredWorkMinutes > 0
      ? today.requiredWorkMinutes
      : 360; // 6h default fallback
    const workedMinutes = today?.totalWorkedMinutes ?? 0;
    const breakUsedMinutes = today?.breakUsedMinutes ?? 0;
    const breakAllowanceMinutes = today?.breakAllowanceMinutes ?? 0;
    const breakRemainingMinutes = today?.breakRemainingMinutes ?? Math.max(0, breakAllowanceMinutes - breakUsedMinutes);
    const remainingMinutes = Math.max(0, scheduledMinutes - workedMinutes);
    const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);

    const totalBase = Math.max(scheduledMinutes, workedMinutes + breakUsedMinutes, 1);

    const rawWorkedFraction = workedMinutes / totalBase;
    const rawBreakFraction = breakUsedMinutes / totalBase;
    const minBreakFraction = breakUsedMinutes > 0 ? Math.max(0.04, rawBreakFraction) : 0;
    const workedFraction = Math.min(1 - minBreakFraction, rawWorkedFraction);
    const breakFraction = Math.min(1 - workedFraction, minBreakFraction);
    const remainingFraction = Math.max(0, 1 - workedFraction - breakFraction);

    const C = CIRCLE_CIRCUMFERENCE;

    const workedDash = workedFraction * C;
    const workedDasharray = `${workedDash} ${C}`;
    const workedOffset = 0;

    const breakDash = breakFraction * C;
    const breakDasharray = `${breakDash} ${C}`;
    const breakOffset = -workedDash;

    const remainingDash = remainingFraction * C;
    const remainingDasharray = `${remainingDash} ${C}`;
    const remainingOffset = -(workedDash + breakDash);

    const completionPercent = Math.min(100, Math.round((workedMinutes / (scheduledMinutes || 1)) * 100));
    const breakPercent = Math.min(100, Math.round((breakUsedMinutes / (scheduledMinutes || 1)) * 100));

    return {
      scheduledMinutes,
      workedMinutes,
      breakUsedMinutes,
      breakAllowanceMinutes,
      breakRemainingMinutes,
      remainingMinutes,
      overtimeMinutes,
      completionPercent,
      breakPercent,
      workedDasharray,
      workedOffset,
      breakDasharray,
      breakOffset,
      remainingDasharray,
      remainingOffset,
      workedLabel: formatMinutes(workedMinutes),
      breakLabel: formatMinutes(breakUsedMinutes),
      remainingLabel: formatMinutes(remainingMinutes),
      scheduledLabel: formatMinutes(scheduledMinutes),
      workDateLabel: today?.workDate ? formatDate(today.workDate) : 'Today',
      fullDateLabel: today?.workDate ? fullDateLabel(today.workDate) : 'Today',
      statusText: today ? statusLabel(today.attendanceStatus, today.attendanceStatusLabel) : 'Not recorded',
      workMode: today?.expectedWorkMode || 'Office'
    };
  });

  openModal(): void {
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }
}
