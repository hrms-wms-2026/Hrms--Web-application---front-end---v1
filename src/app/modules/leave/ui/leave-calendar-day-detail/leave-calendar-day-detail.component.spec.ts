import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveCalendarDayResponse } from '../../models/leave-calendar.model';
import { LeaveCalendarDayDetailComponent } from './leave-calendar-day-detail.component';

describe('LeaveCalendarDayDetailComponent', () => {
  let fixture: ComponentFixture<LeaveCalendarDayDetailComponent>;

  const day: LeaveCalendarDayResponse = {
    date: '2026-09-10', dayOfWeek: 'Thursday',
    absences: [
      { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', departmentId: null, departmentName: 'Engineering', legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', leaveTypeCategory: 'annual', typeColorHex: null, status: 'approved', isTentative: false, isPartialCancellationHistory: false, startAt: '2026-09-09T14:00:00.000Z', endAt: '2026-09-09T18:00:00.000Z', totalHours: 4 }
    ],
    holidays: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveCalendarDayDetailComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveCalendarDayDetailComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('day', day);
  });

  it('lists everyone on leave that day with department, type, range, and hours', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Anu Raman');
    expect(text).toContain('Engineering');
    expect(text).toContain('Annual Leave');
    expect(text).toContain('9 Sep 14:00 → 9 Sep 18:00');
    expect(text).toContain('4h');
  });

  it('shows a tentative badge when the absence is tentative', () => {
    fixture.componentRef.setInput('day', { ...day, absences: [{ ...day.absences[0], isTentative: true }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tentative');
  });
});
