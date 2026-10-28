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

  it('passes the planner layer through to the hour grid and its block events back out', () => {
    const blocks = new Map([['2026-09-01', []]]);
    fixture.componentRef.setInput('blocks', blocks);
    fixture.componentRef.setInput('editableDates', new Set(['2026-09-01']));
    fixture.detectChanges();
    const grid = fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid').componentInstance;
    const created: unknown[] = [];
    fixture.componentInstance.blockCreate.subscribe((e) => created.push(e));

    grid.blockCreate.emit({ taskId: 't1', date: '2026-09-01', startMinutes: 600, endMinutes: 660 });

    expect(grid.blocks()).toBe(blocks);
    expect(grid.editableDates().has('2026-09-01')).toBe(true);
    expect(created).toEqual([{ taskId: 't1', date: '2026-09-01', startMinutes: 600, endMinutes: 660 }]);
  });
});
