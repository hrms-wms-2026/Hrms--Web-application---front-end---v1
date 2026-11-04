import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { LeaveUploadedDocument, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { NewLeaveRequestWizardComponent } from '../new-leave-request-wizard/new-leave-request-wizard.component';

/**
 * The New Leave Request popup wired to the leave stores, so every Time Off screen opens the same
 * popup with one tag. After a submit it reloads the caller's balances and requests.
 */
@Component({
  selector: 'app-new-leave-request-host',
  standalone: true,
  imports: [NewLeaveRequestWizardComponent],
  template: `
    <app-new-leave-request-wizard
      [open]="true"
      [leaveTypes]="leaveTypeStore.items()"
      [balances]="balanceStore.my()"
      [initialStartDate]="initialDate()"
      [initialEndDate]="initialDate()"
      [workStartTime]="balanceStore.workWindow()?.workStartTime ?? null"
      [workEndTime]="balanceStore.workWindow()?.workEndTime ?? null"
      [timezone]="balanceStore.workWindow()?.timezone ?? 'UTC'"
      [breakMinutes]="balanceStore.workWindow()?.breakDurationMinutes ?? null"
      [previewing]="requestStore.previewing()"
      [previewResult]="requestStore.previewResult()"
      [previewError]="requestStore.previewError()"
      [submitting]="requestStore.submitting()"
      [submitError]="requestStore.submitError()"
      [uploadedDocuments]="uploadedDocuments()"
      [uploadingDocument]="requestStore.uploadingDocument()"
      [documentUploadError]="requestStore.documentUploadError()"
      (previewRequested)="onPreviewRequested($event)"
      (submitRequested)="onSubmitRequested($event)"
      (documentSelected)="onDocumentSelected($event)"
      (documentRemoved)="onDocumentRemoved($event)"
      (closed)="close()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewLeaveRequestHostComponent {
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly balanceStore = inject(LeaveBalanceStore);
  readonly requestStore = inject(LeaveRequestStore);
  private readonly notificationService = inject(NotificationService);

  /** Pre-fills From and To ("YYYY-MM-DD"), e.g. from a calendar day. */
  readonly initialDate = input('');
  readonly closed = output<void>();
  readonly submitted = output<void>();
  readonly uploadedDocuments = signal<LeaveUploadedDocument[]>([]);

  constructor() {
    if (this.leaveTypeStore.items().length === 0) void this.leaveTypeStore.load();
    if (this.balanceStore.my().length === 0) void this.balanceStore.loadMy(this.balanceStore.year());
    void this.balanceStore.loadWorkWindow();
  }

  onPreviewRequested(payload: SubmitLeaveRequestRequest): void {
    void this.requestStore.preview(payload);
  }

  async onSubmitRequested(payload: SubmitLeaveRequestRequest): Promise<void> {
    const result = await this.requestStore.submit(payload);
    if (!result) return;
    this.notificationService.success('Leave request sent.');
    void this.balanceStore.loadMy(this.balanceStore.year());
    void this.requestStore.loadMine();
    this.submitted.emit();
    this.close();
  }

  async onDocumentSelected(file: File): Promise<void> {
    const uploaded = await this.requestStore.uploadDocument(file);
    if (uploaded) this.uploadedDocuments.update((docs) => [...docs, uploaded]);
  }

  onDocumentRemoved(id: string): void {
    this.uploadedDocuments.update((docs) => docs.filter((doc) => doc.id !== id));
  }

  close(): void {
    this.uploadedDocuments.set([]);
    this.requestStore.clearPreview();
    this.closed.emit();
  }
}
