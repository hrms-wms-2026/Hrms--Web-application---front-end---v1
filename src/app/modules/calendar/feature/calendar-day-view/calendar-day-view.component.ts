import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';

@Component({
  selector: 'app-calendar-day-view',
  standalone: true,
  imports: [CommonModule, CalendarHourGridComponent],
  templateUrl: './calendar-day-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarDayViewComponent {
  date = input.required<string>();
  events = input<readonly CalendarEventResponse[]>([]);
  timezone = input<string>('UTC');

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();

  readonly days = computed<readonly string[]>(() => [this.date()]);
}
