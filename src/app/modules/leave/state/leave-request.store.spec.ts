import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse, LeaveRequestListItemResponse, LeaveRequestResponse, SubmitLeaveRequestRequest } from '../models/leave-request.model';
import { LeaveRequestStore } from './leave-request.store';

describe('LeaveRequestStore', () => {
  let store: InstanceType<typeof LeaveRequestStore>;
  let httpMock: HttpTestingController;

  const mockResponse: LeaveRequestResponse = {
    id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
    startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z', totalHours: 3, paidHours: 3, unpaidHours: 0,
    status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
    balanceImpact: { currentRemainingHours: 17, pendingAfterSubmitHours: 3, remainingAfterSubmitHours: 14 },
    approvers: [], conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
    createdAt: '2026-08-25T00:00:00Z'
  };

  const payload: SubmitLeaveRequestRequest = {
    leaveTypeId: 'type-1', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z',
    reason: 'Trip', fileRecordIds: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveRequestStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads my requests', async () => {
    const items: LeaveRequestListItemResponse[] = [];
    const loading = store.loadMine();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush(items);
    await loading;
    expect(store.myRequests()).toEqual(items);
    expect(store.myRequestsLoading()).toBe(false);
  });

  it('reloads with new filters when setMyRequestsFilter is called', async () => {
    const loading = store.loadMine();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    await loading;
    store.setMyRequestsFilter({ status: 'pending' });
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my?status=pending`);
    req.flush([]);
  });

  it('runs a preview into previewResult', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`).flush(mockResponse);
    await previewing;
    expect(store.previewResult()).toEqual(mockResponse);
    expect(store.previewing()).toBe(false);
  });

  it('sets previewError on a failed preview and clears previewResult', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`)
      .flush({ detail: 'Insufficient balance. You have 1 days remaining for Annual Leave' }, { status: 400, statusText: 'Bad Request' });
    await previewing;
    expect(store.previewResult()).toBeNull();
    expect(store.previewError()).toContain('Insufficient balance');
  });

  it('clearPreview resets preview state', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`).flush(mockResponse);
    await previewing;
    store.clearPreview();
    expect(store.previewResult()).toBeNull();
  });

  it('submit succeeds and reloads my requests', async () => {
    const submitting = store.submit(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests`).flush(mockResponse);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    const result = await submitting;
    expect(result).toEqual(mockResponse);
    expect(store.submitting()).toBe(false);
  });

  it('submit sets submitError and returns null on failure', async () => {
    const submitting = store.submit(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests`)
      .flush({ detail: 'You already have a pending/approved leave request overlapping these dates' }, { status: 409, statusText: 'Conflict' });
    const result = await submitting;
    expect(result).toBeNull();
    expect(store.submitError()).toContain('overlapping');
  });

  it('submitOnBehalf posts to the on-behalf endpoint', async () => {
    const submitting = store.submitOnBehalf({ ...payload, employeeId: 'emp-2' });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/on-behalf`).flush(mockResponse);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    const result = await submitting;
    expect(result).toEqual(mockResponse);
  });

  it('cancels a request and reloads my requests', async () => {
    const cancelResponse: CancelLeaveRequestResponse = {
      requestId: 'req-1', status: 'cancelled', isPartialCancellation: false, effectiveDate: null,
      releasedPendingHours: 3, restoredUsedHours: 0, remainingHours: 17, reason: 'Plans changed', cancelledAt: '2026-08-30T00:00:00Z'
    };
    const cancelling = store.cancel('req-1', { reason: 'Plans changed', effectiveDate: null, expectedVersion: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`).flush(cancelResponse);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    const result = await cancelling;
    expect(result).toEqual(cancelResponse);
    expect(store.cancelling()).toBe(false);
  });

  it('cancel sets cancelError and returns null on failure', async () => {
    const cancelling = store.cancel('req-1', { reason: null, effectiveDate: null, expectedVersion: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`)
      .flush({ detail: 'This leave request has already been cancelled' }, { status: 409, statusText: 'Conflict' });
    const result = await cancelling;
    expect(result).toBeNull();
    expect(store.cancelError()).toContain('already been cancelled');
  });
});
