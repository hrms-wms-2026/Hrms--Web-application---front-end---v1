import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { AttendanceCorrectionResponse, correctionStatusLabel, correctionTypeLabel } from '../../models/attendance-correction.model';
import { TimeTrackingStore } from '../../state/time-tracking.store';

@Component({
  selector: 'app-correction-approvals',
  standalone: true,
  imports: [FormsModule, ButtonComponent, BreadcrumbHeaderComponent, ModalComponent],
  templateUrl: './correction-approvals.component.html',
  styleUrl: './correction-approvals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CorrectionApprovalsComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);
  readonly embedded = input(false);
  readonly requestedId = signal<string | null>(null);
  readonly reviewRequest = signal<AttendanceCorrectionResponse | null>(null);
  readonly reviewComment = signal('');
  readonly reviewError = signal('');
  readonly correctionTypeLabel = correctionTypeLabel;
  readonly correctionStatusLabel = correctionStatusLabel;

  ngOnInit(): void {
    this.requestedId.set(this.route.snapshot.queryParamMap.get('requestId'));
    if (this.store.approvalInboxLoaded()) {
      this.tryOpenDeepLink();
    } else {
      void this.load();
    }
  }

  async load(): Promise<void> {
    await this.store.loadApprovalInbox();
    this.tryOpenDeepLink();
  }

  private tryOpenDeepLink(): void {
    const id = this.requestedId();
    if (!id) return;
    const match = this.store.approvalInbox().find((request) => request.id === id && request.status === 'pending');
    if (!match) {
      this.reviewError.set('This request is no longer pending or could not be found. Refresh the list to see the latest requests.');
      return;
    }
    setTimeout(() => document.querySelector(`[data-request-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
  }

  openReview(request: AttendanceCorrectionResponse): void {
    if (request.status !== 'pending') return;
    this.reviewRequest.set(request);
    this.reviewComment.set('');
    this.reviewError.set('');
  }

  closeReview(): void {
    if (!this.store.correctionActionLoading()) this.reviewRequest.set(null);
  }

  async review(decision: 'approve' | 'reject'): Promise<void> {
    const request = this.reviewRequest();
    if (!request || request.status !== 'pending') return;
    const comment = this.reviewComment().trim();
    if (decision === 'reject' && !comment) {
      this.reviewError.set('Add a reason before rejecting this request.');
      return;
    }
    this.reviewError.set('');
    const result = decision === 'approve'
      ? await this.store.approveCorrection(request.id, { reviewComment: comment || null })
      : await this.store.rejectCorrection(request.id, { reviewComment: comment });
    if (!result) {
      this.reviewRequest.set(null);
      this.reviewError.set('This request has already been updated. Refreshing the list.');
      await this.store.loadApprovalInbox();
      return;
    }
    this.notifications.success(decision === 'approve' ? 'Attendance correction approved.' : 'Attendance correction rejected.');
    this.reviewRequest.set(null);
    await this.store.loadApprovalInbox();
  }

  formatDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  formatDateTime(value: string | null, timezone: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    const displayTimezone = timezone?.trim();
    if (Number.isNaN(date.getTime()) || !displayTimezone) return '—';

    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: displayTimezone
      }).format(date);
    } catch {
      return '—';
    }
  }

  correctionSummary(request: AttendanceCorrectionResponse): string {
    if (request.correctionType === 'break') {
      const count = request.requestedBreaks?.length ?? 0;
      const intervals = request.requestedBreaks
        ?.map((item) => {
          const start = this.formatDateTime(item.breakStart, request.timezone);
          const end = this.formatDateTime(item.breakEnd, request.timezone);
          return start === '—' || end === '—' ? null : `${start} to ${end}`;
        })
        .filter((interval): interval is string => interval !== null) ?? [];
      return intervals.length > 0
        ? `${count} break interval(s): ${intervals.join(', ')}`
        : `${count} break interval(s)`;
    }
    const inTime = request.requestedClockInAt ? this.formatDateTime(request.requestedClockInAt, request.timezone) : null;
    const outTime = request.requestedClockOutAt ? this.formatDateTime(request.requestedClockOutAt, request.timezone) : null;
    const safeInTime = inTime === '—' ? null : inTime;
    const safeOutTime = outTime === '—' ? null : outTime;
    return safeInTime && safeOutTime ? `${safeInTime} to ${safeOutTime}` : safeInTime || safeOutTime || 'Time update requested';
  }
}
