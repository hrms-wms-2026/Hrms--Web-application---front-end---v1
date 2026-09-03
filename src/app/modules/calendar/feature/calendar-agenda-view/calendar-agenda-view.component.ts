import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';

interface AgendaGroup {
  readonly date: string;
  readonly events: readonly CalendarEventResponse[];
}

@Component({
  selector: 'app-calendar-agenda-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-agenda-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarAgendaViewComponent {
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');
  eventClick = output<string>();

  readonly groups = computed<readonly AgendaGroup[]>(() => {
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = dateOnlyInTimezone(event.startDate, this.timezone());
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    const dates = [...byDate.keys()].sort();
    return dates.map((date) => ({
      date,
      events: [...byDate.get(date)!].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }));
  });
}
