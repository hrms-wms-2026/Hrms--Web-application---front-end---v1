import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { CalendarApiService } from '../data-access/calendar-api.service';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectCalendarStore } from './project-calendar.store';
import { CalendarEventTaskSummaryDto, ProjectCalendarDto } from '../models/dto/calendar.dto';

const payload: ProjectCalendarDto = {
  modules: [
    {
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
      description: 'Design work', allocatedHours: 8, startDate: '2026-01-10', endDate: '2026-01-12',
      isActive: true, isAchieved: false, canEdit: true,
      events: [{
        eventId: 'e1', eventName: 'Launch', eventColor: '#123456',
        eventStartDate: '2026-01-05', eventEndDate: '2026-01-20',
        membership: 'whole', tasksInEventCount: 2, taskTotalCount: 2
      }]
    },
    {
      objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Build',
      startDate: '2026-01-13', endDate: '2026-01-15', isActive: true, isAchieved: false,
      canEdit: false, events: []
    }
  ],
  bands: [
    { eventId: 'e1', name: 'Launch', color: '#123456', startDate: '2026-01-05', endDate: '2026-01-20', canEdit: true }
  ]
};

function configure(calendarApi: any, objectiveApi: any) {
  TestBed.configureTestingModule({ providers: [
    ProjectCalendarStore,
    { provide: CalendarApiService, useValue: calendarApi },
    { provide: ProjectApiService, useValue: objectiveApi }
  ]});
  return TestBed.inject(ProjectCalendarStore);
}

