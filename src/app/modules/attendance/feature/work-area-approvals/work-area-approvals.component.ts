import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import {
  WorkAreaChangeRequestResponse,
  workAreaChangeStatusLabel,
  workAreaLabel
} from '../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';

@Component({
  selector: 'app-work-area-approvals',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective, FormsModule, ButtonComponent, BreadcrumbHeaderComponent, ModalComponent],
  templateUrl: './work-area-approvals.component.html',
  styleUrl: './work-area-approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkAreaApprovalsComponent implements OnInit {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'requester', label: 'Requester' },
    { key: 'date', label: 'Date' },
    { key: 'change', label: 'Change' },
    { key: 'reason', label: 'Reason', wrap: true },
    { key: 'requested', label: 'Requested' },
    { key: 'status', label: 'Status' },
    { key: 'action', label: 'Action', interactive: true, shrink: true }
  ];
  protected readonly trackById = (request: { id: string }): string => request.id;

  readonly store = inject(TimeTrackingStore);
  private readonly route = inject(ActivatedRoute);
  readonly embedded = input(false);
  readonly requestedId = signal<string | null>(null);
  readonly pageMessage = signal('');
  readonly reviewRequest = signal<WorkAreaChangeRequestResponse | null>(null);
  readonly reviewComment = signal('');
  readonly reviewActionError = signal('');
  readonly rejectionValidationError = signal('');
  readonly confirmationDecision = signal<'approve' | 'reject' | null>(null);
  private reviewOpener: HTMLElement | null = null;
  readonly workAreaLabel = workAreaLabel;
  readonly workAreaChangeStatusLabel = workAreaChangeStatusLabel;
  readonly Math = Math;

  ngOnInit(): void {
    this.requestedId.set(this.route.snapshot.queryParamMap.get('requestId'));
    if (this.store.workAreaApprovalInboxLoaded()) {
      this.tryOpenDeepLink();
    } else {
      void this.load();
    }
  }

  async load(): Promise<void> {
    this.pageMessage.set('');
    await this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: 1 });
    this.tryOpenDeepLink();
  }

  private tryOpenDeepLink(): void {
    const id = this.requestedId();
    if (!id) return;
    const match = this.store.workAreaApprovalInbox().find((request) => request.id === id && request.status === 'pending');
    if (match) {
      this.openReview(match);
      setTimeout(() => {
        const row = Array.from(document.querySelectorAll<HTMLElement>('[data-request-id]'))
          .find((element) => element.dataset['requestId'] === id);
        row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 0);
      return;
    }
    this.pageMessage.set('Open the pending requests list to review this request.');
  }

  openReview(request: WorkAreaChangeRequestResponse): void {
    if (request.status !== 'pending') return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      this.reviewOpener = activeElement;
    }
    this.reviewRequest.set(request);
    this.store.selectWorkAreaApprovalRequest(request);
    this.reviewComment.set('');
    this.reviewActionError.set('');
    this.rejectionValidationError.set('');
    this.confirmationDecision.set(null);
  }

  closeReview(): void {
    if (this.store.workAreaActionLoading()) return;
    this.reviewRequest.set(null);
    this.store.selectWorkAreaApprovalRequest(null);
    this.confirmationDecision.set(null);
    this.reviewActionError.set('');
    this.rejectionValidationError.set('');
    const opener = this.reviewOpener;
    this.reviewOpener = null;
    opener?.focus();
  }

  review(decision: 'approve' | 'reject'): void {
    const request = this.reviewRequest();
    if (!request || request.status !== 'pending' || this.store.workAreaActionLoading()) return;
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
    if (!this.store.workAreaActionLoading()) this.confirmationDecision.set(null);
  }

  async confirmReview(): Promise<void> {
    const request = this.reviewRequest();
    const decision = this.confirmationDecision();
    if (!request || request.status !== 'pending' || !decision || this.store.workAreaActionLoading()) return;
    const comment = this.reviewComment().trim();
    this.confirmationDecision.set(null);
    const result = decision === 'approve'
      ? await this.store.approveWorkAreaChangeRequest(request.id, comment || null)
      : await this.store.rejectWorkAreaChangeRequest(request.id, comment);
    if (!result) {
      this.reviewActionError.set('This request could not be updated. Refresh the list to see the latest requests.');
      return;
    }
    this.closeReview();
    await this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: this.store.workAreaApprovalInboxPage() });
  }

  goToPage(page: number): void {
    void this.store.loadWorkAreaApprovalInbox({ status: 'pending', pageNumber: page });
  }

  formatDate(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      return 'Date unavailable';
    }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  formatDateTime(value: string | null, timezone: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    const displayTimezone = timezone?.trim();
    if (Number.isNaN(date.getTime()) || !displayTimezone) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: displayTimezone }).format(date);
    } catch {
      return '—';
    }
  }

  confirmationTitle(): string {
    return this.confirmationDecision() === 'approve' ? 'Approve work-area request?' : 'Reject work-area request?';
  }

  confirmationCopy(): string {
    return this.confirmationDecision() === 'approve'
      ? 'This approval changes the requested work area for the selected date.'
      : 'The requester will be notified with the review comment.';
  }
}
