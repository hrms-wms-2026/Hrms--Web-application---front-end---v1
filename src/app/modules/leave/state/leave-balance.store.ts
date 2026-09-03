import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveBalanceApiService } from '../data-access/leave-balance-api.service';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter } from '../models/leave-balance.model';
export interface LeaveBalanceState { readonly year: number; readonly my: readonly LeaveBalanceResponse[]; readonly myLoading: boolean; readonly myError: string | null; readonly team: readonly LeaveBalanceResponse[]; readonly teamFilters: LeaveBalanceTeamFilter; readonly teamLoading: boolean; readonly teamError: string | null; readonly all: readonly LeaveBalanceResponse[]; readonly allFilters: LeaveBalanceAllFilter; readonly allLoading: boolean; readonly allError: string | null; }
const initialState: LeaveBalanceState = { year: new Date().getFullYear(), my: [], myLoading: false, myError: null, team: [], teamFilters: {}, teamLoading: false, teamError: null, all: [], allFilters: {}, allLoading: false, allError: null };
export const LeaveBalanceStore = signalStore({ providedIn: 'root' }, withState<LeaveBalanceState>(initialState), withMethods((store, api = inject(LeaveBalanceApiService)) => ({
  async loadMy(year: number): Promise<void> { patchState(store, { year, myLoading: true, myError: null }); try { const my = await firstValueFrom(api.my(year)); patchState(store, { my, myLoading: false }); } catch (err) { patchState(store, { myLoading: false, myError: toSafeErrorMessage(err, 'Failed to load your balances.') }); } },
  setTeamFilters(filters: LeaveBalanceTeamFilter): void { patchState(store, { teamFilters: filters }); void this.loadTeam(store.year()); },
  async loadTeam(year: number): Promise<void> { patchState(store, { year, teamLoading: true, teamError: null }); try { const team = await firstValueFrom(api.team(year, store.teamFilters())); patchState(store, { team, teamLoading: false }); } catch (err) { patchState(store, { teamLoading: false, teamError: toSafeErrorMessage(err, 'Failed to load team balances.') }); } },
  setAllFilters(filters: LeaveBalanceAllFilter): void { patchState(store, { allFilters: filters }); void this.loadAll(store.year()); },
  async loadAll(year: number): Promise<void> { patchState(store, { year, allLoading: true, allError: null }); try { const all = await firstValueFrom(api.all(year, store.allFilters())); patchState(store, { all, allLoading: false }); } catch (err) { patchState(store, { allLoading: false, allError: toSafeErrorMessage(err, 'Failed to load all balances.') }); } }
})));
