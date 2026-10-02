import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CalendarConnectionApiService } from '../data-access/calendar-connection-api.service';
import { CalendarConnection, CalendarOAuthProviderSlug, CalendarSyncDirection } from '../models/calendar-connection.model';

export const CALENDAR_CONNECTIONS_LOAD_ERROR = 'Could not load calendar connections. Try again.';
export const CALENDAR_CONNECTIONS_CONNECT_ERROR = 'Could not start the connection. Try again.';
export const CALENDAR_CONNECTIONS_UPDATE_ERROR = 'Could not update sync settings. Try again.';
export const CALENDAR_CONNECTIONS_DISCONNECT_ERROR = 'Could not disconnect. Try again.';
export const CALENDAR_CONNECTIONS_SYNC_ERROR = 'Could not trigger sync. Try again.';

export interface CalendarConnectionsState {
  readonly connections: readonly CalendarConnection[];
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  /** Set while a connect() redirect is being prepared, so the right button shows a spinner. */
  readonly connectingProvider: CalendarOAuthProviderSlug | null;
  readonly actionLoadingByConnectionId: Readonly<Record<string, boolean>>;
  readonly actionErrorByConnectionId: Readonly<Record<string, string>>;
}

const initialState: CalendarConnectionsState = {
  connections: [],
  loading: false,
  loaded: false,
  error: null,
  connectingProvider: null,
  actionLoadingByConnectionId: {},
  actionErrorByConnectionId: {}
};

export const CalendarConnectionsStore = signalStore(
  { providedIn: 'root' },
  withState<CalendarConnectionsState>(initialState),
  withMethods((store, api = inject(CalendarConnectionApiService)) => ({
    async load(): Promise<void> {
      if (store.loading()) {
        return;
      }
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.list());
        patchState(store, { connections: response.connections, loading: false, loaded: true, error: null });
      } catch {
        patchState(store, { loading: false, error: CALENDAR_CONNECTIONS_LOAD_ERROR });
      }
    },

    /** Redirects the browser to the provider's consent screen on success - there is no "return value" to render. */
    async connect(provider: CalendarOAuthProviderSlug): Promise<void> {
      patchState(store, { connectingProvider: provider, error: null });
      try {
        const response = await firstValueFrom(api.connect(provider));
        window.location.href = response.authorizeUrl;
      } catch {
        patchState(store, { connectingProvider: null, error: CALENDAR_CONNECTIONS_CONNECT_ERROR });
      }
    },

    async updateSyncDirection(id: string, syncDirection: CalendarSyncDirection): Promise<boolean> {
      patchState(store, {
        actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: true },
        actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: '' }
      });
      try {
        await firstValueFrom(api.updateSyncDirection(id, syncDirection));
        patchState(store, {
          connections: store.connections().map((c) => (c.id === id ? { ...c, syncDirection } : c)),
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false }
        });
        return true;
      } catch {
        patchState(store, {
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false },
          actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: CALENDAR_CONNECTIONS_UPDATE_ERROR }
        });
        return false;
      }
    },

    async disconnect(id: string): Promise<boolean> {
      patchState(store, {
        actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: true },
        actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: '' }
      });
      try {
        await firstValueFrom(api.disconnect(id));
        patchState(store, {
          connections: store.connections().filter((c) => c.id !== id),
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false }
        });
        return true;
      } catch {
        patchState(store, {
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false },
          actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: CALENDAR_CONNECTIONS_DISCONNECT_ERROR }
        });
        return false;
      }
    },

    /** The backend runs the sync synchronously within the request, so a successful trigger reloads the list to pick up the new status/lastSyncedAt/lastError. */
    async triggerSync(id: string): Promise<boolean> {
      patchState(store, {
        actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: true },
        actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: '' }
      });
      try {
        await firstValueFrom(api.triggerSync(id));
        const response = await firstValueFrom(api.list());
        patchState(store, {
          connections: response.connections,
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false }
        });
        return true;
      } catch {
        patchState(store, {
          actionLoadingByConnectionId: { ...store.actionLoadingByConnectionId(), [id]: false },
          actionErrorByConnectionId: { ...store.actionErrorByConnectionId(), [id]: CALENDAR_CONNECTIONS_SYNC_ERROR }
        });
        return false;
      }
    }
  }))
);
