import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveTypeApiService } from '../data-access/leave-type-api.service';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

export interface LeaveTypeState {
  readonly items: readonly LeaveTypeResponse[];
  readonly includeInactive: boolean;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string | null;
  readonly actionError: string | null;
}

const initialState: LeaveTypeState = { items: [], includeInactive: false, loading: false, saving: false, loadError: null, actionError: null };

export const LeaveTypeStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveTypeState>(initialState),
  withMethods((store, api = inject(LeaveTypeApiService)) => ({
    setIncludeInactive(includeInactive: boolean): void {
      patchState(store, { includeInactive });
      void this.load();
    },
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list(store.includeInactive()));
        patchState(store, { items, loading: false });
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
