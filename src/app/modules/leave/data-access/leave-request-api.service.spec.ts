import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  CancelLeaveRequestRequest,
  CancelLeaveRequestResponse,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';
import { LeaveRequestApiService } from './leave-request-api.service';

describe('LeaveRequestApiService', () => {
  let service: LeaveRequestApiService;
  let httpMock: HttpTestingController;

  const mockResponse: LeaveRequestResponse = {
    id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
    startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z', totalHours: 24, paidHours: 24, unpaidHours: 0,
    status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
    balanceImpact: { currentRemainingHours: 17, pendingAfterSubmitHours: 3, remainingAfterSubmitHours: 14 },
    approvers: [{ approverEmployeeId: 'mgr-1', approverName: 'Priya Nair', sequenceOrder: 1, status: 'pending', delegatedFromApproverId: null }],
    conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
    createdAt: '2026-08-25T00:00:00Z'
  };

  const payload: SubmitLeaveRequestRequest = {
    leaveTypeId: 'type-1', startAt: '2026-09-10T09:00:00.000Z', endAt: '2026-09-12T18:00:00.000Z', reason: 'Trip', fileRecordIds: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveRequestApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('uploads a supporting document as multipart', () => {
    const file = new File(['note'], 'note.pdf', { type: 'application/pdf' });
    service.uploadDocument(file).subscribe((res) => expect(res.id).toBe('file-1'));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush({ id: 'file-1', originalFileName: 'note.pdf' });
  });

  it('previews a request', () => {
    service.preview(payload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('submits a request', () => {
    service.submit(payload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('submits on behalf of an employee', () => {
    const onBehalfPayload: SubmitLeaveRequestOnBehalfRequest = { ...payload, employeeId: 'emp-2' };
    service.submitOnBehalf(onBehalfPayload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/on-behalf`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(onBehalfPayload);
    req.flush(mockResponse);
  });

  it('lists my requests with filters', () => {
    const items: LeaveRequestListItemResponse[] = [];
    service.listMine({ status: 'pending', leaveTypeId: 'type-1' }).subscribe((res) => expect(res).toEqual(items));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my?status=pending&leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    req.flush(items);
  });

  it('lists my requests with no filters', () => {
    service.listMine({}).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('cancels a request', () => {
    const cancelResponse: CancelLeaveRequestResponse = {
      requestId: 'req-1', status: 'cancelled', isPartialCancellation: false, effectiveDate: null,
      releasedPendingHours: 3, restoredUsedHours: 0, remainingHours: 17, reason: 'Plans changed', cancelledAt: '2026-08-30T00:00:00Z'
    };
    const payload: CancelLeaveRequestRequest = { reason: 'Plans changed', effectiveDate: null, expectedVersion: null };
    service.cancel('req-1', payload).subscribe((res) => expect(res).toEqual(cancelResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(cancelResponse);
  });
});

describe('LeaveRequestApiService query strings (API helper safety net)', () => {
  let service: LeaveRequestApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveRequestApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMine sends every filter in a fixed order', () => {
    service.listMine({ leaveTypeId: 'type-1', toDate: '2026-12-31', fromDate: '2026-01-01', status: 'pending' }).subscribe();
    http
      .expectOne(`${environment.apiUrl}/leave/requests/my?status=pending&fromDate=2026-01-01&toDate=2026-12-31&leaveTypeId=type-1`)
      .flush([]);
  });

  it('listMine skips empty filters', () => {
    service.listMine({ status: '' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
  });
});
