import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveCalendarDayResponse } from '../../models/leave-calendar.model';
import { LeaveCalendarDayDetailComponent } from './leave-calendar-day-detail.component';

describe('LeaveCalendarDayDetailComponent', () => {
  let fixture: ComponentFixture<LeaveCalendarDayDetailComponent>;

  const day: LeaveCalendarDayResponse = {
    date: '2026-09-10', dayOfWeek: 'Thursday',
    absences: [
      { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', departmentId: null, departmentName: 'Engineering', legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', leaveTypeCategory: 'annual', typeColorHex: null, status: 'approved', isTentative: false, isPartialCancellationHistory: false, startDate: '2026-09-10', endDate: '2026-09-12', totalDays: 3, halfDayPeriod: null }
    ],
    holidays: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveCalendarDayDetailComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveCalendarDayDetailComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('day', day);
  });

  it('lists everyone on leave that day with department and type', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Anu Raman');
    expect(text).toContain('Engineering');
    expect(text).toContain('Annual Leave');
  });

  it('shows a tentative badge when the absence is tentative', () => {
    fixture.componentRef.setInput('day', { ...day, absences: [{ ...day.absences[0], isTentative: true }] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Tentative');
  });
});
