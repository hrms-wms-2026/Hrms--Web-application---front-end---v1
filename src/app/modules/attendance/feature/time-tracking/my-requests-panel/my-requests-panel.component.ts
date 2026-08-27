import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { NotificationService } from '../../../../../core/services/notification.service';
import { AttendanceCorrectionResponse, correctionStatusLabel, correctionTypeLabel } from '../../../models/attendance-correction.model';
import { workAreaChangeStatusLabel, workAreaLabel } from '../../../models/work-area-change-request.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { formatDate, formatDateTime, formatWorkAreaDate } from '../../../utils/attendance-formatters';

type PersonalRequestTab = 'corrections' | 'work-area';

@Component({
  selector: 'app-my-requests-panel',
  standalone: true,
  imports: [ButtonComponent, ModalComponent],
  templateUrl: './my-requests-panel.component.html',
  styleUrl: './my-requests-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyRequestsPanelComponent implements OnInit {
  readonly store = inject(TimeTrackingStore);
  private readonly notifications = inject(NotificationService);

  readonly Math = Math;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatWorkAreaDate = formatWorkAreaDate;
  readonly correctionTypeLabel = correctionTypeLabel;
  readonly correctionStatusLabel = correctionStatusLabel;
  readonly workAreaLabel = workAreaLabel;
  readonly workAreaChangeStatusLabel = workAreaChangeStatusLabel;

  readonly autoLoad = input(true);

  readonly selectedRequestTab = signal<PersonalRequestTab>('corrections');
  readonly workAreaCancelRequestId = signal<string | null>(null);

  ngOnInit(): void {
    if (this.autoLoad()) {
      this.ensureRequestTabLoaded(this.selectedRequestTab());
    }
  }

  selectRequestTab(tab: PersonalRequestTab): void {
    this.selectedRequestTab.set(tab);
    this.ensureRequestTabLoaded(tab);
  }

  private ensureRequestTabLoaded(tab: PersonalRequestTab): void {
    if (tab === 'corrections') {
      if (!this.store.myCorrectionsLoaded?.() && this.store.loadMyCorrections) {
        void this.store.loadMyCorrections();
      }
      return;
    }
    if (!this.store.myWorkAreaRequestsLoaded()) {
      void this.store.loadMyWorkAreaRequests({ pageNumber: 1 });
    }
  }

  goToCorrectionsPage(page: number): void {
    void this.store.loadMyCorrections(page);
  }

  goToWorkAreaRequestsPage(page: number): void {
    void this.store.loadMyWorkAreaRequests({ pageNumber: page });
  }

  correctionSummary(request: AttendanceCorrectionResponse): string {
    if (request.correctionType === 'break') return `${request.requestedBreaks?.length ?? 0} interval(s)`;
    const clockIn = request.requestedClockInAt ? this.formatDateTime(request.requestedClockInAt, request.timezone) : null;
    const clockOut = request.requestedClockOutAt ? this.formatDateTime(request.requestedClockOutAt, request.timezone) : null;
    if (clockIn && clockOut) return `${clockIn} to ${clockOut}`;
    return clockIn || clockOut || 'Time update requested';
  }

  correctionActionIsLoading(action: string): boolean {
    return this.store.activeCorrectionAction?.() === action;
  }

  async cancelCorrection(id: string): Promise<void> {
    const result = await this.store.cancelCorrection(id);
    if (!result) return;
    this.notifications.success('Correction request cancelled.');
    void this.store.loadMyCorrections();
  }

  requestCancelWorkArea(id: string): void {
    if (this.store.myWorkAreaRequests().find((request) => request.id === id)?.status === 'pending') {
      this.workAreaCancelRequestId.set(id);
    }
  }

  closeCancelWorkArea(): void {
    if (!this.store.workAreaActionLoading()) this.workAreaCancelRequestId.set(null);
  }

  async confirmCancelWorkArea(): Promise<void> {
    const id = this.workAreaCancelRequestId();
    if (!id) return;
    const result = await this.store.cancelWorkAreaChangeRequest(id);
    if (result) {
      this.workAreaCancelRequestId.set(null);
      void this.store.loadMyWorkAreaRequests({ pageNumber: this.store.myWorkAreaRequestsPage() });
    }
  }

  workAreaActionIsLoading(id: string): boolean {
    return this.store.activeWorkAreaRequestId() === id;
  }
}
