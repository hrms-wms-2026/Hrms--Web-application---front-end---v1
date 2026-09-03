/** Screen 7: "Click a day to see who is on leave." */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LeaveCalendarDayResponse } from '../../models/leave-calendar.model';

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
  @Output() closed = new EventEmitter<void>();
}
