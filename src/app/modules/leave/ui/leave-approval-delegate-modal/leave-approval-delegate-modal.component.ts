import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { CreateLeaveApprovalDelegateRequest, LeaveApprovalDelegateResponse } from '../../models/leave-approval.model';

@Component({
  selector: 'app-leave-approval-delegate-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePickerComponent, EmployeePickerComponent],
  templateUrl: './leave-approval-delegate-modal.component.html',
  styleUrl: './leave-approval-delegate-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveApprovalDelegateModalComponent {
  @Input({ required: true }) open = false;
  @Input() delegates: readonly LeaveApprovalDelegateResponse[] = [];
  @Input() saving = false;
  @Input() actionError: string | null = null;
  @Output() save = new EventEmitter<CreateLeaveApprovalDelegateRequest>();
  @Output() remove = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  readonly pickerOpen = signal(false);
  readonly delegateEmployeeId = signal<string | null>(null);
  readonly startDate = signal('');
  readonly endDate = signal('');

  onEmployeePicked(id: string): void {
    this.delegateEmployeeId.set(id);
    this.pickerOpen.set(false);
  }

  onSubmit(): void {
    const delegateEmployeeId = this.delegateEmployeeId();
    if (!delegateEmployeeId || !this.startDate() || !this.endDate()) return;
    this.save.emit({ delegateEmployeeId, startDate: this.startDate(), endDate: this.endDate() });
    this.delegateEmployeeId.set(null);
    this.startDate.set('');
    this.endDate.set('');
  }

  onClose(): void {
    this.delegateEmployeeId.set(null);
    this.startDate.set('');
    this.endDate.set('');
    this.closed.emit();
  }
}
