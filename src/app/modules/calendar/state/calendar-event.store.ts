import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { CalendarEventApiService } from '../data-access/calendar-event-api.service';
import {
  CalendarConflict, CalendarEventResponse, CreateCalendarEventRequest, EditRecurringOccurrenceRequest,
  EligibleNominee, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../models/calendar-event.model';

interface CalendarEventState {
  readonly events: readonly CalendarEventResponse[];
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
  readonly conflicts: readonly CalendarConflict[];
  readonly checkingConflicts: boolean;
  readonly myTimezone: string;
  readonly eligibleNominees: readonly EligibleNominee[];
}

export const CalendarEventStore = signalStore(
  { providedIn: 'root' },
  withState<CalendarEventState>({
    events: [], loading: false, loadError: null, saving: false, actionError: null,
    conflicts: [], checkingConflicts: false, myTimezone: 'UTC', eligibleNominees: []
  }),
  withMethods((store, api = inject(CalendarEventApiService)) => ({
    async loadEvents(from: string, to: string): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { events: response.events, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load calendar events.') });
      }
    },
    async createEvent(payload: CreateCalendarEventRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        const created = await firstValueFrom(api.create(payload));
        patchState(store, { saving: false, events: [...store.events(), created] });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create event.') });
        return false;
      }
    },
    async updateEvent(id: string, payload: UpdateCalendarEventRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        const updated = await firstValueFrom(api.update(id, payload));
        patchState(store, { saving: false, events: store.events().map((e) => (e.id === id ? updated : e)) });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update event.') });
        return false;
      }
    },
    async deleteEvent(id: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.delete(id));
        patchState(store, { saving: false, events: store.events().filter((e) => e.id !== id) });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to delete event.') });
        return false;
      }
    },
    async editOccurrence(
      masterId: string, payload: EditRecurringOccurrenceRequest, from: string, to: string
    ): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.editOccurrence(masterId, payload));
        // A this-event/all-events edit can change which virtual occurrences exist (a detached
        // row swaps in for one virtual date) - re-fetching the range is the simplest correct way
        // to reconcile state rather than patching the returned single item into the flat list.
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update this occurrence.') });
        return false;
      }
    },
    async cancelOccurrence(masterId: string, originalStart: string, from: string, to: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.cancelOccurrence(masterId, originalStart));
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to cancel this occurrence.') });
        return false;
      }
    },
    async respondToEvent(
      eventId: string, responseStatus: RespondToCalendarEventStatus, from: string, to: string,
      reason: string | null = null, nomineeEmployeeId: string | null = null
    ): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.respond(eventId, responseStatus, reason, nomineeEmployeeId));
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to respond to this event.') });
        return false;
      }
    },
    async loadEligibleNominees(eventId: string): Promise<void> {
      try {
        const response = await firstValueFrom(api.getEligibleNominees(eventId));
        patchState(store, { eligibleNominees: response.nominees });
      } catch {
        // Informational only, same as checkConflicts - a failed fetch just leaves the
        // "Nominate replacement" option hidden rather than surfacing an actionError.
        patchState(store, { eligibleNominees: [] });
      }
    },
    clearEligibleNominees(): void {
      patchState(store, { eligibleNominees: [] });
    },
    async checkConflicts(participantEmployeeIds: readonly string[], startDate: string, endDate: string): Promise<void> {
      patchState(store, { checkingConflicts: true });
      try {
        const response = await firstValueFrom(api.checkConflicts({ participantEmployeeIds, startDate, endDate }));
        patchState(store, { checkingConflicts: false, conflicts: response.conflicts });
      } catch {
        // Conflict-checking is informational only - a failed check should never block or alarm
        // the user with an actionError; it just silently shows no warning.
        patchState(store, { checkingConflicts: false, conflicts: [] });
      }
    },
    clearConflicts(): void {
      patchState(store, { conflicts: [], checkingConflicts: false });
    },
    async loadMyTimezone(): Promise<void> {
      try {
        const response = await firstValueFrom(api.getMyTimezone());
        patchState(store, { myTimezone: response.timezone });
      } catch {
        // Falls back to the 'UTC' default already in state - a failed fetch should not block
        // the calendar from rendering, just leave times shown in UTC.
      }
    }
  }))
);
