import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { CalendarConnectionApiService } from '../../settings/data-access/calendar-connection-api.service';
import { CalendarEventApiService } from '../data-access/calendar-event-api.service';
import { meetingErrorMessage } from '../utils/meeting-error-message';
import {
  CalendarConflict, CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest,
  EditRecurringOccurrenceRequest, EligibleNominee, MeetingProvider, RespondToCalendarEventStatus,
  UpdateCalendarEventRequest
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
  readonly hasTeamsCapableConnection: boolean;
  readonly hasZoomCapableConnection: boolean;
  readonly meetingActionSaving: boolean;
  readonly participantActionSaving: boolean;
}

export const CalendarEventStore = signalStore(
  { providedIn: 'root' },
  withState<CalendarEventState>({
    events: [], loading: false, loadError: null, saving: false, actionError: null,
    conflicts: [], checkingConflicts: false, myTimezone: 'UTC', eligibleNominees: [],
    hasTeamsCapableConnection: false, hasZoomCapableConnection: false, meetingActionSaving: false,
    participantActionSaving: false
  }),
  withMethods((store, api = inject(CalendarEventApiService), connectionApi = inject(CalendarConnectionApiService)) => ({
    async loadEvents(from: string, to: string): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { events: response.events, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load calendar events.') });
      }
    },
    async createEvent(payload: CreateCalendarEventRequest): Promise<CalendarEventResponse | null> {
      patchState(store, { saving: true, actionError: null });
      try {
        const created = await firstValueFrom(api.create(payload));
        patchState(store, { saving: false, events: [...store.events(), created] });
        return created;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create event.') });
        return null;
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
    },
    /** Whether the organizer has an active Microsoft/Zoom connection to host a meeting on -
     * gates the "Add Teams meeting"/"Add Zoom meeting" controls in the event form. A failed
     * fetch leaves both false (same "fail closed, no alarming error" precedent as
     * loadMyTimezone/checkConflicts above). */
    async loadMeetingConnectionStatus(): Promise<void> {
      try {
        const response = await firstValueFrom(connectionApi.list());
        const hasTeams = response.connections.some((c) => c.provider === 'outlook_calendar' && c.status === 'active');
        const hasZoom = response.connections.some((c) => c.provider === 'zoom' && c.status === 'active');
        patchState(store, { hasTeamsCapableConnection: hasTeams, hasZoomCapableConnection: hasZoom });
      } catch {
        patchState(store, { hasTeamsCapableConnection: false, hasZoomCapableConnection: false });
      }
    },
    async createMeeting(eventId: string, provider: MeetingProvider): Promise<boolean> {
      patchState(store, { meetingActionSaving: true, actionError: null });
      try {
        const response = await firstValueFrom(api.createMeeting(eventId, provider));
        patchState(store, {
          meetingActionSaving: false,
          events: store.events().map((e) => (e.id === eventId ? { ...e, meetingLink: response.joinUrl } : e))
        });
        return true;
      } catch (err) {
        patchState(store, { meetingActionSaving: false, actionError: meetingErrorMessage(err, provider) });
        return false;
      }
    },
    async removeMeeting(eventId: string): Promise<boolean> {
      patchState(store, { meetingActionSaving: true, actionError: null });
      try {
        await firstValueFrom(api.removeMeeting(eventId));
        patchState(store, {
          meetingActionSaving: false,
          events: store.events().map((e) => (e.id === eventId ? { ...e, meetingLink: null } : e))
        });
        return true;
      } catch (err) {
        patchState(store, { meetingActionSaving: false, actionError: toSafeErrorMessage(err, 'Failed to remove the meeting.') });
        return false;
      }
    },
    async addParticipants(eventId: string, employeeIds: readonly string[]): Promise<boolean> {
      patchState(store, { participantActionSaving: true, actionError: null });
      try {
        const response = await firstValueFrom(api.addParticipants(eventId, employeeIds));
        patchState(store, {
          participantActionSaving: false,
          events: store.events().map((e) => (e.id === eventId ? { ...e, participants: response.participants } : e))
        });
        return true;
      } catch (err) {
        patchState(store, { participantActionSaving: false, actionError: toSafeErrorMessage(err, 'Failed to add participants.') });
        return false;
      }
    },
    async removeParticipant(eventId: string, employeeId: string): Promise<boolean> {
      patchState(store, { participantActionSaving: true, actionError: null });
      try {
        await firstValueFrom(api.removeParticipant(eventId, employeeId));
        patchState(store, {
          participantActionSaving: false,
          events: store.events().map((e) => (e.id === eventId
            ? { ...e, participants: (e.participants ?? []).filter((p: CalendarEventParticipant) => p.employeeId !== employeeId) }
            : e))
        });
        return true;
      } catch (err) {
        patchState(store, { participantActionSaving: false, actionError: toSafeErrorMessage(err, 'Failed to remove the participant.') });
        return false;
      }
    },
    async addGuests(eventId: string, emails: readonly string[]): Promise<boolean> {
      patchState(store, { participantActionSaving: true, actionError: null });
      try {
        const response = await firstValueFrom(api.addGuests(eventId, emails));
        patchState(store, {
          participantActionSaving: false,
          events: store.events().map((e) => (e.id === eventId ? { ...e, guests: response.guests } : e))
        });
        return true;
      } catch (err) {
        patchState(store, { participantActionSaving: false, actionError: toSafeErrorMessage(err, 'Failed to invite guests.') });
        return false;
      }
    },
    async removeGuest(eventId: string, email: string): Promise<boolean> {
      patchState(store, { participantActionSaving: true, actionError: null });
      try {
        await firstValueFrom(api.removeGuest(eventId, email));
        patchState(store, {
          participantActionSaving: false,
          events: store.events().map((e) => (e.id === eventId
            ? { ...e, guests: (e.guests ?? []).filter((g) => g.email !== email) }
            : e))
        });
        return true;
      } catch (err) {
        patchState(store, { participantActionSaving: false, actionError: toSafeErrorMessage(err, 'Failed to remove the guest.') });
        return false;
      }
    }
  }))
);
