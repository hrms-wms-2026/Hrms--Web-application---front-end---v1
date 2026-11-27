import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { MyTeamCapabilitiesApiService } from '../data-access/my-team-capabilities-api.service';
import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

interface MyTeamCapabilitiesState {
  readonly capabilities: MyTeamCapabilitiesResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
}

const initialState: MyTeamCapabilitiesState = {
  capabilities: null,
  loading: false,
  error: null,
  loaded: false
};

function extractError(err: unknown, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

/** Root-provided so every widget on /dashboard and the page shell itself share one fetch -
 * capabilities are called exactly once per /dashboard activation (My Team spec §5, §7.2). */
export const MyTeamCapabilitiesStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamCapabilitiesState>(initialState),
  withMethods((store, api = inject(MyTeamCapabilitiesApiService)) => {
    async function load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getCapabilities());
        patchState(store, { capabilities: response, loading: false, loaded: true });
      } catch (err) {
        patchState(store, {
          error: extractError(err, 'Failed to load My Team capabilities.'),
          loading: false,
          // Not loaded: a failed fetch must not be cached, or ensureLoaded() would never retry it and
          // the widgets would stay without capabilities until a page refresh.
          loaded: false
        });
      }
    }

    return {
      /** Always refetches - used by the page shell on every /dashboard activation and after a
       * section reports a stale 403 (My Team spec §14 "403 from a section"). */
      loadCapabilities: load,
      refresh: load,
      /** Fetches only if nothing has been loaded yet and nothing is in flight - for a widget that
       * mounts after the page shell has already triggered the real load. */
      async ensureLoaded(): Promise<void> {
        if (store.loaded() || store.loading()) return;
        await load();
      }
    };
  })
);
