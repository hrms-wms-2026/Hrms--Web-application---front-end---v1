import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveApprovalDecisionResponse, LeaveApprovalDetailResponse } from '../models/leave-approval.model';
import { CancelLeaveRequestResponse } from '../models/leave-request.model';
import { LeaveApprovalStore } from './leave-approval.store';

describe('LeaveApprovalStore', () => {
  let store: InstanceType<typeof LeaveApprovalStore>;
  let httpMock: HttpTestingController;

  const decision: LeaveApprovalDecisionResponse = {
    requestId: 'req-1', status: 'approved', currentApproverState: 'complete',
    paidDaysMovedFromPending: 3, unpaidDays: 0, remainingDays: 14, currentWarnings: []
  };

  const detail: LeaveApprovalDetailResponse = {
    requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
    leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startDate: '2026-09-10', endDate: '2026-09-12',
    totalDays: 3, paidDays: 3, unpaidDays: 0, status: 'pending', reason: 'Trip',
    approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingDays: 17
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveApprovalStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveApprovalStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads pending approvals', async () => {
    const loading = store.loadPending();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    await loading;
    expect(store.pending()).toEqual([]);
    expect(store.pendingLoading()).toBe(false);
  });

  it('reloads pending with new filters when setPendingFilter is called', async () => {
    const loading = store.loadPending();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    await loading;
    store.setPendingFilter({ search: 'anu' });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/pending-approvals?search=anu`).flush([]);
  });

  it('loads all requests with status filter', async () => {
    const loading = store.loadAll();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/all`).flush([]);
    await loading;
    store.setAllFilter({ status: 'rejected' });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/all?status=rejected`).flush([]);
  });

  it('loads detail into state', async () => {
    const loading = store.loadDetail('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush(detail);
    await loading;
    expect(store.detail()).toEqual(detail);
    expect(store.detailLoading()).toBe(false);
  });

  it('clearDetail resets detail state', async () => {
    const loading = store.loadDetail('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush(detail);
    await loading;
    store.clearDetail();
    expect(store.detail()).toBeNull();
  });

  it('approve succeeds, refreshes detail and pending queue', async () => {
    const loading = store.loadDetail('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush(detail);
    await loading;

    const deciding = store.approve('req-1', { comment: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approve`).flush(decision);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush({ ...detail, status: 'approved' });
    await Promise.resolve(); // loadDetail's firstValueFrom continuation runs
    await Promise.resolve(); // decide() resumes and calls loadPending()
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    const result = await deciding;
    expect(result).toEqual(decision);
    expect(store.deciding()).toBe(false);
  });

  it('reject sets decideError and returns null on failure', async () => {
    const deciding = store.reject('req-1', { reason: 'x' });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/reject`)
      .flush({ detail: 'This request has already been approved or rejected' }, { status: 409, statusText: 'Conflict' });
    const result = await deciding;
    expect(result).toBeNull();
    expect(store.decideError()).toContain('already been approved');
  });

  it('bulkApprove returns the bulk result', async () => {
    const bulkResult = { items: [], successCount: 1, failureCount: 0 };
    const bulking = store.bulkApprove({ requestIds: ['req-1'], comment: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/bulk-approve`).flush(bulkResult);
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    const result = await bulking;
    expect(result).toEqual(bulkResult);
  });

  it('cancels a request and reloads the all-requests list', async () => {
    const cancelResponse: CancelLeaveRequestResponse = {
      requestId: 'req-1', status: 'cancelled', isPartialCancellation: false, effectiveDate: null,
      releasedPendingDays: 0, restoredUsedDays: 3, remainingDays: 20, reason: 'Coverage issue', cancelledAt: '2026-08-30T00:00:00Z'
    };
    const cancelling = store.cancel('req-1', { reason: 'Coverage issue', effectiveDate: null, expectedVersion: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`).flush(cancelResponse);
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    const result = await cancelling;
    expect(result).toEqual(cancelResponse);
  });
});
