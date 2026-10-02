import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { CalendarApiService } from '../data-access/calendar-api.service';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectCalendarStore } from './project-calendar.store';
import { ProjectCalendarDto } from '../models/dto/calendar.dto';

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
});
