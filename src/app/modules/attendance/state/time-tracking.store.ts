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
  AttendanceDayDetail,
  AttendanceHistoryRow,
  AttendanceTodayResponse,
  TimeTrackingRange
} from '../models/time-tracking.model';
import {
  WorkAreaChangeRequestPayload,
  WorkAreaChangeRequestPreviewResponse,
  WorkAreaChangeRequestQuery,
  WorkAreaChangeRequestResponse
} from '../models/work-area-change-request.model';

const DEFAULT_PAGE_SIZE = 20;

export type TimeTrackingAction = 'clockIn' | 'startBreak' | 'endBreak' | 'clockOut';
export type CorrectionAction = 'preview' | 'submit' | 'cancel' | 'approve' | 'reject';
export type WorkAreaChangeAction = 'preview' | 'submit' | 'cancel' | 'approve' | 'reject';

export const TIME_TRACKING_LOAD_ERROR = 'Could not load your attendance today. Try again.';
export const TIME_TRACKING_HISTORY_ERROR = 'Could not load attendance history. Try again.';
export const TIME_TRACKING_COVERED_HISTORY_ERROR = 'Could not load team attendance. Try again.';
export const TIME_TRACKING_DAY_DETAIL_ERROR = 'Could not load attendance details. Try again.';
export const TIME_TRACKING_COVERED_FORBIDDEN_ERROR = 'You do not have access to view team attendance.';
export const CORRECTIONS_LOAD_ERROR = 'Could not load your correction requests. Try again.';
export const CORRECTIONS_APPROVAL_LOAD_ERROR = 'Could not load attendance correction approvals. Try again.';
export const CORRECTION_PREVIEW_ERROR = 'We could not confirm who will receive this request.';
export const CORRECTION_SUBMIT_ERROR = 'Could not submit the correction request. Try again.';
export const CORRECTION_CANCEL_ERROR = 'Could not cancel the correction request. Try again.';
export const CORRECTION_REVIEW_ERROR = 'Could not update this correction request. Try again.';
export const WORK_AREA_REQUESTS_LOAD_ERROR = 'Could not load your work-area requests. Try again.';
export const WORK_AREA_APPROVALS_LOAD_ERROR = 'Could not load work-area approvals. Try again.';
export const WORK_AREA_PREVIEW_ERROR = 'We could not review this work-area change request. Try again.';
export const WORK_AREA_CREATE_ERROR = 'Could not send the work-area change request. Try again.';
export const WORK_AREA_DECISION_ERROR = 'Could not update this work-area change request. Try again.';
export const WORK_AREA_CANCEL_ERROR = 'Could not cancel the work-area change request. Try again.';
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
  readonly dayDetail: AttendanceDayDetail | null;
  readonly dayDetailLoading: boolean;
  readonly dayDetailError: string | null;
  readonly myCorrections: readonly AttendanceCorrectionListItem[];
  readonly myCorrectionsLoading: boolean;
  readonly myCorrectionsError: string | null;
  readonly myCorrectionsPage: number;
  readonly myCorrectionsPageSize: number;
  readonly myCorrectionsTotalCount: number;
  readonly myCorrectionsLoaded: boolean;
  readonly approvalInbox: readonly AttendanceCorrectionApprovalListItem[];
  readonly approvalInboxLoading: boolean;
  readonly approvalInboxError: string | null;
  readonly approvalInboxLoaded: boolean;
  readonly correctionPreview: AttendanceCorrectionPreviewResponse | null;
  readonly correctionError: string | null;
  readonly correctionActionLoading: boolean;
  readonly activeCorrectionAction: CorrectionAction | null;
  readonly workAreaPreview: WorkAreaChangeRequestPreviewResponse | null;
  readonly workAreaPreviewLoading: boolean;
  readonly workAreaPreviewError: string | null;
  readonly workAreaCreateLoading: boolean;
  readonly workAreaCreateError: string | null;
  readonly myWorkAreaRequests: readonly WorkAreaChangeRequestResponse[];
  readonly myWorkAreaRequestsLoading: boolean;
  readonly myWorkAreaRequestsError: string | null;
  readonly myWorkAreaRequestsPage: number;
  readonly myWorkAreaRequestsPageSize: number;
  readonly myWorkAreaRequestsTotalCount: number;
  readonly myWorkAreaRequestsLoaded: boolean;
  readonly workAreaApprovalInbox: readonly WorkAreaChangeRequestResponse[];
  readonly workAreaApprovalInboxLoading: boolean;
  readonly workAreaApprovalInboxError: string | null;
  readonly workAreaApprovalInboxPage: number;
  readonly workAreaApprovalInboxPageSize: number;
  readonly workAreaApprovalInboxTotalCount: number;
  readonly workAreaApprovalInboxLoaded: boolean;
  readonly selectedWorkAreaApprovalRequest: WorkAreaChangeRequestResponse | null;
  readonly activeWorkAreaRequestId: string | null;
  readonly activeWorkAreaAction: WorkAreaChangeAction | null;
  readonly workAreaActionLoading: boolean;
  readonly myWorkAreaRequestFilters: WorkAreaChangeRequestQuery;
  readonly workAreaApprovalFilters: WorkAreaChangeRequestQuery;
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
  dayDetail: null,
  dayDetailLoading: false,
  dayDetailError: null,
  myCorrections: [],
  myCorrectionsLoading: false,
  myCorrectionsError: null,
  myCorrectionsPage: 1,
  myCorrectionsPageSize: DEFAULT_PAGE_SIZE,
  myCorrectionsTotalCount: 0,
  myCorrectionsLoaded: false,
  approvalInbox: [],
  approvalInboxLoading: false,
  approvalInboxError: null,
  approvalInboxLoaded: false,
  correctionPreview: null,
  correctionError: null,
  correctionActionLoading: false,
  activeCorrectionAction: null,
  workAreaPreview: null,
  workAreaPreviewLoading: false,
  workAreaPreviewError: null,
  workAreaCreateLoading: false,
  workAreaCreateError: null,
  myWorkAreaRequests: [],
  myWorkAreaRequestsLoading: false,
  myWorkAreaRequestsError: null,
  myWorkAreaRequestsPage: 1,
  myWorkAreaRequestsPageSize: DEFAULT_PAGE_SIZE,
  myWorkAreaRequestsTotalCount: 0,
  myWorkAreaRequestsLoaded: false,
  workAreaApprovalInbox: [],
  workAreaApprovalInboxLoading: false,
  workAreaApprovalInboxError: null,
  workAreaApprovalInboxPage: 1,
  workAreaApprovalInboxPageSize: DEFAULT_PAGE_SIZE,
  workAreaApprovalInboxTotalCount: 0,
  workAreaApprovalInboxLoaded: false,
  selectedWorkAreaApprovalRequest: null,
  activeWorkAreaRequestId: null,
  activeWorkAreaAction: null,
  workAreaActionLoading: false,
  myWorkAreaRequestFilters: { pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE },
  workAreaApprovalFilters: { pageNumber: 1, pageSize: DEFAULT_PAGE_SIZE }
};

