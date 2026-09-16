import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ClockInPolicyApiService } from './clock-in-policy-api.service';
import {
  ClockInPolicyListItemResponse,
  ClockInPolicyResponse,
  UpsertClockInPolicyRequest
} from '../models/clock-in-policy.model';

describe('ClockInPolicyApiService', () => {
  let service: ClockInPolicyApiService;
  let httpMock: HttpTestingController;

  const listItem: ClockInPolicyListItemResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Default',
    scopeType: 'full_company',
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    isActive: true,
    lateDeductionRuleCount: 0,
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  const detail: ClockInPolicyResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Default',
    scope: { type: 'full_company', departmentIds: [], positionIds: [], employeeIds: [] },
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    correctionRequiresApproval: true,
    notificationRecipientResolver: 'management_coverage_owner',
    lateDeductionRules: [],
    isActive: true,
    createdById: 'user-1',
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  const upsert: UpsertClockInPolicyRequest = {
    name: 'Default',
    scope: { type: 'full_company', departmentIds: [], positionIds: [], employeeIds: [] },
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    correctionRequiresApproval: true,
    notificationRecipientResolver: 'management_coverage_owner',
    lateDeductionRules: [],
    isActive: true
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ClockInPolicyApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ClockInPolicyApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists via legal-entity route with includeInactive=false by default', () => {
    service.list('le-1').subscribe((res) => {
      expect(res).toEqual([listItem]);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies?includeInactive=false`
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('includeInactive')).toBe('false');
    expect(req.request.params.has('tenantId')).toBe(false);
    req.flush([listItem]);
  });

  it('gets a policy via the legal-entity route', () => {
    service.get('le-1', 'policy-1').subscribe((res) => {
      expect(res).toEqual(detail);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies/policy-1`
    );
    expect(req.request.method).toBe('GET');
    req.flush(detail);
  });

  it('creates via POST to the legal-entity collection', () => {
    service.create('le-1', upsert).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(upsert);
    expect(JSON.stringify(req.request.body).toLowerCase()).not.toContain('either');
    expect((req.request.body as Record<string, unknown>)['tenantId']).toBeUndefined();
    req.flush(detail);
  });

  it('updates via PUT to the legal-entity item route', () => {
    service.update('le-1', 'policy-1', upsert).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies/policy-1`
    );
    expect(req.request.method).toBe('PUT');
    expect(JSON.stringify(req.request.body).toLowerCase()).not.toContain('either');
    req.flush(detail);
  });

  it('uses environment.apiUrl and does not set CSRF headers manually', () => {
    service.list('le-1').subscribe();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies?includeInactive=false`
    );
    expect(req.request.url.startsWith(environment.apiUrl)).toBe(true);
    expect(req.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    expect(req.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    req.flush([listItem]);
  });
});
