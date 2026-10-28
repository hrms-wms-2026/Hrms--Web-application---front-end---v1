import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { CalendarPageComponent } from './calendar-page.component';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { CalendarEventFormSubmission } from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';
import { CalendarEventResponse, CreateCalendarEventRequest } from '../../models/calendar-event.model';

function createRequest(): CreateCalendarEventRequest {
  return {
    title: 'Sync', description: null, startDate: '2026-10-02T09:00:00Z', endDate: '2026-10-02T09:30:00Z',
    isAllDay: false, location: null, meetingLink: null, color: null, recurrence: 'none',
    participantEmployeeIds: [], recurrenceRule: null
  };
}

function createdEvent(): CalendarEventResponse {
  return { id: 'evt-1', title: 'Sync' } as CalendarEventResponse;
}

function buildFakeStore() {
  return {
    events: signal<readonly CalendarEventResponse[]>([]),
    saving: signal(false),
    conflicts: signal([]),
    checkingConflicts: signal(false),
    eligibleNominees: signal([]),
    hasTeamsCapableConnection: signal(true),
    hasZoomCapableConnection: signal(true),
    meetingActionSaving: signal(false),
    myTimezone: signal('UTC'),
    loadError: signal<string | null>(null),
    actionError: signal<string | null>(null),
    loadEvents: vi.fn(),
    loadMyTimezone: vi.fn(),
    loadMeetingConnectionStatus: vi.fn(),
    clearConflicts: vi.fn(),
    clearEligibleNominees: vi.fn(),
    createEvent: vi.fn(),
    createMeeting: vi.fn(),
    updateEvent: vi.fn()
  };
}

describe('CalendarPageComponent - create submission', () => {
  let store: ReturnType<typeof buildFakeStore>;

  function setup(): CalendarPageComponent {
    store = buildFakeStore();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CalendarEventStore, useValue: store }
      ]
    });
    const fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('creates the event once when Create is triggered again while the meeting is still being created', async () => {
    const page = setup();
    let releaseMeeting!: () => void;
    store.createEvent.mockResolvedValue(createdEvent());
    store.createMeeting.mockImplementation(() => new Promise<boolean>((resolve) => { releaseMeeting = () => resolve(true); }));
    const submission: CalendarEventFormSubmission = { create: createRequest(), meetingProvider: 'microsoft_teams' };

    const first = page.onSave(submission);
    await Promise.resolve();
    await Promise.resolve();
    const second = page.onSave(submission);
    releaseMeeting();
    await Promise.all([first, second]);

    expect(store.createEvent).toHaveBeenCalledTimes(1);
    expect(store.createMeeting).toHaveBeenCalledTimes(1);
    expect(store.createMeeting).toHaveBeenCalledWith(createdEvent().id, 'microsoft_teams', true);
  });

  it('a meeting created right after its event says the invites were held back for the link', async () => {
    const page = setup();
    store.createEvent.mockResolvedValue(createdEvent());
    store.createMeeting.mockResolvedValue(true);

    await page.onSave({ create: createRequest(), meetingProvider: 'zoom' });

    expect(store.createMeeting).toHaveBeenCalledWith(createdEvent().id, 'zoom', true);
  });

  it('keeps the form busy for the whole create + meeting chain, not just the event POST', async () => {
    const page = setup();
    let releaseMeeting!: () => void;
    store.createEvent.mockResolvedValue(createdEvent());
    store.createMeeting.mockImplementation(() => new Promise<boolean>((resolve) => { releaseMeeting = () => resolve(true); }));

    const pending = page.onSave({ create: createRequest(), meetingProvider: 'zoom' });
    await Promise.resolve();
    await Promise.resolve();

    expect(page.submitting()).toBe(true);
    releaseMeeting();
    await pending;
    expect(page.submitting()).toBe(false);
  });

  it('reloads the events after a create so the new event carries its participants and organizer', async () => {
    const page = setup();
    store.loadEvents.mockClear();
    const order: string[] = [];
    store.createEvent.mockImplementation(async () => { order.push('create'); return createdEvent(); });
    store.createMeeting.mockImplementation(async () => { order.push('meeting'); return true; });
    store.loadEvents.mockImplementation(async () => { order.push('reload'); });

    await page.onSave({ create: createRequest(), meetingProvider: 'zoom' });

    expect(order).toEqual(['create', 'meeting', 'reload']);
    expect(store.loadEvents).toHaveBeenCalledWith(expect.stringContaining('T00:00:00Z'), expect.any(String));
  });

  it('does not reload after a failed create', async () => {
    const page = setup();
    store.loadEvents.mockClear();
    store.createEvent.mockResolvedValue(null);

    await page.onSave({ create: createRequest(), meetingProvider: null });

    expect(store.loadEvents).not.toHaveBeenCalled();
  });

  it('reloads the events after a plain update so participants are not lost from the edited event', async () => {
    const page = setup();
    page.editingEvent.set(createdEvent());
    store.loadEvents.mockClear();
    store.updateEvent.mockResolvedValue(true);

    await page.onSave({
      update: {
        title: 'Sync v2', description: null, startDate: '2026-10-02T09:00:00Z', endDate: '2026-10-02T09:30:00Z',
        isAllDay: false, location: null, meetingLink: null, color: null, recurrence: 'none'
      },
      scope: null
    });

    expect(store.updateEvent).toHaveBeenCalledTimes(1);
    expect(store.loadEvents).toHaveBeenCalledTimes(1);
  });

  it('accepts a new submission after a failed create', async () => {
    const page = setup();
    store.createEvent.mockResolvedValueOnce(null).mockResolvedValueOnce(createdEvent());
    store.createMeeting.mockResolvedValue(true);
    const submission: CalendarEventFormSubmission = { create: createRequest(), meetingProvider: null };

    await page.onSave(submission);
    expect(page.submitting()).toBe(false);
    await page.onSave(submission);

    expect(store.createEvent).toHaveBeenCalledTimes(2);
  });
});

