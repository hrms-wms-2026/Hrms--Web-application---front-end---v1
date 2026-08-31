/** Screen 7: month grid - colour by type, holidays, click a day for the roster. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveCalendarAbsenceResponse, LeaveCalendarDayResponse } from '../../models/leave-calendar.model';

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  annual: '#1e5eff',
  sick: '#c98a1f'
};
const OTHER_COLOR = '#6b5b95';

@Component({ selector: 'app-leave-calendar-grid', standalone: true, imports: [CommonModule], templateUrl: './leave-calendar-grid.component.html', styleUrl: './leave-calendar-grid.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveCalendarGridComponent {
  @Input({ required: true }) days: readonly LeaveCalendarDayResponse[] = [];
  @Output() dayClicked = new EventEmitter<string>();

  colorFor(absence: LeaveCalendarAbsenceResponse): string {
    return absence.typeColorHex ?? CATEGORY_FALLBACK_COLORS[absence.leaveTypeCategory] ?? OTHER_COLOR;
  }
}
