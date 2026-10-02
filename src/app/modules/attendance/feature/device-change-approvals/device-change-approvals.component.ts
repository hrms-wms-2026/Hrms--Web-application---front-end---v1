import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DeviceChangeRequestResponse, deviceChangeStatusLabel } from '../../models/device-change-request.model';
import { DeviceChangeRequestsStore } from '../../state/device-change-requests.store';

@Component({
  selector: 'app-device-change-approvals',
  standalone: true,
  imports: [FormsModule, ButtonComponent, BreadcrumbHeaderComponent, ModalComponent],
  templateUrl: './device-change-approvals.component.html',
  styleUrl: './device-change-approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeviceChangeApprovalsComponent {
  readonly store = inject(DeviceChangeRequestsStore);
  readonly embedded = input(false);
  readonly reviewRequest = signal<DeviceChangeRequestResponse | null>(null);
  readonly reviewComment = signal('');
  readonly reviewActionError = signal('');
  readonly rejectionValidationError = signal('');
  readonly confirmationDecision = signal<'approve' | 'reject' | null>(null);
  private reviewOpener: HTMLElement | null = null;
  readonly deviceChangeStatusLabel = deviceChangeStatusLabel;
  readonly Math = Math;

  constructor() {
    if (!this.store.approvalInboxLoaded()) {
      void this.load();
    }
  }

  async load(): Promise<void> {
    await this.store.loadApprovalInbox(1);
  }

  openReview(request: DeviceChangeRequestResponse): void {
    if (request.status !== 'pending') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      this.reviewOpener = activeElement;
    }
    this.reviewRequest.set(request);
    this.reviewComment.set('');
    this.reviewActionError.set('');
    this.rejectionValidationError.set('');
    this.confirmationDecision.set(null);
  }

  closeReview(): void {
    if (this.store.actionLoading()) return;
    this.reviewRequest.set(null);
    this.confirmationDecision.set(null);
    this.reviewActionError.set('');
    this.rejectionValidationError.set('');
    const opener = this.reviewOpener;
    this.reviewOpener = null;
    opener?.focus();
  }

  review(decision: 'approve' | 'reject'): void {
    const request = this.reviewRequest();
    if (!request || request.status !== 'pending' || this.store.actionLoading()) return;
    const comment = this.reviewComment().trim();
    this.reviewActionError.set('');
    this.rejectionValidationError.set('');
    if (decision === 'reject' && !comment) {
      this.rejectionValidationError.set('Add a reason before rejecting this request.');
      return;
    }
    if (comment.length > 2000) {
      this.rejectionValidationError.set('Review comment must be 2000 characters or fewer.');
      return;
    }
    this.confirmationDecision.set(decision);
  }

  cancelConfirmation(): void {
    if (!this.store.actionLoading()) this.confirmationDecision.set(null);
  }

  async confirmReview(): Promise<void> {
    const request = this.reviewRequest();
    const decision = this.confirmationDecision();
    if (!request || request.status !== 'pending' || !decision || this.store.actionLoading()) return;
    const comment = this.reviewComment().trim();
    this.confirmationDecision.set(null);
    const result = decision === 'approve'
      ? await this.store.approve(request.id, comment || null)
      : await this.store.reject(request.id, comment);
    if (!result) {
      this.reviewActionError.set('This request could not be updated. Refresh the list to see the latest requests.');
      return;
    }
    this.closeReview();
    await this.store.loadApprovalInbox(this.store.approvalInboxPage());
  }

  goToPage(page: number): void {
    void this.store.loadApprovalInbox(page);
  }

  formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  confirmationTitle(): string {
    return this.confirmationDecision() === 'approve' ? 'Approve device change?' : 'Reject device change?';
  }

  confirmationCopy(): string {
    return this.confirmationDecision() === 'approve'
      ? 'The old device will be signed out immediately and the new device will be able to enroll.'
      : 'The requester will be notified with the review comment.';
  }
}
