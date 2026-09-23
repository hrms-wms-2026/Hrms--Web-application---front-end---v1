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

  it('createEvent appends the created event on success', async () => {
    const work = store.createEvent({
      title: 'New', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    });
    http.expectOne(`${environment.apiUrl}/calendar`).flush(makeEvent({ id: 'e2', title: 'New' }));
    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toContain('e2');
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

  it('loadMeetingConnectionStatus sets true when an active outlook_calendar connection exists', async () => {
    const work = store.loadMeetingConnectionStatus();
    http.expectOne(`${environment.apiUrl}/calendar/connections`).flush({
      connections: [
        { id: 'c1', provider: 'outlook_calendar', externalAccountEmail: 'me@acme.com', externalCalendarName: null, syncDirection: 'two_way', status: 'active', lastSyncedAt: null, lastError: null }
      ]
    });
    await work;
    expect(store.hasMeetingCapableConnection()).toBe(true);
  });

  it('loadMeetingConnectionStatus sets false when no connection is active', async () => {
    const work = store.loadMeetingConnectionStatus();
    http.expectOne(`${environment.apiUrl}/calendar/connections`).flush({ connections: [] });
    await work;
    expect(store.hasMeetingCapableConnection()).toBe(false);
  });

  it('createMeeting sets the returned joinUrl on the matching event', async () => {
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e5' })] });
    await load;

    const work = store.createMeeting('e5');
    http.expectOne(`${environment.apiUrl}/calendar/e5/meeting`).flush({ joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' });
    expect(await work).toBe(true);
    expect(store.events().find((e) => e.id === 'e5')?.meetingLink).toBe('https://teams.microsoft.com/l/meetup-join/abc');
  });

  it('createMeeting sets actionError on failure', async () => {
    const work = store.createMeeting('e6');
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
});
