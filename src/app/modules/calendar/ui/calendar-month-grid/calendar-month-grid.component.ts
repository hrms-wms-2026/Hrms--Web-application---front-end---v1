import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarGridDay, buildMonthGrid } from '../../utils/calendar-grid.util';
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';

const MAX_VISIBLE_PER_DAY = 3;

interface DayCellViewModel {
  readonly day: CalendarGridDay;
  readonly visible: readonly CalendarEventResponse[];
  readonly overflowCount: number;
}

@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-month-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarMonthGridComponent {
  year = input.required<number>();
  month = input.required<number>();
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');

  dayClick = output<string>();
  eventClick = output<string>();

  readonly cells = computed<readonly DayCellViewModel[]>(() => {
    const grid = buildMonthGrid(this.year(), this.month());
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = dateOnlyInTimezone(event.startDate, this.timezone());
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return grid.map((day) => {
      const dayEvents = byDate.get(day.date) ?? [];
      return {
        day,
        visible: dayEvents.slice(0, MAX_VISIBLE_PER_DAY),
        overflowCount: Math.max(0, dayEvents.length - MAX_VISIBLE_PER_DAY)
      };
    });
  });
}
