import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarGridDay, buildMonthGrid } from '../../utils/calendar-grid.util';
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

const MAX_VISIBLE_PER_DAY = 3;

interface DayCellViewModel {
  readonly day: CalendarGridDay;
  readonly visible: readonly CalendarEventResponse[];
  readonly overflowCount: number;
}

/** One day's planner summary chip (2026-10-27 Planner = Calendar design, section 4.5). */
export interface PlannerMonthSummary {
  readonly tasks: number;
  readonly meetings: number;
  readonly plannedMinutes: number;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  imports: [KeyboardClickDirective, CommonModule],
  templateUrl: './calendar-month-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarMonthGridComponent {
  year = input.required<number>();
  month = input.required<number>();
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');
  /** Planner layer: a chip per day with blocks or meetings; empty while the planner is off. */
  summaries = input<ReadonlyMap<string, PlannerMonthSummary>>(new Map());

  dayClick = output<string>();
  eventClick = output<string>();

  summaryText(date: string): string | null {
    const s = this.summaries().get(date);
    if (!s) return null;
    const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
    return `${plural(s.tasks, 'task')} · ${plural(s.meetings, 'meeting')} · ${duration(s.plannedMinutes)}`;
  }

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