describe('CalendarPageComponent - new meeting (work item)', () => {
  it('has no "Meeting (work item)" button: a meeting is made from the work item form, category "meeting"', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: CalendarEventStore, useValue: buildFakeStore() }]
    });
    const fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-new-meeting"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-meeting-form-modal')).toBeNull();
  });

  it('a new event with people hands over to the meeting form with its title and time', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: CalendarEventStore, useValue: buildFakeStore() }]
    });
    const fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.formOpen.set(true);

    page.onConvertToMeeting({ title: 'Design review', start: '2026-11-02T10:00', end: '2026-11-02T11:30' });
    fixture.detectChanges();

    expect(page.formOpen()).toBe(false);
    expect(page.meetingFormOpen()).toBe(true);
    const form = fixture.debugElement.query(By.css('app-meeting-form-modal'));
    expect(form.componentInstance.prefill()).toEqual({ title: 'Design review', start: '2026-11-02T10:00', end: '2026-11-02T11:30' });
  });
});

describe('CalendarPageComponent - task meetings', () => {
  // A virtual occurrence: not materialized yet, so it has no task id; `id` is the id it will get.
  const meetingItem = {
    id: 'future-task-id', title: 'Weekly delivery sync', startDate: '2026-11-09T03:30:00Z', endDate: '2026-11-09T04:00:00Z',
    itemKind: 'meeting', meetingSeriesId: 's1', meetingTaskId: null, meetingStatus: 'scheduled', originalStart: '2026-11-09T03:30:00Z'
  } as CalendarEventResponse;

  function setup() {
    const store = buildFakeStore();
    store.events.set([meetingItem]);
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: CalendarEventStore, useValue: store }]
    });
    const fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
    const week = fixture.debugElement.query(By.directive(CalendarWeekViewComponent));
    week.componentInstance.eventClick.emit('future-task-id');
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  it('opens a virtual occurrence by series and original start', () => {
    const { fixture, http } = setup();

    expect(fixture.nativeElement.querySelector('app-meeting-occurrence-drawer')).not.toBeNull();
    http.expectOne((r) => r.url.endsWith(`/meetings/series/s1/occurrences/${encodeURIComponent('2026-11-09T03:30:00.000Z')}`));
  });

  it('meeting items do not use legacy event actions', () => {
    const { fixture, http } = setup();

    expect(fixture.componentInstance.formOpen()).toBe(false);
    expect(fixture.componentInstance.editingEvent()).toBeNull();
    expect(http.match((r) => /\/calendar\/future-task-id/.test(r.url)).length).toBe(0);
  });
});
