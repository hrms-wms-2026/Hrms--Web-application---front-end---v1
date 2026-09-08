import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { formatDateTime, timelineEventLabel } from '../../../utils/attendance-formatters';

@Component({
  selector: 'app-attendance-today-timeline',
  standalone: true,
  templateUrl: './attendance-today-timeline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceTodayTimelineComponent {
  readonly store = inject(TimeTrackingStore);
  readonly formatDateTime = formatDateTime;
  readonly timelineEventLabel = timelineEventLabel;
}
