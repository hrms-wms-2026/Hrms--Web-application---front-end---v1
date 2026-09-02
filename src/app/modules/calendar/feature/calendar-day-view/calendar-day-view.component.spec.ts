import { TestBed } from '@angular/core/testing';
import { CalendarDayViewComponent } from './calendar-day-view.component';

describe('CalendarDayViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarDayViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarDayViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarDayViewComponent);
    fixture.componentRef.setInput('date', '2026-09-01');
    fixture.detectChanges();
  });

  it('passes exactly the one input date to the hour grid', () => {
    const grid = fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid');
    expect(grid.componentInstance.days()).toEqual(['2026-09-01']);
  });
});