export const TimeTrackingStore = signalStore(
  { providedIn: 'root' },
  withState<TimeTrackingState>(initialState),
  withMethods((store, api = inject(TimeTrackingApiService), notifications = inject(NotificationService), errors = inject(ErrorHandlerService)) => {
    const runAction = async (
      action: TimeTrackingAction,
      operation: () => Observable<AttendanceTodayResponse>,
      successMessage: string,
      failureFallback: string,
      businessMessage?: (error: unknown, fallback: string) => string
    ): Promise<void> => {
      if (store.actionLoading()) return;
      patchState(store, { actionLoading: true, activeAction: action, todayError: null });
      try {
        const today = await firstValueFrom(operation());
        patchState(store, { today, actionLoading: false, activeAction: null, todayError: null });
        notifications.success(successMessage);
      } catch (error) {
        const fallback = errors.toSafeMessage(error, failureFallback);
        const safeMessage = businessMessage ? businessMessage(error, fallback) : fallback;
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

    const runWorkAreaMutation = async <T>(
      action: WorkAreaChangeAction,
      requestId: string | null,
      operation: () => Observable<T>,
      failureFallback: string,
      onConflict?: () => Promise<void>
    ): Promise<T | null> => {
      if (store.workAreaActionLoading()) return null;
      patchState(store, {
        workAreaActionLoading: true,
        workAreaCreateLoading: action === 'submit',
        activeWorkAreaAction: action,
        activeWorkAreaRequestId: requestId,
        workAreaCreateError: null
      });
      try {
        const result = await firstValueFrom(operation());
        patchState(store, {
          workAreaActionLoading: false,
          workAreaCreateLoading: false,
          activeWorkAreaAction: null,
          activeWorkAreaRequestId: null,
          workAreaCreateError: null
        });
        return result;
      } catch (error) {
        const safeMessage = workAreaBusinessMessage(error, errors.toSafeMessage(error, failureFallback));
        patchState(store, {
          workAreaActionLoading: false,
          workAreaCreateLoading: false,
          activeWorkAreaAction: null,
          activeWorkAreaRequestId: null,
          workAreaCreateError: safeMessage
        });
        notifications.error(safeMessage);
        if (errorStatus(error) === 409 && onConflict) await onConflict();
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

      async loadDayDetail(employeeId: string, workDate: string): Promise<void> {
        if (store.dayDetailLoading()) return;
        patchState(store, { dayDetailLoading: true, dayDetailError: null, dayDetail: null });
        try {
          const detail = await firstValueFrom(api.getDayDetail(employeeId, workDate));
          patchState(store, { dayDetail: detail, dayDetailLoading: false, dayDetailError: null });
        } catch (error) {
          patchState(store, { dayDetailLoading: false, dayDetailError: errors.toSafeMessage(error, TIME_TRACKING_DAY_DETAIL_ERROR) });
        }
      },

      clearDayDetail(): void {
        patchState(store, { dayDetail: null, dayDetailLoading: false, dayDetailError: null });
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
            myCorrectionsError: null,
            myCorrectionsLoaded: true
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
          patchState(store, { approvalInbox, approvalInboxLoading: false, approvalInboxError: null, approvalInboxLoaded: true });
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

      async previewWorkAreaChange(payload: WorkAreaChangeRequestPayload): Promise<WorkAreaChangeRequestPreviewResponse | null> {
        if (store.workAreaPreviewLoading()) return null;
        patchState(store, { workAreaPreviewLoading: true, workAreaPreviewError: null });
        try {
          const preview = await firstValueFrom(api.previewWorkAreaChange(payload));
          patchState(store, { workAreaPreview: preview, workAreaPreviewLoading: false, workAreaPreviewError: null });
          return preview;
        } catch (error) {
          const safeMessage = workAreaBusinessMessage(error, errors.toSafeMessage(error, WORK_AREA_PREVIEW_ERROR));
          patchState(store, { workAreaPreviewLoading: false, workAreaPreviewError: safeMessage });
          notifications.error(safeMessage);
          return null;
        }
      },

      async submitWorkAreaChangeRequest(payload: WorkAreaChangeRequestPayload): Promise<WorkAreaChangeRequestResponse | null> {
        const result = await runWorkAreaMutation('submit', null, () => api.createWorkAreaChangeRequest(payload), WORK_AREA_CREATE_ERROR);
        if (result) notifications.success('Work-area change request sent.');
        return result;
      },

      async loadMyWorkAreaRequests(query: Partial<WorkAreaChangeRequestQuery> = {}): Promise<void> {
        if (store.myWorkAreaRequestsLoading()) return;
        const filters = store.myWorkAreaRequestFilters();
        const requestQuery: WorkAreaChangeRequestQuery = {
          ...filters,
          ...query,
          pageNumber: query.pageNumber ?? filters.pageNumber,
          pageSize: query.pageSize ?? filters.pageSize
        };
        patchState(store, {
          myWorkAreaRequestsLoading: true,
          myWorkAreaRequestsError: null,
          myWorkAreaRequestFilters: requestQuery
        });
        try {
          const result = await firstValueFrom(api.getMyWorkAreaChangeRequests(requestQuery));
          patchState(store, {
            myWorkAreaRequests: result.items,
            myWorkAreaRequestsPage: result.pageNumber,
            myWorkAreaRequestsPageSize: result.pageSize,
            myWorkAreaRequestsTotalCount: result.totalCount,
            myWorkAreaRequestsLoading: false,
            myWorkAreaRequestsError: null,
            myWorkAreaRequestsLoaded: true,
            myWorkAreaRequestFilters: { ...requestQuery, pageNumber: result.pageNumber, pageSize: result.pageSize }
          });
        } catch (error) {
          patchState(store, { myWorkAreaRequestsLoading: false, myWorkAreaRequestsError: errors.toSafeMessage(error, WORK_AREA_REQUESTS_LOAD_ERROR) });
        }
      },

      async loadWorkAreaApprovalInbox(query: Partial<WorkAreaChangeRequestQuery> = {}): Promise<void> {
        if (store.workAreaApprovalInboxLoading()) return;
        const filters = store.workAreaApprovalFilters();
        const requestQuery: WorkAreaChangeRequestQuery = {
          ...filters,
          ...query,
          pageNumber: query.pageNumber ?? filters.pageNumber,
          pageSize: query.pageSize ?? filters.pageSize
        };
        patchState(store, {
          workAreaApprovalInboxLoading: true,
          workAreaApprovalInboxError: null,
          workAreaApprovalFilters: requestQuery
        });
        try {
          const result = await firstValueFrom(api.getWorkAreaChangeApprovalInbox(requestQuery));
          patchState(store, {
            workAreaApprovalInbox: result.items,
            workAreaApprovalInboxPage: result.pageNumber,
            workAreaApprovalInboxPageSize: result.pageSize,
            workAreaApprovalInboxTotalCount: result.totalCount,
            workAreaApprovalInboxLoading: false,
            workAreaApprovalInboxError: null,
            workAreaApprovalInboxLoaded: true,
            workAreaApprovalFilters: { ...requestQuery, pageNumber: result.pageNumber, pageSize: result.pageSize }
          });
        } catch (error) {
          patchState(store, { workAreaApprovalInboxLoading: false, workAreaApprovalInboxError: errors.toSafeMessage(error, WORK_AREA_APPROVALS_LOAD_ERROR) });
        }
      },

      async approveWorkAreaChangeRequest(id: string, reviewComment?: string | null): Promise<WorkAreaChangeRequestResponse | null> {
        const result = await runWorkAreaMutation(
          'approve', id,
          () => api.approveWorkAreaChangeRequest(id, reviewComment),
          WORK_AREA_DECISION_ERROR,
          () => this.loadWorkAreaApprovalInbox()
        );
        if (result) notifications.success('Work-area change request approved.');
        return result;
      },

      async rejectWorkAreaChangeRequest(id: string, reviewComment: string): Promise<WorkAreaChangeRequestResponse | null> {
        const result = await runWorkAreaMutation(
          'reject', id,
          () => api.rejectWorkAreaChangeRequest(id, reviewComment),
          WORK_AREA_DECISION_ERROR,
          () => this.loadWorkAreaApprovalInbox()
        );
        if (result) notifications.success('Work-area change request rejected.');
        return result;
      },

      async cancelWorkAreaChangeRequest(id: string): Promise<WorkAreaChangeRequestResponse | null> {
        const result = await runWorkAreaMutation(
          'cancel', id,
          () => api.cancelWorkAreaChangeRequest(id),
          WORK_AREA_CANCEL_ERROR,
          () => this.loadMyWorkAreaRequests()
        );
        if (result) notifications.success('Work-area change request cancelled.');
        return result;
      },

      selectWorkAreaApprovalRequest(request: WorkAreaChangeRequestResponse | null): void {
        patchState(store, { selectedWorkAreaApprovalRequest: request });
      },

      clearWorkAreaPreview(): void {
        patchState(store, { workAreaPreview: null, workAreaPreviewError: null });
      },

      resetWorkAreaRequestUiState(): void {
        patchState(store, {
          workAreaPreview: null,
          workAreaPreviewLoading: false,
          workAreaPreviewError: null,
          workAreaCreateLoading: false,
          workAreaCreateError: null,
          selectedWorkAreaApprovalRequest: null,
          activeWorkAreaRequestId: null,
          activeWorkAreaAction: null,
          workAreaActionLoading: false
        });
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
        return runAction(
          'clockOut',
          () => api.clockOut(),
          'Clocked out.',
          'Could not clock out. Try again.',
          clockOutBusinessMessage
        );
      }
    };
  })
);

function clockOutBusinessMessage(error: unknown, fallback: string): string {
  // The open-task-session conflict message is backend-authored and names the running task(s) by
  // title, which is free text that can trip toSafeErrorMessage's generic isMachineValue filter
  // (e.g. a task titled "Update API docs" matches its raw-SQL-keyword check). Detected by this
  // stable marker phrase, the raw detail is shown as-is rather than routed through that filter.
  const status = errorStatus(error);
  const detail = errorDetail(error);
  if (status === 409 && detail && detail.includes('before clocking out for the day')) {
    return detail;
  }
  return fallback;
}

function workAreaBusinessMessage(error: unknown, fallback: string): string {
  const status = errorStatus(error);
  const detail = errorDetail(error)?.toLowerCase() ?? '';
  if (status === 409 || status === 400 || status === 422) {
    if (detail.includes('active work-area') || detail.includes('active work area')) return 'You already have an active request for this date.';
    if (detail.includes('already been updated') || detail.includes('changed by another')) return 'This request has already been updated. Refreshing the list.';
    if (detail.includes('only be requested for today') || detail.includes('future date')) return 'Choose today or a future date.';
    if (detail.includes('already planned')) return 'That work area is already planned for this date.';
    if (detail.includes('no eligible') && detail.includes('approver')) return 'No eligible approver is currently available. Contact your HR administrator.';
    if (detail.includes('field work-area')) return 'Field work-area changes are not supported.';
    if (detail.includes('reason is required')) return 'Enter a reason for the request.';
    if (detail.includes('date is required')) return 'Choose a request date.';
    if (detail.includes('onsite or remote')) return 'Choose On-site or Remote.';
    if (detail.includes('review comment')) return 'Add a reason before rejecting this request.';
  }
  return fallback;
}

function errorDetail(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const response = error as { error?: unknown; detail?: unknown };
  if (typeof response.detail === 'string') return response.detail;
  if (response.error && typeof response.error === 'object' && typeof (response.error as { detail?: unknown }).detail === 'string') {
    return (response.error as { detail: string }).detail;
  }
  return null;
}

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
