import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../modal/modal.component';
import { DatePickerComponent } from '../date-picker/date-picker.component';
/** What the cancel dialog returns: same shape as the Leave API's CancelLeaveRequestRequest (effectiveDate = partial cancel). */
export interface LeaveCancelChoice {
  reason: string | null;
  effectiveDate: string | null;
  expectedVersion: string | null;
}

@Component({
  selector: 'app-leave-cancel-confirm-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePickerComponent],
  templateUrl: './leave-cancel-confirm-dialog.component.html',
  styleUrl: './leave-cancel-confirm-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveCancelConfirmDialogComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) leaveTypeName = '';
  @Input({ required: true }) startAt = '';
  @Input({ required: true }) endAt = '';
  @Input({ required: true }) totalHours = 0;
  @Input({ required: true }) status = '';
  @Input({ required: true }) requireReason = false;
  @Input() cancelling = false;
  @Input() cancelError: string | null = null;
  @Output() confirmed = new EventEmitter<LeaveCancelChoice>();
  @Output() closed = new EventEmitter<void>();

  readonly reason = signal('');
  readonly effectiveDate = signal<string | null>(null);

  isInProgress(): boolean {
    const start = Date.parse(this.startAt);
    const end = Date.parse(this.endAt);
    const now = Date.now();
    return Number.isFinite(start) && Number.isFinite(end) && start < now && end > now;
  }

  onConfirm(): void {
    if (this.requireReason && !this.reason().trim()) return;
    this.confirmed.emit({
      reason: this.reason().trim() || null,
      effectiveDate: this.effectiveDate(),
      expectedVersion: null
    });
  }

  onClose(): void {
    this.reason.set('');
    this.effectiveDate.set(null);
    this.closed.emit();
  }
}
