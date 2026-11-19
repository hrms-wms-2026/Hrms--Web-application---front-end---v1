import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveTypeApiService } from '../data-access/leave-type-api.service';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

export interface LeaveTypeState {
  readonly items: readonly LeaveTypeResponse[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string | null;
  readonly actionError: string | null;
  /** True once a load has succeeded, so "no leave types" can be told apart from "not loaded yet". */
  readonly loaded: boolean;
}

const initialState: LeaveTypeState = { items: [], loading: false, saving: false, loadError: null, actionError: null, loaded: false };

export const LeaveTypeStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveTypeState>(initialState),
  withMethods((store, api = inject(LeaveTypeApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list(false));
        patchState(store, { items, loading: false, loaded: true });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave types.') });
      }
    },
    async createLeaveType(payload: CreateLeaveTypeRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.create(payload));
        patchState(store, { saving: false });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create leave type.') });
        return false;
      }
    },
    async updateLeaveType(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.update(leaveTypeId, payload));
        patchState(store, { saving: false });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update leave type.') });
        return false;
      }
    },
    async deactivateLeaveType(leaveTypeId: string, confirmed: boolean): Promise<'success' | 'confirm' | 'error'> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.deactivate(leaveTypeId, confirmed));
        patchState(store, { saving: false });
        await this.load();
        return 'success';
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 409 && !confirmed) {
          patchState(store, { saving: false });
          return 'confirm';
        }
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to deactivate leave type.') });
        return 'error';
      }
    }
  }))
);
