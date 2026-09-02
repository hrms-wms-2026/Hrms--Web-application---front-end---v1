import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { PositionedEvent, layoutDayEvents } from '../../utils/calendar-hour-grid.util';
import { dateOnlyInTimezone, localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';

interface DayColumnViewModel {
  readonly date: string;
  readonly isToday: boolean;
  readonly allDayEvents: readonly CalendarEventResponse[];
  readonly positioned: readonly PositionedEvent[];
  readonly nowFraction: number | null; // 0-1, only set when isToday
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

@Component({
  selector: 'app-calendar-hour-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-hour-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarHourGridComponent {
  days = input.required<readonly string[]>();
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();

  readonly hours = HOURS;

  readonly columns = computed<readonly DayColumnViewModel[]>(() => {
    const timezone = this.timezone();
    const nowIso = new Date().toISOString();
    const todayStr = dateOnlyInTimezone(nowIso, timezone);
    const nowParts = utcIsoToLocalParts(nowIso, timezone);
    const [nowHour, nowMinute] = nowParts.time.split(':').map(Number);

    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = dateOnlyInTimezone(event.startDate, timezone);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return this.days().map((date) => {
      const dayEvents = byDate.get(date) ?? [];
      const dayStart = new Date(localPartsToUtcIso(date, '00:00', timezone));
      const isToday = date === todayStr;
      return {
        date,
        isToday,
        allDayEvents: dayEvents.filter((e) => e.isAllDay),
        positioned: layoutDayEvents(dayEvents, dayStart),
        nowFraction: isToday ? (nowHour * 60 + nowMinute) / 1440 : null
      };
    });
  });

  onSlotClick(date: string, event: MouseEvent, columnEl: HTMLElement): void {
    const rect = columnEl.getBoundingClientRect();
    const fraction = (event.clientY - rect.top) / rect.height;
    const hour = Math.max(0, Math.min(23, Math.floor(fraction * 24)));
    this.slotClick.emit({ date, hour });
  }
}
