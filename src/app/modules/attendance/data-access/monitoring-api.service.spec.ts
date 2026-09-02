import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import {
  MonitoringFeatureTogglesRequest,
  MonitoringPolicyConfiguration,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest
} from '../models/monitoring.model';
import { MonitoringApiService } from './monitoring-api.service';

const companyRequest: MonitoringFeatureTogglesRequest = {
  activityMonitoring: true,
  applicationTracking: true,
  documentTracking: false,
  communicationTracking: false,
  screenshotCapture: true,
  autoScreenshotCapture: false,
  meetingDetection: false,
  deviceTracking: true,
  workLocationVerification: true,
  identityVerification: false,
  biometric: false,
  idleThresholdMinutes: 15
};

const overrideRequest: MonitoringPolicyOverrideRequest = {
  activityMonitoring: null,
  applicationTracking: null,
  documentTracking: null,
  communicationTracking: null,
  screenshotCapture: true,
  autoScreenshotCapture: null,
  meetingDetection: null,
  deviceTracking: null,
  workLocationVerification: null,
  identityVerification: null,
  biometric: null,
  idleThresholdMinutes: null,
  overrideReason: 'Because reasons'
};

const overrideResponse: MonitoringPolicyOverride = {
  id: 'ov-1',
  scopeType: 'department',
  scopeId: 'dept-1',
  targetName: 'Engineering',
  ...overrideRequest,
  overrideReason: overrideRequest.overrideReason ?? '',
  updatedAt: '2026-08-21T00:00:00.000Z'
};

const policyResponse: MonitoringPolicyConfiguration = {
  companyDefault: { ...companyRequest, updatedAt: '2026-08-20T00:00:00.000Z' },
  overrides: [overrideResponse],
  hasActiveCompanyContext: true
};

describe('MonitoringApiService', () => {
  let service: MonitoringApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/attendance/monitoring/policy`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MonitoringApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(MonitoringApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      httpMock?.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('getPolicy() issues a GET to the policy endpoint with no body', () => {
    service.getPolicy().subscribe((response) => expect(response).toEqual(policyResponse));

    const request = httpMock.expectOne(base);
    expect(request.request.method).toBe('GET');
    expect(request.request.body).toBeNull();
    request.flush(policyResponse);
  });

  it('updateCompany() issues a PUT to the company endpoint with exactly the request payload', () => {
    service.updateCompany(companyRequest).subscribe();

    const request = httpMock.expectOne(`${base}/company`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(companyRequest);
    request.flush({});
  });

  it('upsertOverride() issues a PUT to /{scopeType}/{targetId} with exactly the request payload', () => {
    service.upsertOverride('department', 'dept-1', overrideRequest).subscribe((response) => expect(response).toEqual(overrideResponse));

    const request = httpMock.expectOne(`${base}/department/dept-1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(overrideRequest);
    request.flush(overrideResponse);
  });

  it('upsertOverride() URL-encodes the target id for position and role scopes', () => {
    service.upsertOverride('position', 'pos/with space', overrideRequest).subscribe();
    let request = httpMock.expectOne(`${base}/position/${encodeURIComponent('pos/with space')}`);
    expect(request.request.method).toBe('PUT');
    request.flush(overrideResponse);

    service.upsertOverride('role', 'role-1', overrideRequest).subscribe();
    request = httpMock.expectOne(`${base}/role/role-1`);
    expect(request.request.method).toBe('PUT');
    request.flush(overrideResponse);
  });

  it('deleteOverride() issues a DELETE to /{scopeType}/{targetId} with no body', () => {
    service.deleteOverride('department', 'dept-1').subscribe();

    const request = httpMock.expectOne(`${base}/department/dept-1`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null);
  });

  it('deleteOverride() URL-encodes the target id', () => {
    service.deleteOverride('role', 'role id/with slash').subscribe();

    const request = httpMock.expectOne(`${base}/role/${encodeURIComponent('role id/with slash')}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});
