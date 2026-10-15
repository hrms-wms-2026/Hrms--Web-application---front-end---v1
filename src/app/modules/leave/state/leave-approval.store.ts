import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveApprovalApiService } from '../data-access/leave-approval-api.service';
import {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  ForwardLeaveRequestRequest,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDetailResponse,
  LeaveRequestAllListFilter,
  LeaveRequestAllListItemResponse,
  RejectLeaveRequestRequest,
  RequestLeaveInformationRequest,
  RespondLeaveInformationRequest
} from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';

export interface LeaveApprovalState {
  readonly all: readonly LeaveRequestAllListItemResponse[];
  readonly allLoading: boolean;
  readonly allError: string | null;
  readonly allFilter: LeaveRequestAllListFilter;
  readonly detail: LeaveApprovalDetailResponse | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly detailSource: 'approval' | 'ledger';
  readonly deciding: boolean;
  readonly decideError: string | null;
  readonly cancelling: boolean;
  readonly cancelDialogError: string | null;
}

const initialState: LeaveApprovalState = {
  all: [],
  allLoading: false,
  allError: null,
  allFilter: {},
  detail: null,
  detailLoading: false,
  detailError: null,
  detailSource: 'approval',
  deciding: false,
  decideError: null,
  cancelling: false,
  cancelDialogError: null
};

export const LeaveApprovalStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveApprovalState>(initialState),
  withMethods((store, api = inject(LeaveApprovalApiService)) => ({
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
        return result;
      } catch (err) {
        patchState(store, { deciding: false, decideError: toSafeErrorMessage(err, 'Failed to record your decision.') });
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
    }
  }))
);
