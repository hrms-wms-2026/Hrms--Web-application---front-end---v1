import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CreateLeaveTypeRequest, LeaveTypeResponse } from '../models/leave-type.model';
import { LeaveTypeApiService } from './leave-type-api.service';

describe('LeaveTypeApiService', () => {
  let service: LeaveTypeApiService;
  let httpMock: HttpTestingController;

  const mockType: LeaveTypeResponse = {
    id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, color: '#16A34A', isPaid: true, applicableGender: 'all', requiresDocument: false, documentRequiredAfterHours: null, acceptedDocumentTypes: [],
    isActive: true, createdAt: '2026-08-21T00:00:00Z', policyCount: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveTypeApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveTypeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists leave types', () => {
    service.list(false).subscribe((items) => expect(items).toEqual([mockType]));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`);
    expect(req.request.method).toBe('GET');
    req.flush([mockType]);
  });

  it('creates a leave type', () => {
    const payload: CreateLeaveTypeRequest = {
      name: 'Sick Leave', code: 'SICK', description: null, color: '#16A34A',
      isPaid: true, applicableGender: 'all', requiresDocument: true, documentRequiredAfterHours: 16,
      acceptedDocumentTypes: ['pdf']
    };
    service.create(payload).subscribe((item) => expect(item).toEqual(mockType));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockType);
  });

  it('deactivates a leave type', () => {
    service.deactivate('type-1', false).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types/type-1/deactivate?confirmed=false`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
