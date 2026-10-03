import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { RespondLeaveInformationRequest } from '../../models/leave-approval.model';

@Component({
  selector: 'app-leave-respond-info-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './leave-respond-info-dialog.component.html',
  styleUrl: './leave-respond-info-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveRespondInfoDialogComponent {
  @Input({ required: true }) open = false;
  @Input() question = '';
  @Input() sending = false;
  @Input() sendError: string | null = null;
  @Output() confirmed = new EventEmitter<RespondLeaveInformationRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly message = signal('');

  onConfirm(): void {
    const message = this.message().trim();
    if (!message) return;
    this.confirmed.emit({ message, fileRecordIds: null });
  }

  onClose(): void {
    this.message.set('');
    this.closed.emit();
  }
}
