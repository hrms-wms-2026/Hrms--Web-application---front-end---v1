import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CalendarEventModalComponent } from './calendar-event-modal.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ProjectCalendarModuleDto } from '../../models/dto/calendar.dto';

const modules: ProjectCalendarModuleDto[] = [
  {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design',
    startDate: '2026-01-01', endDate: '2026-01-02', isActive: true, isAchieved: false, canEdit: false, events: []
  },
  {
    objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Build',
    startDate: '2026-01-03', endDate: '2026-01-04', isActive: true, isAchieved: false, canEdit: true, events: []
  }
];

describe('CalendarEventModalComponent', () => {
  let fixture: ComponentFixture<CalendarEventModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarEventModalComponent],
      providers: [
        { provide: TaskApiService, useValue: { getTasks: () => of([]), getBySprintId: () => of([]) } },
        { provide: SprintApiService, useValue: { getByProject: () => of([]) } }
      ]
    });
    fixture = TestBed.createComponent(CalendarEventModalComponent);
    fixture.componentRef.setInput('modules', modules);
    fixture.detectChanges();
  });

  it('requires a name, colour, start/end dates (end >= start) and at least one pick', () => {
    const c = fixture.componentInstance;
    c.name.set('Release');
    c.color.set('#ABCDEF');
    c.startDate.set('2026-03-31');
    c.endDate.set('2026-03-01');
    c.selectedObjectiveIds.set(new Set(['o1']));
    expect(c.valid()).toBe(false);

    c.endDate.set('2026-04-01');
    expect(c.valid()).toBe(true);
  });

  it('emits objectiveIds for whole-module ticks and taskIds for individual ticks', () => {
    const c = fixture.componentInstance;
    c.name.set('Release');
    c.color.set('#ABCDEF');
    c.startDate.set('2026-03-01');
    c.endDate.set('2026-03-31');
    c.selectedObjectiveIds.set(new Set(['o1']));
    c.selectedTaskIds.set(new Set(['t7', 't8']));

    let payload: any;
    c.save.subscribe((value) => (payload = value));
    c.submit();

    expect(payload).toEqual({
      name: 'Release', color: '#ABCDEF', startDate: '2026-03-01', endDate: '2026-03-31',
      objectiveIds: ['o1'], taskIds: ['t7', 't8'], description: ''
    });
  });

  it('locks a module’s task checkboxes once the whole module is ticked', () => {
    const c = fixture.componentInstance;
    c.toggleObjective('o1');
    expect(c.isTaskLocked('o1')).toBe(true);
  });

  it('rejects an empty form', () => {
    let emitted = false;
    fixture.componentInstance.save.subscribe(() => (emitted = true));
    fixture.componentInstance.submit();
    expect(emitted).toBe(false);
    expect(fixture.componentInstance.error()).toContain('at least one module or task');
  });

  it('keeps the task selection when switching between Tree and Sprint view', () => {
    const c = fixture.componentInstance;
    c.selectedTaskIds.set(new Set(['t1']));
    c.view.set('sprint');
    fixture.detectChanges();
    c.view.set('tree');
    fixture.detectChanges();
    expect([...c.selectedTaskIds()]).toEqual(['t1']);
  });

  it('shows the Sprint view list when switched', () => {
    fixture.nativeElement.querySelector('[data-testid="view-sprint"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sprint-task-picker')).not.toBeNull();
  });

  it('includes the typed description in the save payload', () => {
    const c = fixture.componentInstance;
    c.name.set('Release 1');
    c.color.set('#2563EB');
    c.startDate.set('2026-10-01');
    c.endDate.set('2026-10-31');
    c.selectedObjectiveIds.set(new Set(['o1']));
    fixture.detectChanges();
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('[data-testid="event-description"]');
    textarea.value = 'Covers the Q3 release scope.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    let saved: any;
    c.save.subscribe((payload: any) => (saved = payload));
    fixture.nativeElement.querySelector('[data-testid="event-save"]').click();

    expect(saved.description).toBe('Covers the Q3 release scope.');
  });

  it('pre-fills the description textarea when editing an existing event', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', projectId: 'p1', name: 'R1', color: '#2563EB', status: 'active',
      startDate: '2026-10-01', endDate: '2026-10-31', description: 'Existing text.', objectiveIds: [], taskIds: []
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="event-description"]').value).toBe('Existing text.');
  });
});
