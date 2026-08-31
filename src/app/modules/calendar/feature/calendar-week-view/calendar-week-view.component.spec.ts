import { TestBed } from '@angular/core/testing';
import { CalendarWeekViewComponent } from './calendar-week-view.component';

describe('CalendarWeekViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarWeekViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarWeekViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarWeekViewComponent);
    fixture.componentRef.setInput('weekStart', '2026-08-31'); // a Monday
    fixture.detectChanges();
  });

  it('passes 7 consecutive days starting at weekStart to the hour grid', () => {
    const grid = fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid');
    const days: readonly string[] = grid.componentInstance.days();
    expect(days).toEqual(['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
  });
});
