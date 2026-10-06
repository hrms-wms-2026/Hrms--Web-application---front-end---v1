import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveApprovalApiService } from '../data-access/leave-approval-api.service';
import {
  ApproveLeaveRequestRequest,
  BulkApproveLeaveRequestsRequest,
  BulkRejectLeaveRequestsRequest,
  ChangeLeaveDecisionRequest,
  CreateLeaveApprovalDelegateRequest,
  ForwardLeaveRequestRequest,
  LeaveApprovalBulkResultResponse,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDelegateResponse,
  LeaveApprovalDetailResponse,
  LeaveApprovalHistoryFilter,
  LeaveApprovalHistoryItemResponse,
  LeaveApprovalListFilter,
  LeavePendingApprovalListItemResponse,
  LeaveRequestAllListFilter,
  LeaveRequestAllListItemResponse,
  RejectLeaveRequestRequest,
  RequestLeaveInformationRequest,
  RespondLeaveInformationRequest
} from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';

export interface LeaveApprovalState {
  readonly pending: readonly LeavePendingApprovalListItemResponse[];
  readonly pendingLoading: boolean;
  readonly pendingError: string | null;
  readonly pendingFilter: LeaveApprovalListFilter;
  readonly all: readonly LeaveRequestAllListItemResponse[];
  readonly allLoading: boolean;
  readonly allError: string | null;
  readonly allFilter: LeaveRequestAllListFilter;
  readonly history: readonly LeaveApprovalHistoryItemResponse[];
  readonly historyLoading: boolean;
  readonly historyError: string | null;
  readonly historyFilter: LeaveApprovalHistoryFilter;
  readonly detail: LeaveApprovalDetailResponse | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly detailSource: 'approval' | 'ledger';
  readonly deciding: boolean;
  readonly decideError: string | null;
  readonly cancelling: boolean;
  readonly cancelDialogError: string | null;
  readonly delegates: readonly LeaveApprovalDelegateResponse[];
  readonly delegatesLoading: boolean;
  readonly delegatesError: string | null;
}

const initialState: LeaveApprovalState = {
  pending: [],
  pendingLoading: false,
  pendingError: null,
  pendingFilter: {},
  all: [],
  allLoading: false,
  allError: null,
  allFilter: {},
  history: [],
  historyLoading: false,
  historyError: null,
  historyFilter: {},
  detail: null,
  detailLoading: false,
  detailError: null,
  detailSource: 'approval',
  deciding: false,
  decideError: null,
  cancelling: false,
  cancelDialogError: null,
  delegates: [],
  delegatesLoading: false,
  delegatesError: null
};

