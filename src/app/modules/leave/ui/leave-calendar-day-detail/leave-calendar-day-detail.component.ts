/** Screen 7: "Click a day to see who is on leave." */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LeaveCalendarAbsenceResponse, LeaveCalendarDayResponse } from '../../models/leave-calendar.model';
import { formatHoursLabel, formatLeaveRange } from '../../utils/leave-hours-format';

@Component({
  selector: 'app-leave-calendar-day-detail',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './leave-calendar-day-detail.component.html',
  styleUrl: './leave-calendar-day-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveCalendarDayDetailComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) day: LeaveCalendarDayResponse | null = null;
  @Input() timezone: string | null = null;
  @Output() closed = new EventEmitter<void>();

  rangeFor(absence: LeaveCalendarAbsenceResponse): string {
    return formatLeaveRange(absence.startAt, absence.endAt, this.timezone);
  }

  hoursFor(absence: LeaveCalendarAbsenceResponse): string {
    return formatHoursLabel(absence.totalHours);
  }
}
