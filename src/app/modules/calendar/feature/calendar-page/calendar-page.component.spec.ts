import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { CalendarPageComponent } from './calendar-page.component';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { CalendarEventResponse } from '../../models/calendar-event.model';

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
