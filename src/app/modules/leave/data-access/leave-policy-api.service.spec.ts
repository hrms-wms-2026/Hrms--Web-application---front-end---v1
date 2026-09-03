import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CreateLeavePolicyRequest } from '../models/leave-policy.model';
import { LeavePolicyApiService } from './leave-policy-api.service';

describe('LeavePolicyApiService', () => {
  let service: LeavePolicyApiService; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [LeavePolicyApiService, provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(LeavePolicyApiService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('lists policies from the backend route', () => { service.list().subscribe((items) => expect(items.length).toBe(1)); const req = http.expectOne(`${environment.apiUrl}/leave/policies`); expect(req.request.method).toBe('GET'); req.flush([{ id: 'p1', name: 'Policy', leaveTypes: [], legalEntities: [] }]); });
  it('creates policies with the mapper payload intact', () => { const payload: CreateLeavePolicyRequest = { ...createPayload(), legalEntityIds: ['le1'] }; service.create(payload).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/policies`); expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(payload); req.flush({ id: 'p1', ...payload, version: 1, isActive: true, legalEntities: [], createdAt: '2026-01-01T00:00:00Z' }); });
  it('clones a policy through its clone route', () => { const payload = { name: 'Cloned policy', country: 'LK', legalEntityIds: ['le1'], effectiveFrom: '2026-02-01', confirmReplaceExistingLegalEntityAssignments: false }; service.clone('p1', payload).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/policies/p1/clone`); expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(payload); req.flush({ id: 'p2', name: 'Cloned policy', leaveTypes: [], legalEntities: [] }); });
});
function createPayload(): Omit<CreateLeavePolicyRequest, 'legalEntityIds'> { return { name: 'Policy', description: null, country: 'LK', jobLevel: null, accrualMethod: 'annual', accrualStart: 'immediately', accrualAfterNMonths: null, prorationMethod: 'calendar_days', probationRestriction: false, minimumTenureMonths: 0, firstYearReducedPercent: null, minimumNoticeDays: 7, maxConsecutiveDays: null, minDaysPerRequest: 0.5, maxTeamAbsencePercent: null, approvalMode: 'any_one', effectiveFrom: '2026-01-01', leaveTypes: [], blackoutPeriods: [], confirmReplaceExistingLegalEntityAssignments: false }; }
