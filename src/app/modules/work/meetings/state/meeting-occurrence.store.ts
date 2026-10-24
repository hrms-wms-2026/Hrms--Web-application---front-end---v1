import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { MeetingApiService } from '../data-access/meeting-api.service';
import { MeetingEditResponse, MeetingOccurrenceResponse, MeetingScope } from '../models/meeting.models';
import { meetingErrorMessage } from '../utils/meeting-error-messages';

/** How an occurrence is opened: by its key (works before it is materialized) or by its task id (board links). */
export type MeetingOccurrenceKey = { seriesId: string; originalStart: string } | { taskId: string };

interface MeetingOccurrenceState {
  occurrence: MeetingOccurrenceResponse | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
}

const initialState: MeetingOccurrenceState = { occurrence: null, loading: false, notFound: false, error: null };

function codeOf(e: unknown): string | undefined {
  return e instanceof HttpErrorResponse ? (e.error?.code as string | undefined) : undefined;
}

/** One open occurrence (the drawer's state). Every write reloads it by its key, so the view never goes stale. */
export const MeetingOccurrenceStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(MeetingApiService), auth = inject(AuthStore)) => {
    let key: { seriesId: string; originalStart: string } | null = null;

    async function fetch(next: MeetingOccurrenceKey): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const occurrence = await firstValueFrom('taskId' in next
          ? api.getOccurrence(next.taskId)
          : api.getOccurrenceAt(next.seriesId, next.originalStart));
        key = { seriesId: occurrence.seriesId, originalStart: occurrence.originalStart };
        patchState(store, { occurrence, notFound: false, loading: false });
      } catch (e) {
        const notFound = e instanceof HttpErrorResponse && e.status === 404;
        patchState(store, { loading: false, notFound, occurrence: notFound ? null : store.occurrence(), error: notFound ? null : meetingErrorMessage(codeOf(e)) });
      }
    }

    /** Runs a write; a failure is surfaced as the store's error (the caller toasts it) and nothing is reloaded. */
    async function write<T>(run: () => Promise<T>): Promise<T | null> {
      patchState(store, { error: null });
      try {
        return await run();
      } catch (e) {
        patchState(store, { error: meetingErrorMessage(codeOf(e)) });
        return null;
      }
    }

    return {
      load: (next: MeetingOccurrenceKey) => fetch(next),
      reload: () => (key ? fetch(key) : Promise.resolve()),

      /**
       * After an edit: a splitting edit created a new series from here on - follow it (Review Focus 3). The new series
       * keeps the edit's shift, so this occurrence now starts at the start that was sent; if the rule moved it elsewhere,
       * open the new series' next occurrence instead.
       */
      async afterEdit(result: MeetingEditResponse, sentStart: string | null): Promise<void> {
        if (!key) return;
        if (!result.split) return fetch(key);
        await fetch({ seriesId: result.seriesId, originalStart: sentStart ?? key.originalStart });
        if (!store.notFound()) return;
        try {
          const next = (await firstValueFrom(api.getSeries(result.seriesId))).upcomingOccurrences[0];
          if (next) await fetch({ seriesId: result.seriesId, originalStart: next.originalStart });
        } catch {
          // Stays on the not-available state.
        }
      },

      async respond(status: 'accepted' | 'rejected', reason: string | null): Promise<boolean> {
        if (!key) return false;
        const k = key;
        // Someone added to this occurrence only answers for it (spec 5.3); everyone else answers for the series.
        const me = auth.employeeId();
        const mine = store.occurrence()?.attendees.find((a) => a.employeeId !== null && a.employeeId === me);
        const originalStart = mine?.source === 'occurrence' ? k.originalStart : null;
        // Declining keeps access (D18): the drawer reloads and stays open with read access.
        const done = await write(() => firstValueFrom(api.respond(k.seriesId, { status, reason, originalStart })).then(() => true));
        if (done) await fetch(k);
        return done === true;
      },

      async cancel(scope: MeetingScope): Promise<boolean> {
        if (!key) return false;
        const k = key;
        const done = await write(() => firstValueFrom(api.cancel(k.seriesId, k.originalStart, scope)).then(() => true));
        if (done) await fetch(k);
        return done === true;
      },

      async move(scope: 'this' | 'following', projectId: string, objectiveId: string): Promise<'moved' | 'requested' | null> {
        if (!key) return null;
        const k = key;
        const result = await write(() => firstValueFrom(api.move(k.seriesId, k.originalStart, { scope, projectId, objectiveId })));
        if (!result) return null;
        if (result.outcome === 'moved') await fetch({ seriesId: result.seriesId, originalStart: k.originalStart });
        return result.outcome;
      },
    };
  })
);