describe('ProjectCalendarStore', () => {
  it('loads modules and event bands', async () => {
    const store = configure(
      { getProjectCalendar: () => of(payload) },
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    await store.load('p1');

    expect(store.modules()).toHaveLength(2);
    expect(store.bands()).toHaveLength(1);
    expect(store.activeEvents()[0].eventId).toBe('e1');
    expect(store.editableModules().map((m) => m.objectiveId)).toEqual(['o1']);
    expect(store.events()[0]).toEqual(expect.objectContaining({ id: 'e1', color: '#123456', objectiveIds: ['o1'] }));
  });

  it('saveEventDates PATCHes the event window and reloads', async () => {
    const updateEvent = vi.fn(() => of({} as any));
    const getProjectCalendar = vi.fn(() => of(payload));
    const store = configure(
      { getProjectCalendar, updateEvent } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );
    await store.load('p1');

    await store.saveEventDates('e1', '2026-01-06', '2026-01-25');

    expect(updateEvent).toHaveBeenCalledWith('e1', { startDate: '2026-01-06', endDate: '2026-01-25' });
    expect(getProjectCalendar).toHaveBeenCalledTimes(2);
  });

  it('rolls back an optimistic module drag and records the approval message', async () => {
    const store = configure(
      { getProjectCalendar: () => of(payload) },
      { editObjective: () => of(new HttpResponse({ status: 202, body: { applied: false } })) }
    );
    await store.load('p1');

    const result = await store.saveDates({ objectiveId: 'o1', startDate: '2026-01-20', endDate: '2026-01-22' });

    expect(result).toEqual({ success: true, applied: false, pendingApproval: true });
    expect(store.modules()[0].startDate).toBe('2026-01-10');
    expect(store.pendingSet().has('o1')).toBe(true);
    expect(store.approvalMessages()['o1']).toContain('Design');
  });

  it('loadEventDetail fetches, stores, and returns the full event detail including real taskIds', async () => {
    const store = configure(
      { getProjectCalendar: () => of(payload), getEvent: () => of({
        id: 'e1', projectId: 'p1', name: 'R1', color: '#2563EB', status: 'active',
        startDate: '2026-10-01', endDate: '2026-10-31', description: 'desc', objectiveIds: ['o1'],
        taskIds: ['t1', 't2'], createdByName: 'Priya'
      }) } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    const result = await store.loadEventDetail('e1');

    expect(store.eventDetail()?.taskIds).toEqual(['t1', 't2']);
    expect(result?.taskIds).toEqual(['t1', 't2']);
  });

  it('loadEventDetail returns null on failure, even if a previous successful fetch for the same id is still in state', async () => {
    const getEvent = vi.fn(() => of({
      id: 'e1', projectId: 'p1', name: 'R1', color: '#2563EB', status: 'active',
      startDate: '2026-10-01', endDate: '2026-10-31', objectiveIds: [], taskIds: ['t1']
    }));
    const store = configure(
      { getProjectCalendar: () => of(payload), getEvent } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );
    await store.loadEventDetail('e1'); // first, successful fetch
    getEvent.mockReturnValue(throwError(() => new Error('network error')));

    const result = await store.loadEventDetail('e1'); // refresh of the same id fails

    expect(result).toBeNull();
    expect(store.eventDetail()?.id).toBe('e1'); // stale detail stays displayed - caller must check the RETURN value, not re-read state, to know this fetch failed
  });

  it('loadEventTasks fetches and stores the milestone task list', async () => {
    const task: CalendarEventTaskSummaryDto = {
      id: 't1', shortId: 'T-1', title: 'Build thing', statusId: 's1', marksTaskComplete: false,
      statusCategory: 'active', progressPercent: 40, objectiveId: 'o1', objectiveTitle: 'Module A'
    };
    const store = configure(
      { getProjectCalendar: () => of(payload), getEventTasks: () => of([task]) } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    await store.loadEventTasks('e1');

    expect(store.eventTasks().length).toBe(1);
  });

  it('loadEventActivity fetches and stores the activity log', async () => {
    const store = configure(
      { getProjectCalendar: () => of(payload), getEventActivity: () => of([{
        id: 'a1', action: 'created', performedById: 'emp1', performedByName: 'Priya',
        performedAt: '2026-10-01T00:00:00Z', detailsJson: '{}'
      }]) } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    await store.loadEventActivity('e1');

    expect(store.eventActivity().length).toBe(1);
  });

  it('opening a second milestone before the first one\'s tasks resolve discards the stale response', async () => {
    const firstCall = new Subject<CalendarEventTaskSummaryDto[]>();
    const secondCall = new Subject<CalendarEventTaskSummaryDto[]>();
    const getEventTasks = vi.fn()
      .mockReturnValueOnce(firstCall.asObservable())
      .mockReturnValueOnce(secondCall.asObservable());
    const store = configure(
      { getProjectCalendar: () => of(payload), getEventTasks } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    const firstLoad = store.loadEventTasks('e1'); // starts, not yet resolved
    const secondLoad = store.loadEventTasks('e2'); // starts before e1 resolves
    secondCall.next([{ id: 't2', shortId: 'T-2', title: 'B', statusId: 's1', marksTaskComplete: false, statusCategory: 'active', progressPercent: 0, objectiveId: 'o2', objectiveTitle: 'M2' }]);
    secondCall.complete();
    await secondLoad;
    firstCall.next([{ id: 't1', shortId: 'T-1', title: 'A', statusId: 's1', marksTaskComplete: false, statusCategory: 'active', progressPercent: 0, objectiveId: 'o1', objectiveTitle: 'M1' }]); // arrives late
    firstCall.complete();
    await firstLoad;

    expect(store.eventTasks().map((t) => t.id)).toEqual(['t2']); // e1's late response never overwrote e2's
  });

  it('clearEventPanel resets detail, tasks and activity', () => {
    const store = configure(
      { getProjectCalendar: () => of(payload) } as any,
      { editObjective: () => of(new HttpResponse({ status: 200, body: payload.modules[0] })) }
    );

    store.clearEventPanel();

    expect(store.eventDetail()).toBeNull();
    expect(store.eventTasks()).toEqual([]);
    expect(store.eventActivity()).toEqual([]);
  });
});
