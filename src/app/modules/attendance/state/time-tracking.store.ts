import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeTrackingApiService } from '../data-access/time-tracking-api.service';
import {
  AttendanceCorrectionApprovalListItem,
  AttendanceCorrectionListItem,
  AttendanceCorrectionPreviewRequest,
  AttendanceCorrectionPreviewResponse,
  AttendanceCorrectionRequest,
  AttendanceCorrectionResponse,
  ApproveAttendanceCorrectionRequest,
  RejectAttendanceCorrectionRequest
} from '../models/attendance-correction.model';
import {
  AttendanceHistoryRow,
  AttendanceTodayResponse,
  TimeTrackingRange
} from '../models/time-tracking.model';

const DEFAULT_PAGE_SIZE = 20;

export type TimeTrackingAction = 'clockIn' | 'startBreak' | 'endBreak' | 'clockOut';
export type CorrectionAction = 'preview' | 'submit' | 'cancel' | 'approve' | 'reject';

export const TIME_TRACKING_LOAD_ERROR = 'Could not load your attendance today. Try again.';
export const TIME_TRACKING_HISTORY_ERROR = 'Could not load attendance history. Try again.';
export const TIME_TRACKING_COVERED_HISTORY_ERROR = 'Could not load team attendance. Try again.';
export const TIME_TRACKING_COVERED_FORBIDDEN_ERROR = 'You do not have access to view team attendance.';
export const CORRECTIONS_LOAD_ERROR = 'Could not load your correction requests. Try again.';
export const CORRECTIONS_APPROVAL_LOAD_ERROR = 'Could not load attendance correction approvals. Try again.';
export const CORRECTION_PREVIEW_ERROR = 'We could not confirm who will receive this request.';
export const CORRECTION_SUBMIT_ERROR = 'Could not submit the correction request. Try again.';
export const CORRECTION_CANCEL_ERROR = 'Could not cancel the correction request. Try again.';
export const CORRECTION_REVIEW_ERROR = 'Could not update this correction request. Try again.';
export const NO_ATTENDANCE_APPROVER_MESSAGE = 'No eligible attendance approver is configured for this employee.';

interface TimeTrackingState {
  readonly today: AttendanceTodayResponse | null;
  readonly todayLoading: boolean;
  readonly todayError: string | null;
  readonly actionLoading: boolean;
  readonly activeAction: TimeTrackingAction | null;
  readonly history: readonly AttendanceHistoryRow[];
  readonly historyLoading: boolean;
  readonly historyError: string | null;
  readonly historyPage: number;
  readonly historyPageSize: number;
  readonly historyTotalCount: number;
  readonly coveredHistory: readonly AttendanceHistoryRow[];
  readonly coveredHistoryLoading: boolean;
  readonly coveredHistoryError: string | null;
  readonly coveredHistoryPage: number;
  readonly coveredHistoryPageSize: number;
  readonly coveredHistoryTotalCount: number;
  readonly selectedHistoryRange: TimeTrackingRange | null;
  readonly selectedCoveredEmployeeId: string | null;
  readonly myCorrections: readonly AttendanceCorrectionListItem[];
  readonly myCorrectionsLoading: boolean;
  readonly myCorrectionsError: string | null;
  readonly myCorrectionsPage: number;
  readonly myCorrectionsPageSize: number;
  readonly myCorrectionsTotalCount: number;
  readonly approvalInbox: readonly AttendanceCorrectionApprovalListItem[];
  readonly approvalInboxLoading: boolean;
  readonly approvalInboxError: string | null;
  readonly correctionPreview: AttendanceCorrectionPreviewResponse | null;
  readonly correctionError: string | null;
  readonly correctionActionLoading: boolean;
  readonly activeCorrectionAction: CorrectionAction | null;
}

const initialState: TimeTrackingState = {
  today: null,
  todayLoading: false,
  todayError: null,
  actionLoading: false,
  activeAction: null,
  history: [],
  historyLoading: false,
  historyError: null,
  historyPage: 1,
  historyPageSize: DEFAULT_PAGE_SIZE,
  historyTotalCount: 0,
  coveredHistory: [],
  coveredHistoryLoading: false,
  coveredHistoryError: null,
  coveredHistoryPage: 1,
  coveredHistoryPageSize: DEFAULT_PAGE_SIZE,
  coveredHistoryTotalCount: 0,
  selectedHistoryRange: null,
  selectedCoveredEmployeeId: null,
  myCorrections: [],
  myCorrectionsLoading: false,
  myCorrectionsError: null,
  myCorrectionsPage: 1,
  myCorrectionsPageSize: DEFAULT_PAGE_SIZE,
  myCorrectionsTotalCount: 0,
  approvalInbox: [],
  approvalInboxLoading: false,
  approvalInboxError: null,
  correctionPreview: null,
  correctionError: null,
  correctionActionLoading: false,
  activeCorrectionAction: null
};

