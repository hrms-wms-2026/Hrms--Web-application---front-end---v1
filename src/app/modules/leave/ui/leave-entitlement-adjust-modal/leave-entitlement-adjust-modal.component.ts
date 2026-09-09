/** HR-only adjustment modal; the parent retries with confirmation after a 409 conflict. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AdjustEntitlementRequest, LeaveEntitlementResponse } from '../../models/leave-entitlement.model';

@Component({
  selector: 'app-leave-entitlement-adjust-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  templateUrl: './leave-entitlement-adjust-modal.component.html',
  styleUrl: './leave-entitlement-adjust-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveEntitlementAdjustModalComponent implements OnChanges {
  @Input({ required: true }) open = false;
  @Input({ required: true }) entitlement!: LeaveEntitlementResponse;
  @Input() needsConfirmation = false;
  @Input() saving = false;
  @Input() actionError: string | null = null;
  @Output() save = new EventEmitter<AdjustEntitlementRequest>();
  @Output() closed = new EventEmitter<void>();
  readonly totalHours = signal(0);
  readonly carriedForwardHours = signal(0);
  readonly reason = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entitlement'] && this.entitlement) {
      this.totalHours.set(this.entitlement.totalHours);
      this.carriedForwardHours.set(this.entitlement.carriedForwardHours);
    }
  }

  onSubmit(): void {
    this.emitAdjust(false);
  }

  onConfirmNegative(): void {
    this.emitAdjust(true);
  }

  onClose(): void {
    this.closed.emit();
  }

  private emitAdjust(confirmNegativeRemaining: boolean): void {
    if (!this.reason().trim()) return;
    this.save.emit({
      totalHours: this.totalHours(),
      carriedForwardHours: this.carriedForwardHours(),
      reason: this.reason().trim(),
      confirmNegativeRemaining
    });
  }
}
