import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamActionItemsApiService } from '../data-access/my-team-action-items-api.service';
import { TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

interface MyTeamActionItemsState {
  readonly data: TeamActionItemsResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
}

const initialState: MyTeamActionItemsState = {
  data: null,
  loading: false,
  error: null,
  loadedAt: null
};

function extractError(err: any, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

/** Rows the Action Center asks for - the backend returns only the 4 longest-waiting items across all
 * sources anyway; the chip counts always use the backend's pendingCount totals. */
export const ACTION_ITEMS_PER_SOURCE = 4;

export const MyTeamActionItemsStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamActionItemsState>(initialState),
  withMethods((store, api = inject(MyTeamActionItemsApiService)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getActionItems(ACTION_ITEMS_PER_SOURCE));
        patchState(store, { data, loading: false, loadedAt: new Date() });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load approvals & exceptions.'), loading: false });
      }
    }
  }))
);
