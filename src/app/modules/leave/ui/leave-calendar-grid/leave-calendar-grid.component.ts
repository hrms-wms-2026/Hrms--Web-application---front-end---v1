/** Screen 7: month grid - colour by type, holidays, click a day for the roster. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveCalendarAbsenceResponse, LeaveCalendarDayResponse } from '../../models/leave-calendar.model';

const OTHER_COLOR = '#6b5b95';
const DOW_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6
};

@Component({ selector: 'app-leave-calendar-grid', standalone: true, imports: [CommonModule], templateUrl: './leave-calendar-grid.component.html', styleUrl: './leave-calendar-grid.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveCalendarGridComponent {
  @Input({ required: true }) days: readonly LeaveCalendarDayResponse[] = [];
  @Output() dayClicked = new EventEmitter<string>();
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

  colorFor(absence: LeaveCalendarAbsenceResponse): string {
    return absence.typeColorHex ?? OTHER_COLOR;
  }

  leadingPads(): readonly number[] {
    const first = this.days[0];
    const count = first ? (DOW_INDEX[first.dayOfWeek] ?? 0) : 0;
    return Array.from({ length: count }, (_, index) => index);
  }

  isToday(date: string): boolean {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return date === `${now.getFullYear()}-${month}-${day}`;
  }

  isWeekend(dayOfWeek: string): boolean {
    return dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
  }

  firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }

  dayLabel(day: LeaveCalendarDayResponse): string {
    const holiday = day.holidays[0]?.name;
    const count = day.absences.length;
    if (holiday && count) return `${day.date}, ${holiday}, ${count} off`;
    if (holiday) return `${day.date}, ${holiday}`;
    if (count) return `${day.date}, ${count} off`;
    return day.date;
  }
}
