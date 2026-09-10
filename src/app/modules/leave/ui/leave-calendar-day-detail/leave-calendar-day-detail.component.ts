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
  @Input() canRequestLeave = false;
  @Output() closed = new EventEmitter<void>();
  @Output() requestLeave = new EventEmitter<string>();

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