export const LeaveApprovalStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveApprovalState>(initialState),
  withMethods((store, api = inject(LeaveApprovalApiService)) => ({
    setPendingFilter(filter: LeaveApprovalListFilter): void {
      patchState(store, { pendingFilter: filter });
      void this.loadPending();
    },
    async loadPending(): Promise<void> {
      patchState(store, { pendingLoading: true, pendingError: null });
      try {
        const pending = await firstValueFrom(api.listPending(store.pendingFilter()));
        patchState(store, { pending, pendingLoading: false });
      } catch (err) {
        patchState(store, { pendingLoading: false, pendingError: toSafeErrorMessage(err, 'Failed to load pending approvals.') });
      }
    },
    setHistoryFilter(filter: LeaveApprovalHistoryFilter): void {
      patchState(store, { historyFilter: filter });
      void this.loadHistory();
    },
    async loadHistory(): Promise<void> {
      patchState(store, { historyLoading: true, historyError: null });
      try {
        const history = await firstValueFrom(api.listHistory(store.historyFilter()));
        patchState(store, { history, historyLoading: false });
      } catch (err) {
        patchState(store, { historyLoading: false, historyError: toSafeErrorMessage(err, 'Failed to load your approval history.') });
      }
    },
    setAllFilter(filter: LeaveRequestAllListFilter): void {
      patchState(store, { allFilter: filter });
      void this.loadAll();
    },
    async loadAll(): Promise<void> {
      patchState(store, { allLoading: true, allError: null });
      try {
        const all = await firstValueFrom(api.listAll(store.allFilter()));
        patchState(store, { all, allLoading: false });
      } catch (err) {
        patchState(store, { allLoading: false, allError: toSafeErrorMessage(err, 'Failed to load requests.') });
      }
    },
    async loadDetail(requestId: string, source: 'approval' | 'ledger' = 'approval'): Promise<void> {
      patchState(store, { detailLoading: true, detailError: null, detailSource: source });
      try {
        const detail = await firstValueFrom(source === 'ledger' ? api.getLedgerDetail(requestId) : api.getDetail(requestId));
        patchState(store, { detail, detailLoading: false });
      } catch (err) {
        patchState(store, { detailLoading: false, detailError: toSafeErrorMessage(err, 'Failed to load this request.') });
      }
    },
    clearDetail(): void {
      patchState(store, { detail: null, detailError: null });
    },
    async approve(requestId: string, payload: ApproveLeaveRequestRequest): Promise<LeaveApprovalDecisionResponse | null> {
      return this.decide(() => api.approve(requestId, payload), requestId);
    },
    async reject(requestId: string, payload: RejectLeaveRequestRequest): Promise<LeaveApprovalDecisionResponse | null> {
      return this.decide(() => api.reject(requestId, payload), requestId);
    },
    async requestInfo(requestId: string, payload: RequestLeaveInformationRequest): Promise<LeaveApprovalDecisionResponse | null> {
      return this.decide(() => api.requestInfo(requestId, payload), requestId);
    },
    async changeDecision(requestId: string, payload: ChangeLeaveDecisionRequest): Promise<LeaveApprovalDecisionResponse | null> {
      return this.decide(() => api.changeDecision(requestId, payload), requestId);
    },
    async forward(requestId: string, payload: ForwardLeaveRequestRequest): Promise<LeaveApprovalDecisionResponse | null> {
      return this.decide(() => api.forward(requestId, payload), requestId);
    },
    async respondInfo(requestId: string, payload: RespondLeaveInformationRequest): Promise<LeaveApprovalDecisionResponse | null> {
      patchState(store, { deciding: true, decideError: null });
      try {
        const result = await firstValueFrom(api.respondInfo(requestId, payload));
        patchState(store, { deciding: false });
        return result;
      } catch (err) {
        patchState(store, { deciding: false, decideError: toSafeErrorMessage(err, 'Failed to send this reply.') });
        return null;
      }
    },
    async decide(
      call: () => ReturnType<LeaveApprovalApiService['approve']>,
      requestId: string
    ): Promise<LeaveApprovalDecisionResponse | null> {
      patchState(store, { deciding: true, decideError: null });
      try {
        const result = await firstValueFrom(call());
        patchState(store, { deciding: false });
        const source = store.detailSource();
        await this.loadDetail(requestId, source);
        if (source === 'ledger') await this.loadAll();
        else await this.loadPending();
        return result;
      } catch (err) {
        patchState(store, { deciding: false, decideError: toSafeErrorMessage(err, 'Failed to record your decision.') });
        return null;
      }
    },
    async bulkApprove(payload: BulkApproveLeaveRequestsRequest): Promise<LeaveApprovalBulkResultResponse | null> {
      patchState(store, { deciding: true, decideError: null });
      try {
        const result = await firstValueFrom(api.bulkApprove(payload));
        patchState(store, { deciding: false });
        await this.loadPending();
        return result;
      } catch (err) {
        patchState(store, { deciding: false, decideError: toSafeErrorMessage(err, 'Failed to bulk approve these requests.') });
        return null;
      }
    },
    async bulkReject(payload: BulkRejectLeaveRequestsRequest): Promise<LeaveApprovalBulkResultResponse | null> {
      patchState(store, { deciding: true, decideError: null });
      try {
        const result = await firstValueFrom(api.bulkReject(payload));
        patchState(store, { deciding: false });
        await this.loadPending();
        return result;
      } catch (err) {
        patchState(store, { deciding: false, decideError: toSafeErrorMessage(err, 'Failed to bulk reject these requests.') });
        return null;
      }
    },
    async cancel(requestId: string, payload: CancelLeaveRequestRequest): Promise<CancelLeaveRequestResponse | null> {
      patchState(store, { cancelling: true, cancelDialogError: null });
      try {
        const result = await firstValueFrom(api.cancel(requestId, payload));
        patchState(store, { cancelling: false });
        await this.loadAll();
        return result;
      } catch (err) {
        patchState(store, { cancelling: false, cancelDialogError: toSafeErrorMessage(err, 'Failed to cancel this request.') });
        return null;
      }
    },
    async loadDelegates(): Promise<void> {
      patchState(store, { delegatesLoading: true, delegatesError: null });
      try {
        const delegates = await firstValueFrom(api.listDelegates());
        patchState(store, { delegates, delegatesLoading: false });
      } catch (err) {
        patchState(store, { delegatesLoading: false, delegatesError: toSafeErrorMessage(err, 'Failed to load cover periods.') });
      }
    },
    async createDelegate(payload: CreateLeaveApprovalDelegateRequest): Promise<LeaveApprovalDelegateResponse | null> {
      patchState(store, { delegatesError: null });
      try {
        const created = await firstValueFrom(api.createDelegate(payload));
        await this.loadDelegates();
        return created;
      } catch (err) {
        patchState(store, { delegatesError: toSafeErrorMessage(err, 'Failed to save this cover period.') });
        return null;
      }
    },
    async deleteDelegate(id: string): Promise<boolean> {
      try {
        await firstValueFrom(api.deleteDelegate(id));
        await this.loadDelegates();
        return true;
      } catch (err) {
        patchState(store, { delegatesError: toSafeErrorMessage(err, 'Failed to remove this cover period.') });
        return false;
      }
    }
  }))
);
