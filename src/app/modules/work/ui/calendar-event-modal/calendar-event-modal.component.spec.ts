import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarEventModalComponent } from './calendar-event-modal.component';
import { ProjectCalendarItemDto } from '../../models/dto/calendar.dto';

const items: ProjectCalendarItemDto[] = [
  {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, title: 'Design', startDate: '2026-01-01', endDate: '2026-01-02',
    isActive: true, isAchieved: false, canEdit: false, calendarEventId: null, calendarEventColor: null
  },
  {
    objectiveId: 'o2', projectId: 'p1', parentObjectiveId: 'o1', title: 'Build', startDate: '2026-01-03', endDate: '2026-01-04',
    isActive: true, isAchieved: false, canEdit: true, calendarEventId: null, calendarEventColor: null
  }
];

describe('CalendarEventModalComponent', () => {
  let fixture: ComponentFixture<CalendarEventModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CalendarEventModalComponent] });
    fixture = TestBed.createComponent(CalendarEventModalComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  });

  it('allows grouping any visible objective, including one that is not editable', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
    (checkboxes[0] as HTMLInputElement).click();
    (checkboxes[1] as HTMLInputElement).click();
    fixture.componentInstance.name.set('Release');
    fixture.componentInstance.color.set('#ABCDEF');
    let payload: unknown;
    fixture.componentInstance.save.subscribe((value) => payload = value);

    fixture.componentInstance.submit();

    expect(payload).toEqual({ name: 'Release', color: '#ABCDEF', objectiveIds: ['o1', 'o2'] });
  });

  it('rejects an empty name, invalid color, or empty selection', () => {
    let emitted = false;
    fixture.componentInstance.save.subscribe(() => emitted = true);
    fixture.componentInstance.submit();
    expect(emitted).toBe(false);
    expect(fixture.componentInstance.error()).toContain('valid #RRGGBB');
  });
});
