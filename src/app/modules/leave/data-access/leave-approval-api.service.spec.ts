import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveApprovalDecisionResponse, LeaveApprovalDetailResponse, LeavePendingApprovalListItemResponse, LeaveRequestAllListItemResponse } from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';
import { LeaveApprovalApiService } from './leave-approval-api.service';

describe('LeaveApprovalApiService', () => {
  let service: LeaveApprovalApiService;
  let httpMock: HttpTestingController;

  const decision: LeaveApprovalDecisionResponse = {
    requestId: 'req-1', status: 'approved', currentApproverState: 'complete',
    paidHoursMovedFromPending: 3, unpaidHours: 0, remainingHours: 14, currentWarnings: []
  };

  const detail: LeaveApprovalDetailResponse = {
    requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
    leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12',
    totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: 'Trip',
    approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveApprovalApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveApprovalApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists pending approvals with filters', () => {
    const items: LeavePendingApprovalListItemResponse[] = [];
    service.listPending({ search: 'anu', leaveTypeId: 'type-1' }).subscribe((res) => expect(res).toEqual(items));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/pending-approvals?search=anu&leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    req.flush(items);
  });

  it('lists pending approvals with no filters', () => {
    service.listPending({}).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/pending-approvals`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('lists all requests with filters including status', () => {
    const items: LeaveRequestAllListItemResponse[] = [];
    service.listAll({ status: 'approved', fromDate: '2026-01-01' }).subscribe((res) => expect(res).toEqual(items));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/all?fromDate=2026-01-01&status=approved`);
    expect(req.request.method).toBe('GET');
    req.flush(items);
  });

  it('gets approval detail', () => {
    service.getDetail('req-1').subscribe((res) => expect(res).toEqual(detail));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`);
    expect(req.request.method).toBe('GET');
    req.flush(detail);
  });

  it('approves a request', () => {
    service.approve('req-1', { comment: 'ok' }).subscribe((res) => expect(res).toEqual(decision));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment: 'ok' });
    req.flush(decision);
  });

  it('rejects a request', () => {
    service.reject('req-1', { reason: 'No cover available' }).subscribe((res) => expect(res).toEqual(decision));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'No cover available' });
    req.flush(decision);
  });

  it('requests information', () => {
    service.requestInfo('req-1', { question: 'Can you share dates?' }).subscribe((res) => expect(res).toEqual(decision));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/request-info`);
    expect(req.request.method).toBe('POST');
    req.flush(decision);
  });

  it('responds to an information request', () => {
    service.respondInfo('req-1', { message: 'Sure, see attached', fileRecordIds: [] }).subscribe((res) => expect(res).toEqual(decision));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/respond-info`);
    expect(req.request.method).toBe('POST');
    req.flush(decision);
  });

  it('bulk approves requests', () => {
    const bulkResult = { items: [], successCount: 2, failureCount: 0 };
    service.bulkApprove({ requestIds: ['req-1', 'req-2'], comment: null }).subscribe((res) => expect(res).toEqual(bulkResult));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/bulk-approve`);
    expect(req.request.method).toBe('POST');
    req.flush(bulkResult);
  });

  it('bulk rejects requests', () => {
    const bulkResult = { items: [], successCount: 0, failureCount: 2 };
    service.bulkReject({ requestIds: ['req-1', 'req-2'], reason: 'Team coverage too low' }).subscribe((res) => expect(res).toEqual(bulkResult));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/bulk-reject`);
    expect(req.request.method).toBe('POST');
    req.flush(bulkResult);
  });

  it('cancels a request', () => {
    const cancelResponse: CancelLeaveRequestResponse = {
      requestId: 'req-1', status: 'cancelled', isPartialCancellation: false, effectiveDate: null,
      releasedPendingHours: 0, restoredUsedHours: 3, remainingHours: 20, reason: 'Coverage issue', cancelledAt: '2026-08-30T00:00:00Z'
    };
    const payload: CancelLeaveRequestRequest = { reason: 'Coverage issue', effectiveDate: null, expectedVersion: null };
    service.cancel('req-1', payload).subscribe((res) => expect(res).toEqual(cancelResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`);
    expect(req.request.method).toBe('POST');
    req.flush(cancelResponse);
  });
});
