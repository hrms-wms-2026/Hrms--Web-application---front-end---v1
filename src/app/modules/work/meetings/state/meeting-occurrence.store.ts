import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
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
  withMethods((store, api = inject(MeetingApiService)) => {
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

      /** After an edit: a splitting edit created a new series from here on - follow it (Review Focus 3). */
      afterEdit: (result: MeetingEditResponse) =>
        key ? fetch(result.split ? { seriesId: result.seriesId, originalStart: key.originalStart } : key) : Promise.resolve(),

      async respond(status: 'accepted' | 'rejected', reason: string | null): Promise<boolean> {
        if (!key) return false;
        const k = key;
        // Declining keeps access (D18): the drawer reloads and stays open with read access.
        const done = await write(() => firstValueFrom(api.respond(k.seriesId, { status, reason, originalStart: null })).then(() => true));
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
