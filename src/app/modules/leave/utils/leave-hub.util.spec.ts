import { LeaveRequestListItemResponse } from '../models/leave-request.model';
import {
  approvalProgressLabel,
  displayNameFromEmail,
  restQuoteFor,
  leaveDateRangeLabel,
  leaveDurationLabel,
  leaveTypeIcon,
  sortByLastActivity,
  workdayHours
} from './leave-hub.util';

function request(overrides: Partial<LeaveRequestListItemResponse>): LeaveRequestListItemResponse {
  return {
    id: 'r',
    employeeId: 'e',
    leaveTypeId: 't',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'AL',
    startAt: '2026-12-01T09:00:00Z',
    endAt: '2026-12-01T18:00:00Z',
    totalHours: 8,
    paidHours: 8,
    unpaidHours: 0,
    status: 'pending',
    noticePeriodMissed: false,
    approvedByName: null,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: null,
    ...overrides
  };
}

describe('sortByLastActivity', () => {
  it('puts the request decided most recently first, ahead of newer requests still waiting', () => {
    const december = request({ id: 'december', createdAt: '2026-08-01T10:00:00Z', updatedAt: '2026-09-20T10:00:00Z', status: 'approved' });
    const newer = [1, 2, 3, 4].map((n) => request({ id: `r${n}`, createdAt: `2026-09-0${n}T10:00:00Z` }));
    expect(sortByLastActivity([...newer, december]).map((r) => r.id)).toEqual(['december', 'r4', 'r3', 'r2', 'r1']);
  });

  it('lets a request sent after the decision go back on top', () => {
    const december = request({ id: 'december', updatedAt: '2026-09-20T10:00:00Z' });
    const latest = request({ id: 'latest', createdAt: '2026-09-21T10:00:00Z' });
    expect(sortByLastActivity([december, latest]).map((r) => r.id)).toEqual(['latest', 'december']);
  });
});

describe('approvalProgressLabel', () => {
  it('shows progress only on pending requests with more than one approver', () => {
    expect(approvalProgressLabel(request({ status: 'pending', approvedApproverCount: 1, approverCount: 2 }))).toBe('1 of 2 approved');
    expect(approvalProgressLabel(request({ status: 'pending', approvedApproverCount: 0, approverCount: 3 }))).toBe('0 of 3 approved');
    expect(approvalProgressLabel(request({ status: 'pending', approvedApproverCount: 0, approverCount: 1 }))).toBeNull();
    expect(approvalProgressLabel(request({ status: 'approved', approvedApproverCount: 2, approverCount: 2 }))).toBeNull();
    expect(approvalProgressLabel(request({ status: 'pending' }))).toBeNull();
  });
});


describe('leaveDurationLabel', () => {
  it('counts calendar days, and hours for part of one work day', () => {
    expect(leaveDurationLabel('2026-11-12T09:00:00', '2026-11-13T18:00:00', 16, 8)).toBe('2 days');
    expect(leaveDurationLabel('2026-11-12T09:00:00', '2026-11-12T18:00:00', 8, 8)).toBe('1 day');
    expect(leaveDurationLabel('2026-11-12T09:00:00', '2026-11-12T13:00:00', 4, 8)).toBe('4.00 h');
    expect(leaveDurationLabel('2026-11-12T09:00:00', '2026-11-12T13:00:00', 4, null)).toBe('1 day');
  });
});

describe('leaveDateRangeLabel', () => {
  it('shows one date for a single day and a range otherwise', () => {
    expect(leaveDateRangeLabel('2026-10-07T09:00:00', '2026-10-07T18:00:00')).toBe('Oct 07, 2026');
    expect(leaveDateRangeLabel('2026-10-07T09:00:00', '2026-10-09T18:00:00')).toBe('Oct 07, 2026 – Oct 09, 2026');
  });
});

describe('workdayHours', () => {
  it('is the work window less the break', () => {
    expect(workdayHours('09:00', '18:00', 60)).toBe(8);
    expect(workdayHours('22:00', '06:00', null)).toBe(8);
    expect(workdayHours(null, '18:00', null)).toBeNull();
  });
});

describe('leaveTypeIcon', () => {
  it('guesses a picture from the leave type name', () => {
    expect(leaveTypeIcon('Annual Leave')).toBe('palm');
    expect(leaveTypeIcon('Casual Leave')).toBe('sun');
    expect(leaveTypeIcon('Sick Leave')).toBe('heart');
    expect(leaveTypeIcon('Maternity Leave')).toBe('baby');
    expect(leaveTypeIcon('Paternity Leave')).toBe('family');
    expect(leaveTypeIcon('Compassionate Leave')).toBe('person');
    expect(leaveTypeIcon('Study Leave')).toBe('calendar');
  });
});

describe('restQuoteFor / displayNameFromEmail', () => {
  it('has a different rest note for each part of the day', () => {
    const notes = (['morning', 'afternoon', 'evening', 'night'] as const).map(restQuoteFor);
    expect(notes[1]).toBe('Rest today for a stronger tomorrow.');
    expect(new Set(notes).size).toBe(4);
  });

  it('names the user from the email like the profile menu', () => {
    expect(displayNameFromEmail('anu.raman@dapi.com')).toBe('Anu Raman');
    expect(displayNameFromEmail(null)).toBeNull();
  });
});
