import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { NotificationSettingsApiService } from '../data-access/notification-settings-api.service';
import { NotificationSetting, UpdateNotificationSettingRequest } from '../models/notification-setting.model';

interface NotificationSettingsState {
  readonly settings: readonly NotificationSetting[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly savingKey: string | null;
  /** Per-event save/reset failure message. */
  readonly rowErrors: Readonly<Record<string, string>>;
  /** Per-event stale-revision conflicts; the row offers a reload instead of overwriting. */
  readonly conflicts: Readonly<Record<string, string>>;
}

const initialState: NotificationSettingsState = {
  settings: [],
  loading: false,
  error: null,
  savingKey: null,
  rowErrors: {},
  conflicts: {}
};

function problem(err: unknown, fallback: string): string {
  const body = err instanceof HttpErrorResponse ? (err.error as { detail?: string; title?: string } | null) : null;
  return body?.detail ?? body?.title ?? fallback;
}

function without(map: Readonly<Record<string, string>>, key: string): Record<string, string> {
  const { [key]: _removed, ...rest } = map;
  return rest;
}

export const NotificationSettingsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(NotificationSettingsApiService)) => {
    const replace = (updated: NotificationSetting) =>
      patchState(store, {
        settings: store.settings().map((s) => (s.eventKey === updated.eventKey ? updated : s)),
        savingKey: null,
        rowErrors: without(store.rowErrors(), updated.eventKey),
        conflicts: without(store.conflicts(), updated.eventKey)
      });

    const fail = (eventKey: string, err: unknown, fallback: string) => {
      const message = problem(err, fallback);
      patchState(store, err instanceof HttpErrorResponse && err.status === 409
        ? { savingKey: null, conflicts: { ...store.conflicts(), [eventKey]: message } }
        : { savingKey: null, rowErrors: { ...store.rowErrors(), [eventKey]: message } });
    };

    return {
      async load(): Promise<void> {
        patchState(store, { loading: true, error: null, rowErrors: {}, conflicts: {} });
        try {
          const settings = await firstValueFrom(api.list());
          patchState(store, { settings, loading: false });
        } catch {
          patchState(store, { loading: false, error: 'Could not load notification settings. Please try again.' });
        }
      },

      /** Resolves true when saved; on failure the caller keeps its unsaved edits. */
      async save(eventKey: string, request: UpdateNotificationSettingRequest): Promise<boolean> {
        patchState(store, { savingKey: eventKey });
        try {
          replace(await firstValueFrom(api.update(eventKey, request)));
          return true;
        } catch (err) {
          fail(eventKey, err, 'Could not save this notification setting.');
          return false;
        }
      },

      async reset(eventKey: string): Promise<boolean> {
        patchState(store, { savingKey: eventKey });
        try {
          replace(await firstValueFrom(api.reset(eventKey)));
          return true;
        } catch (err) {
          fail(eventKey, err, 'Could not reset this notification setting.');
          return false;
        }
      }
    };
  })
);
