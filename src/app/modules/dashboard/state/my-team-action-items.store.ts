import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamActionItemsApiService } from '../data-access/my-team-action-items-api.service';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';

interface MyTeamActionItemsState {
  readonly data: TeamActionItemsResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: MyTeamActionItemsState = {
  data: null,
  loading: false,
  error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const MyTeamActionItemsStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamActionItemsState>(initialState),
  withMethods((store, api = inject(MyTeamActionItemsApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getActionItems());
        patchState(store, { data, loading: false });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load approvals & exceptions.'), loading: false });
      }
    }
  }))
);
