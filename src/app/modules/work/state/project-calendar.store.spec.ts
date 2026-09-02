import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { CalendarApiService } from '../data-access/calendar-api.service';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectCalendarStore } from './project-calendar.store';
import { ProjectCalendarItemDto } from '../models/dto/calendar.dto';

const items: ProjectCalendarItemDto[] = [
  {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
    description: 'Design work', allocatedHours: 8, startDate: '2026-01-10', endDate: '2026-01-12',
    isActive: true, isAchieved: false, canEdit: true, calendarEventId: 'e1', calendarEventColor: '#123456'
  },
  {
    objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Build',
    startDate: '2026-01-13', endDate: '2026-01-15', isActive: true, isAchieved: false,
    canEdit: false, calendarEventId: null, calendarEventColor: null
  }
];

describe('ProjectCalendarStore', () => {
  it('loads objectives and derives active event colors', async () => {
    const calendarApi = { getProjectCalendar: () => of(items) };
    const objectiveApi = { editObjective: () => of(new HttpResponse({ status: 200, body: items[0] })) };
    TestBed.configureTestingModule({ providers: [
      ProjectCalendarStore,
      { provide: CalendarApiService, useValue: calendarApi },
      { provide: ProjectApiService, useValue: objectiveApi }
    ]});
    const store = TestBed.inject(ProjectCalendarStore);

    await store.load('p1');

    expect(store.items()).toHaveLength(2);
    expect(store.activeEvents()).toEqual([expect.objectContaining({ id: 'e1', color: '#123456', objectiveIds: ['o1'] })]);
    expect(store.editableItems().map((item) => item.objectiveId)).toEqual(['o1']);
  });

  it('rolls back an optimistic drag and records the module-specific approval message', async () => {
    const calendarApi = { getProjectCalendar: () => of(items) };
    const objectiveApi = { editObjective: () => of(new HttpResponse({ status: 202, body: { applied: false } })) };
    TestBed.configureTestingModule({ providers: [
      ProjectCalendarStore,
      { provide: CalendarApiService, useValue: calendarApi },
      { provide: ProjectApiService, useValue: objectiveApi }
    ]});
    const store = TestBed.inject(ProjectCalendarStore);
    await store.load('p1');

    const result = await store.saveDates({ objectiveId: 'o1', startDate: '2026-01-20', endDate: '2026-01-22' });

    expect(result).toEqual({ success: true, applied: false, pendingApproval: true });
    expect(store.items()[0].startDate).toBe('2026-01-10');
    expect(store.pendingSet().has('o1')).toBe(true);
    expect(store.approvalMessages()['o1']).toContain('Design');
  });
});