export const TimeTrackingStore = signalStore(
  { providedIn: 'root' },
  withState<TimeTrackingState>(initialState),
  withMethods((store, api = inject(TimeTrackingApiService), notifications = inject(NotificationService), errors = inject(ErrorHandlerService)) => {
    const runAction = async (
      action: TimeTrackingAction,
      operation: () => Observable<AttendanceTodayResponse>,
      successMessage: string,
      failureFallback: string
    ): Promise<void> => {
      if (store.actionLoading()) return;
      patchState(store, { actionLoading: true, activeAction: action, todayError: null });
      try {
        const today = await firstValueFrom(operation());
        patchState(store, { today, actionLoading: false, activeAction: null, todayError: null });
        notifications.success(successMessage);
      } catch (error) {
        const safeMessage = errors.toSafeMessage(error, failureFallback);
        patchState(store, { actionLoading: false, activeAction: null, todayError: safeMessage });
        notifications.error(safeMessage);
      }
    };

    const runCorrectionAction = async <T>(
      action: CorrectionAction,
      operation: () => Observable<T>,
      failureFallback: string
    ): Promise<T | null> => {
      if (store.correctionActionLoading()) return null;
      patchState(store, { correctionActionLoading: true, activeCorrectionAction: action, correctionError: null });
      try {
        const result = await firstValueFrom(operation());
        patchState(store, { correctionActionLoading: false, activeCorrectionAction: null, correctionError: null });
        return result;
      } catch (error) {
        const safeMessage = correctionBusinessMessage(error, errors.toSafeMessage(error, failureFallback));
        patchState(store, { correctionActionLoading: false, activeCorrectionAction: null, correctionError: safeMessage });
        return null;
      }
    };

    return {
      async loadToday(): Promise<void> {
        if (store.todayLoading()) return;
        patchState(store, { todayLoading: true, todayError: null });
        try {
          const today = await firstValueFrom(api.getToday());
          patchState(store, { today, todayLoading: false, todayError: null });
        } catch (error) {
          patchState(store, { todayLoading: false, todayError: errors.toSafeMessage(error, TIME_TRACKING_LOAD_ERROR) });
        }
      },

      async loadMyHistory(range: TimeTrackingRange, page = 1): Promise<void> {
        if (store.historyLoading()) return;
        patchState(store, { historyLoading: true, historyError: null, selectedHistoryRange: range });
        try {
          const result = await firstValueFrom(api.getMyHistory(range.from, range.to, page, store.historyPageSize()));
          patchState(store, {
            history: result.items,
            historyPage: result.pageNumber,
            historyTotalCount: result.totalCount,
            historyLoading: false,
            historyError: null
          });
        } catch (error) {
          patchState(store, { historyLoading: false, historyError: errors.toSafeMessage(error, TIME_TRACKING_HISTORY_ERROR) });
        }
      },

      async loadCoveredHistory(range: TimeTrackingRange, employeeId?: string, page = 1): Promise<void> {
        if (store.coveredHistoryLoading()) return;
        const selectedEmployeeId = employeeId?.trim() || null;
        patchState(store, { coveredHistoryLoading: true, coveredHistoryError: null, selectedCoveredEmployeeId: selectedEmployeeId });
        try {
          const result = await firstValueFrom(api.getCoveredHistory(range.from, range.to, page, store.coveredHistoryPageSize(), selectedEmployeeId ?? undefined));
          patchState(store, {
            coveredHistory: result.items,
            coveredHistoryPage: result.pageNumber,
            coveredHistoryTotalCount: result.totalCount,
            coveredHistoryLoading: false,
            coveredHistoryError: null
          });
        } catch (error) {
          const message = thisIsForbidden(error) ? TIME_TRACKING_COVERED_FORBIDDEN_ERROR : errors.toSafeMessage(error, TIME_TRACKING_COVERED_HISTORY_ERROR);
          patchState(store, { coveredHistoryLoading: false, coveredHistoryError: message });
        }
      },

      async loadMyCorrections(page = 1): Promise<void> {
        if (store.myCorrectionsLoading()) return;
        patchState(store, { myCorrectionsLoading: true, myCorrectionsError: null });
        try {
          const result = await firstValueFrom(api.getMyCorrections(page, store.myCorrectionsPageSize()));
          patchState(store, {
            myCorrections: result.items,
            myCorrectionsPage: result.pageNumber,
            myCorrectionsTotalCount: result.totalCount,
            myCorrectionsLoading: false,
            myCorrectionsError: null
          });
        } catch (error) {
          patchState(store, { myCorrectionsLoading: false, myCorrectionsError: errors.toSafeMessage(error, CORRECTIONS_LOAD_ERROR) });
        }
      },

      async loadApprovalInbox(): Promise<void> {
        if (store.approvalInboxLoading()) return;
        patchState(store, { approvalInboxLoading: true, approvalInboxError: null });
        try {
          const approvalInbox = await firstValueFrom(api.getApprovalInbox('pending'));
          patchState(store, { approvalInbox, approvalInboxLoading: false, approvalInboxError: null });
        } catch (error) {
          patchState(store, { approvalInboxLoading: false, approvalInboxError: errors.toSafeMessage(error, CORRECTIONS_APPROVAL_LOAD_ERROR) });
        }
      },

      async previewCorrection(request: AttendanceCorrectionPreviewRequest): Promise<AttendanceCorrectionPreviewResponse | null> {
        const preview = await runCorrectionAction('preview', () => api.previewCorrection(request), CORRECTION_PREVIEW_ERROR);
        if (preview) patchState(store, { correctionPreview: preview });
        return preview;
      },

      async submitCorrection(request: AttendanceCorrectionRequest): Promise<AttendanceCorrectionResponse | null> {
        return runCorrectionAction('submit', () => api.submitCorrection(request), CORRECTION_SUBMIT_ERROR);
      },

      async cancelCorrection(id: string): Promise<AttendanceCorrectionResponse | null> {
        return runCorrectionAction('cancel', () => api.cancelCorrection(id), CORRECTION_CANCEL_ERROR);
      },

      async approveCorrection(id: string, request: ApproveAttendanceCorrectionRequest): Promise<AttendanceCorrectionResponse | null> {
        return runCorrectionAction('approve', () => api.approveCorrection(id, request), CORRECTION_REVIEW_ERROR);
      },

      async rejectCorrection(id: string, request: RejectAttendanceCorrectionRequest): Promise<AttendanceCorrectionResponse | null> {
        return runCorrectionAction('reject', () => api.rejectCorrection(id, request), CORRECTION_REVIEW_ERROR);
      },

      clearCorrectionPreview(): void {
        patchState(store, { correctionPreview: null, correctionError: null });
      },

      clockIn(): Promise<void> {
        return runAction('clockIn', () => api.clockIn(), 'Clocked in.', 'Could not clock in. Try again.');
      },
      startBreak(): Promise<void> {
        return runAction('startBreak', () => api.startBreak(), 'Break started.', 'Could not start your break. Try again.');
      },
      endBreak(): Promise<void> {
        return runAction('endBreak', () => api.endBreak(), 'Break ended.', 'Could not end your break. Try again.');
      },
      clockOut(): Promise<void> {
        return runAction('clockOut', () => api.clockOut(), 'Clocked out.', 'Could not clock out. Try again.');
      }
    };
  })
);

function correctionBusinessMessage(error: unknown, fallback: string): string {
  const status = errorStatus(error);
  const detail = error && typeof error === 'object' && 'error' in error && typeof (error as { error?: unknown }).error === 'object'
    ? (error as { error: { detail?: unknown } }).error.detail
    : null;
  if (status === 409 && typeof detail === 'string') {
    const normalized = detail.toLowerCase();
    if (normalized.includes('approver')) return NO_ATTENDANCE_APPROVER_MESSAGE;
    if (normalized.includes('pending correction')) return 'A pending correction already exists for this work date and change type.';
    if (normalized.includes('changed by another') || normalized.includes('already been updated')) return 'This request has already been updated. Refreshing the list.';
  }
  return fallback;
}

function errorStatus(error: unknown): number | null {
  return error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : null;
}

function thisIsForbidden(error: unknown): boolean {
  return errorStatus(error) === 403;
}
