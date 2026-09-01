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
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null, ...overrides
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
      isAllDay: false, timezone: 'UTC', location: null, meetingLink: null, color: null,
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
      timezone: 'UTC', location: null, meetingLink: null, color: null
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
});
