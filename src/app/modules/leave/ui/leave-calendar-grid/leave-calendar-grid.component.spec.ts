import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveCalendarDayResponse } from '../../models/leave-calendar.model';
import { LeaveCalendarGridComponent } from './leave-calendar-grid.component';

describe('LeaveCalendarGridComponent', () => {
  let fixture: ComponentFixture<LeaveCalendarGridComponent>;

  const days: LeaveCalendarDayResponse[] = [
    {
      date: '2026-09-10', dayOfWeek: 'Thursday',
      absences: [
        { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', leaveTypeCategory: 'annual', typeColorHex: null, status: 'approved', isTentative: false, isPartialCancellationHistory: false, startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z', totalHours: 3 }
      ],
      holidays: []
    },
    { date: '2026-09-11', dayOfWeek: 'Friday', absences: [], holidays: [{ date: '2026-09-11', name: 'Founders Day', legalEntityId: null, legalEntityName: null, source: 'config' }] }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveCalendarGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveCalendarGridComponent);
    fixture.componentRef.setInput('days', days);
  });

  it('renders one cell per day', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-day"]').length).toBe(2);
  });

  it('shows the employee count for a day with absences', () => {
    fixture.detectChanges();
    const cells = fixture.nativeElement.querySelectorAll('[data-testid="calendar-day"]');
    expect(cells[0].textContent).toContain('1');
  });

  it('shows the holiday name on a holiday day', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Founders Day');
  });

  it('emits dayClicked with the date when a day cell is clicked', () => {
    fixture.detectChanges();
    const emitted: string[] = [];
    fixture.componentInstance.dayClicked.subscribe((d: string) => emitted.push(d));
    fixture.nativeElement.querySelectorAll('[data-testid="calendar-day"]')[0].click();
    expect(emitted).toEqual(['2026-09-10']);
  });

  it('resolves a colour from typeColorHex when present, falling back by category otherwise', () => {
    expect(fixture.componentInstance.colorFor({ ...days[0].absences[0], typeColorHex: '#ff0000' })).toBe('#ff0000');
    expect(fixture.componentInstance.colorFor({ ...days[0].absences[0], typeColorHex: null, leaveTypeCategory: 'annual' })).toBe('#1e5eff');
    expect(fixture.componentInstance.colorFor({ ...days[0].absences[0], typeColorHex: null, leaveTypeCategory: 'sick' })).toBe('#c98a1f');
    expect(fixture.componentInstance.colorFor({ ...days[0].absences[0], typeColorHex: null, leaveTypeCategory: 'unpaid' })).toBe('#6b5b95');
  });
});
