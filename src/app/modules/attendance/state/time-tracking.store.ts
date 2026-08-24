import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import { ErrorHandlerService } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeTrackingApiService } from '../data-access/time-tracking-api.service';
import {
  AttendanceHistoryRow,
  AttendanceTodayResponse,
  TimeTrackingRange
} from '../models/time-tracking.model';

export type TimeTrackingAction = 'clockIn' | 'startBreak' | 'endBreak' | 'clockOut';

export const TIME_TRACKING_LOAD_ERROR = 'Could not load your attendance today. Try again.';
export const TIME_TRACKING_HISTORY_ERROR = 'Could not load attendance history. Try again.';
export const TIME_TRACKING_COVERED_HISTORY_ERROR = 'Could not load team attendance. Try again.';
export const TIME_TRACKING_COVERED_FORBIDDEN_ERROR = 'You do not have access to view team attendance.';

interface TimeTrackingState {
  readonly today: AttendanceTodayResponse | null;
  readonly todayLoading: boolean;
  readonly todayError: string | null;
  readonly actionLoading: boolean;
  readonly activeAction: TimeTrackingAction | null;
  readonly history: readonly AttendanceHistoryRow[];
  readonly historyLoading: boolean;
  readonly historyError: string | null;
  readonly coveredHistory: readonly AttendanceHistoryRow[];
  readonly coveredHistoryLoading: boolean;
  readonly coveredHistoryError: string | null;
  readonly selectedHistoryRange: TimeTrackingRange | null;
  readonly selectedCoveredEmployeeId: string | null;
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
  coveredHistory: [],
  coveredHistoryLoading: false,
  coveredHistoryError: null,
  selectedHistoryRange: null,
  selectedCoveredEmployeeId: null
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
      if (store.actionLoading()) {
        return;
      }

      patchState(store, {
        actionLoading: true,
        activeAction: action,
        todayError: null
      });

      try {
        const today = await firstValueFrom(operation());
        patchState(store, {
          today,
          actionLoading: false,
          activeAction: null,
          todayError: null
        });
        notifications.success(successMessage);
      } catch (error) {
        const safeMessage = errors.toSafeMessage(error, failureFallback);
        patchState(store, {
          actionLoading: false,
          activeAction: null,
          todayError: safeMessage
        });
        notifications.error(safeMessage);
      }
    };

    return {
      async loadToday(): Promise<void> {
        if (store.todayLoading()) {
          return;
        }

        patchState(store, { todayLoading: true, todayError: null });
        try {
          const today = await firstValueFrom(api.getToday());
          patchState(store, { today, todayLoading: false, todayError: null });
        } catch (error) {
          patchState(store, {
            todayLoading: false,
            todayError: errors.toSafeMessage(error, TIME_TRACKING_LOAD_ERROR)
          });
        }
      },

      async loadMyHistory(range: TimeTrackingRange): Promise<void> {
        if (store.historyLoading()) {
          return;
        }

        patchState(store, {
          historyLoading: true,
          historyError: null,
          selectedHistoryRange: range
        });
        try {
          const history = await firstValueFrom(api.getMyHistory(range.from, range.to));
          patchState(store, { history, historyLoading: false, historyError: null });
        } catch (error) {
          patchState(store, {
            historyLoading: false,
            historyError: errors.toSafeMessage(error, TIME_TRACKING_HISTORY_ERROR)
          });
        }
      },

      async loadCoveredHistory(range: TimeTrackingRange, employeeId?: string): Promise<void> {
        if (store.coveredHistoryLoading()) {
          return;
        }

        const selectedEmployeeId = employeeId?.trim() || null;
        patchState(store, {
          coveredHistoryLoading: true,
          coveredHistoryError: null,
          selectedCoveredEmployeeId: selectedEmployeeId
        });
        try {
          const coveredHistory = await firstValueFrom(
            api.getCoveredHistory(range.from, range.to, selectedEmployeeId ?? undefined)
          );
          patchState(store, {
            coveredHistory,
            coveredHistoryLoading: false,
            coveredHistoryError: null
          });
        } catch (error) {
          const message = thisIsForbidden(error)
            ? TIME_TRACKING_COVERED_FORBIDDEN_ERROR
            : errors.toSafeMessage(error, TIME_TRACKING_COVERED_HISTORY_ERROR);
          patchState(store, {
            coveredHistoryLoading: false,
            coveredHistoryError: message
          });
        }
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

function thisIsForbidden(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'status' in error && (error as { status?: unknown }).status === 403;
}
