import { LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { MyRequestsFilter, filterMyRequests } from './my-leave-requests.component';

function request(id: string, overrides: Partial<LeaveRequestListItemResponse> = {}): LeaveRequestListItemResponse {
  return { id, employeeId: 'me', leaveTypeId: 'al', leaveTypeName: 'Annual Leave', leaveTypeCode: 'AL', startAt: '2026-10-07T09:00:00Z', endAt: '2026-10-09T18:00:00Z', totalHours: 24, paidHours: 24, unpaidHours: 0, status: 'approved', noticePeriodMissed: false, approvedByName: 'Priya Nair', createdAt: '2026-09-01T00:00:00Z', updatedAt: null, ...overrides };
}

const none: MyRequestsFilter = { status: '', leaveTypeId: '', fromDate: '', toDate: '', search: '' };

describe('filterMyRequests', () => {
  const rows = [
    request('a'),
    request('b', { status: 'pending', leaveTypeId: 'sl', leaveTypeName: 'Sick Leave', approvedByName: null, startAt: '2026-11-02T09:00:00Z', endAt: '2026-11-02T18:00:00Z' }),
    request('c', { status: 'rejected', startAt: '2026-08-14T09:00:00Z', endAt: '2026-08-14T18:00:00Z' })
  ];
  const ids = (filter: Partial<MyRequestsFilter>) => filterMyRequests(rows, { ...none, ...filter }).map((r) => r.id);

  it('filters by status tab and leave type', () => {
    expect(ids({})).toEqual(['a', 'b', 'c']);
    expect(ids({ status: 'pending' })).toEqual(['b']);
    expect(ids({ leaveTypeId: 'al' })).toEqual(['a', 'c']);
  });

  it('keeps requests that overlap the From/To range', () => {
    expect(ids({ fromDate: '2026-10-08' })).toEqual(['a', 'b']);
    expect(ids({ toDate: '2026-10-07' })).toEqual(['a', 'c']);
  });

  it('searches the leave type and approver names', () => {
    expect(ids({ search: 'sick' })).toEqual(['b']);
    expect(ids({ search: 'priya' })).toEqual(['a', 'c']);
  });
});
