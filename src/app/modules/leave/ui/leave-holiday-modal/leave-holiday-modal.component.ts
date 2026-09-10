import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { CreateLeaveHolidayRequest, LeaveHolidayResponse } from '../../models/leave-calendar.model';

@Component({
  selector: 'app-leave-holiday-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePickerComponent],
  templateUrl: './leave-holiday-modal.component.html',
  styleUrl: './leave-holiday-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveHolidayModalComponent {
  @Input({ required: true }) open = false;
  @Input() holidays: readonly LeaveHolidayResponse[] = [];
  @Input() saving = false;
  @Input() actionError: string | null = null;
  @Output() save = new EventEmitter<CreateLeaveHolidayRequest>();
  @Output() remove = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  readonly name = signal('');
  readonly date = signal('');
  readonly endDate = signal('');

  onSubmit(): void {
    if (!this.name().trim() || !this.date()) return;
    this.save.emit({ name: this.name().trim(), date: this.date(), endDate: this.endDate() || null });
    this.name.set('');
    this.date.set('');
    this.endDate.set('');
  }

  onClose(): void {
    this.name.set('');
    this.date.set('');
    this.endDate.set('');
    this.closed.emit();
  }
}
