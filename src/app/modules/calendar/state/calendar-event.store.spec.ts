import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarEventResponse } from '../models/calendar-event.model';
import { CalendarEventStore } from './calendar-event.store';

function makeEvent(overrides: Partial<CalendarEventResponse> = {}): CalendarEventResponse {
  return {
    id: 'e1', title: 'Standup', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null,
    hasConflict: false, ...overrides
  };
}

describe('CalendarEventStore', () => {
  let store: InstanceType<typeof CalendarEventStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CalendarEventStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(CalendarEventStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads events into state', async () => {
    const work = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent()] });
    await work;
    expect(store.events().map((e) => e.id)).toEqual(['e1']);
    expect(store.loadError()).toBeNull();
  });

  it('sets loadError on a failed load', async () => {
    const work = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ detail: 'boom' }, { status: 500, statusText: 'Error' });
    await work;
    expect(store.loadError()).toBeTruthy();
  });

  it('createEvent appends the created event on success and returns it', async () => {
    const work = store.createEvent({
      title: 'New', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    });
    http.expectOne(`${environment.apiUrl}/calendar`).flush(makeEvent({ id: 'e2', title: 'New' }));
    const created = await work;
    expect(created?.id).toBe('e2');
    expect(store.events().map((e) => e.id)).toContain('e2');
  });

  it('createEvent returns null on failure', async () => {
    const work = store.createEvent({
      title: 'New', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    });
    http.expectOne(`${environment.apiUrl}/calendar`).flush({ detail: 'boom' }, { status: 500, statusText: 'Error' });
    expect(await work).toBeNull();
  });

  it('deleteEvent removes the event from state on success', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e3' })] });
    await load;

    const work = store.deleteEvent('e3');
    http.expectOne(`${environment.apiUrl}/calendar/e3`).flush(null);
    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).not.toContain('e3');
  });

  it('editOccurrence refreshes events after a successful edit', async () => {
    const work = store.editOccurrence('master-1', {
      originalStart: '2026-09-08T09:00:00Z', scope: 'ThisEventOnly', title: 'X', description: null,
      startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z', isAllDay: false,
      location: null, meetingLink: null, color: null
    }, '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');

    http.expectOne(`${environment.apiUrl}/calendar/master-1/occurrence`).flush(makeEvent());
    // Let the microtask/macrotask queue drain so the store's await resumes and issues the
    // follow-up GET before we try to match it - flushing the PUT response doesn't synchronously
    // continue the awaiting async function.
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'refreshed' })] });

    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toEqual(['refreshed']);
  });

  it('respondToEvent posts the response then refreshes events', async () => {
    const work = store.respondToEvent('event-1', 'Accepted', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/event-1/respond` && r.method === 'POST').flush(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'refreshed' })] });

    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toEqual(['refreshed']);
  });

  it('respondToEvent sets actionError on failure', async () => {
    const work = store.respondToEvent('event-1', 'Accepted', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/event-1/respond`).flush({ detail: 'not a participant' }, { status: 404, statusText: 'Not Found' });
    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('checkConflicts populates conflicts on success', async () => {
    const work = store.checkConflicts(['emp-1'], '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z');
    http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`).flush({
      conflicts: [{
        employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: 'e9', conflictingEventTitle: 'Standup',
        overlapStart: '2026-09-01T09:00:00Z', overlapEnd: '2026-09-01T10:00:00Z'
      }]
    });
    await work;
    expect(store.conflicts().length).toBe(1);
    expect(store.checkingConflicts()).toBe(false);
  });

  it('checkConflicts clears conflicts on failure rather than surfacing actionError', async () => {
    const work = store.checkConflicts(['emp-1'], '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z');
    http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`).flush({ detail: 'boom' }, { status: 500, statusText: 'Error' });
    await work;
    expect(store.conflicts()).toEqual([]);
    expect(store.actionError()).toBeNull();
  });

  it('loadMyTimezone populates myTimezone from the API', async () => {
    const work = store.loadMyTimezone();
    http.expectOne(`${environment.apiUrl}/calendar/my-timezone`).flush({ timezone: 'Asia/Colombo' });
    await work;
    expect(store.myTimezone()).toBe('Asia/Colombo');
  });

  it('clearConflicts resets conflicts state', () => {
    store.clearConflicts();
    expect(store.conflicts()).toEqual([]);
    expect(store.checkingConflicts()).toBe(false);
  });

  it('loadMeetingConnectionStatus sets hasTeamsCapableConnection when an active outlook_calendar connection exists', async () => {
    const work = store.loadMeetingConnectionStatus();
    http.expectOne(`${environment.apiUrl}/calendar/connections`).flush({
      connections: [
        { id: 'c1', provider: 'outlook_calendar', externalAccountEmail: 'me@acme.com', externalCalendarName: null, syncDirection: 'two_way', status: 'active', lastSyncedAt: null, lastError: null }
      ]
    });
    await work;
    expect(store.hasTeamsCapableConnection()).toBe(true);
    expect(store.hasZoomCapableConnection()).toBe(false);
  });

  it('loadMeetingConnectionStatus sets hasZoomCapableConnection from an active zoom connection', async () => {
    const work = store.loadMeetingConnectionStatus();
    http.expectOne(`${environment.apiUrl}/calendar/connections`).flush({
      connections: [
        { id: 'c1', provider: 'zoom', externalAccountEmail: 'me@acme.com', externalCalendarName: null, syncDirection: 'two_way', status: 'active', lastSyncedAt: null, lastError: null }
      ]
    });
    await work;
    expect(store.hasZoomCapableConnection()).toBe(true);
    expect(store.hasTeamsCapableConnection()).toBe(false);
  });

  it('loadMeetingConnectionStatus sets both false when no connection is active', async () => {
    const work = store.loadMeetingConnectionStatus();
    http.expectOne(`${environment.apiUrl}/calendar/connections`).flush({ connections: [] });
    await work;
    expect(store.hasTeamsCapableConnection()).toBe(false);
    expect(store.hasZoomCapableConnection()).toBe(false);
  });

  it('createMeeting sets the returned joinUrl on the matching event', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e5' })] });
    await load;

    const work = store.createMeeting('e5', 'microsoft_teams');
    http.expectOne(`${environment.apiUrl}/calendar/e5/meeting`).flush({ joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' });
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e5')?.meetingLink).toBe('https://teams.microsoft.com/l/meetup-join/abc');
  });

  it('createMeeting passes "invites held back" through for a meeting added to a just-created event', async () => {
    const work = store.createMeeting('e9', 'microsoft_teams', true);
    const req = http.expectOne(`${environment.apiUrl}/calendar/e9/meeting`);
    expect(req.request.body).toEqual({ provider: 'microsoft_teams', invitesHeldBack: true });
    req.flush({ joinUrl: 'https://teams/x' });
    expect(await work).toBe(true);
  });

  it('createMeeting passes the provider through to the API and updates the event link', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e1' })] });
    await load;

    const work = store.createMeeting('e1', 'zoom');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/e1/meeting` && (r.body as { provider: string })?.provider === 'zoom')
      .flush({ joinUrl: 'https://us05web.zoom.us/j/123' });
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e1')?.meetingLink).toBe('https://us05web.zoom.us/j/123');
  });

  it('createMeeting sets actionError on failure', async () => {
    const work = store.createMeeting('e6', 'microsoft_teams');
    http.expectOne(`${environment.apiUrl}/calendar/e6/meeting`).flush({ detail: 'meeting_provider_not_connected' }, { status: 409, statusText: 'Conflict' });
    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('removeMeeting clears meetingLink on the matching event', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e7', meetingLink: 'https://teams.microsoft.com/l/meetup-join/abc' })] });
    await load;

    const work = store.removeMeeting('e7');
    http.expectOne(`${environment.apiUrl}/calendar/e7/meeting`).flush(null);
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e7')?.meetingLink).toBeNull();
  });

  it('addParticipants replaces the event participants with the server-returned list', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e8' })] });
    await load;

    const work = store.addParticipants('e8', ['emp-1']);
    http.expectOne(`${environment.apiUrl}/calendar/e8/participants`).flush({
      participants: [{ employeeId: 'emp-1', employeeName: 'Kiru B', responseStatus: 'pending' }]
    });
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e8')?.participants).toEqual([
      { employeeId: 'emp-1', employeeName: 'Kiru B', responseStatus: 'pending' }
    ]);
  });

  it('addParticipants sets actionError on failure', async () => {
    const work = store.addParticipants('e9', ['emp-1']);
    http.expectOne(`${environment.apiUrl}/calendar/e9/participants`).flush({ detail: 'boom' }, { status: 403, statusText: 'Forbidden' });
    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('addGuests replaces the event guests with the server-returned list', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e11' })] });
    await load;

    const work = store.addGuests('e11', ['vendor@example.com']);
    http.expectOne(`${environment.apiUrl}/calendar/e11/guests`).flush({ guests: [{ email: 'vendor@example.com' }] });

    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e11')?.guests).toEqual([{ email: 'vendor@example.com' }]);
  });

  it('addGuests sets actionError and returns false on failure', async () => {
    const work = store.addGuests('e12', ['vendor@example.com']);
    http.expectOne(`${environment.apiUrl}/calendar/e12/guests`).flush({ detail: 'boom' }, { status: 400, statusText: 'Bad Request' });

    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('removeGuest filters the removed email out of the event guests', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({
      events: [makeEvent({ id: 'e13', guests: [{ email: 'a@x.co' }, { email: 'b@x.co' }] })]
    });
    await load;

    const work = store.removeGuest('e13', 'a@x.co');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/e13/guests`).flush(null);

    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e13')?.guests).toEqual([{ email: 'b@x.co' }]);
  });

  it('removeParticipant filters the removed employee out of the event participants', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({
      events: [makeEvent({
        id: 'e10',
        participants: [
          { employeeId: 'emp-1', employeeName: 'Kiru B', responseStatus: 'pending' },
          { employeeId: 'emp-2', employeeName: 'Saif A', responseStatus: 'accepted' }
        ]
      })]
    });
    await load;

    const work = store.removeParticipant('e10', 'emp-1');
    http.expectOne(`${environment.apiUrl}/calendar/e10/participants/emp-1`).flush(null);
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e10')?.participants).toEqual([
      { employeeId: 'emp-2', employeeName: 'Saif A', responseStatus: 'accepted' }
    ]);
  });
});
