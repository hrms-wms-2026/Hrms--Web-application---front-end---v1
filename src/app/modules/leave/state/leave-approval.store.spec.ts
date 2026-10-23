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
    paidHoursMovedFromPending: 3, unpaidHours: 0, remainingHours: 14, currentWarnings: []
  };

  const detail: LeaveApprovalDetailResponse = {
    requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1',
    leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12',
    totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: 'Trip',
    approvers: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: true, canChangeDecision: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveApprovalStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveApprovalStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

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

  it('approve succeeds and refreshes the detail', async () => {
    const loading = store.loadDetail('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush(detail);
    await loading;

    const deciding = store.approve('req-1', { comment: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approve`).flush(decision);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush({ ...detail, status: 'approved' });
    await Promise.resolve(); // loadDetail's firstValueFrom continuation runs
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

  it('cancels a request and reloads the all-requests list', async () => {
    const cancelResponse: CancelLeaveRequestResponse = {
      requestId: 'req-1', status: 'cancelled', isPartialCancellation: false, effectiveDate: null,
      releasedPendingHours: 0, restoredUsedHours: 3, remainingHours: 20, reason: 'Coverage issue', cancelledAt: '2026-08-30T00:00:00Z'
    };
    const cancelling = store.cancel('req-1', { reason: 'Coverage issue', effectiveDate: null, expectedVersion: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`).flush(cancelResponse);
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    const result = await cancelling;
    expect(result).toEqual(cancelResponse);
  });

  it('sets allLoading to false and allError on loadAll failure', async () => {
    const loading = store.loadAll();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/all`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loading;
    expect(store.allLoading()).toBe(false);
    expect(store.allError()).toBeTruthy();
  });

  it('sets detailLoading to false and detailError on loadDetail failure', async () => {
    const loading = store.loadDetail('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush('Not found', { status: 404, statusText: 'Not Found' });
    await loading;
    expect(store.detailLoading()).toBe(false);
    expect(store.detailError()).toBeTruthy();
  });

  it('sets decideError and returns null when approve fails', async () => {
    const deciding = store.approve('req-1', { comment: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approve`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    const result = await deciding;
    expect(result).toBeNull();
    expect(store.decideError()).toBeTruthy();
    expect(store.deciding()).toBe(false);
  });

  it('sets cancelDialogError and returns null when cancel fails', async () => {
    const cancelling = store.cancel('req-1', { reason: null, effectiveDate: null, expectedVersion: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    const result = await cancelling;
    expect(result).toBeNull();
    expect(store.cancelDialogError()).toBeTruthy();
    expect(store.cancelling()).toBe(false);
  });
});
