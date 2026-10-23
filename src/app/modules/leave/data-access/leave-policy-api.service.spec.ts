import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateLeavePolicyRequest, LeavePolicyConflictError } from '../models/leave-policy.model';
import { sampleRules } from '../testing/leave-policy-fixtures';
import { LeavePolicyApiService } from './leave-policy-api.service';

const base = `${environment.apiUrl}/leave/policies`;

describe('LeavePolicyApiService', () => {
  let service: LeavePolicyApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeavePolicyApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeavePolicyApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists policies, optionally with inactive ones', () => {
    service.list(true).subscribe();
    const req = http.expectOne(`${base}?includeInactive=true`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets one policy', () => {
    service.get('p1').subscribe();
    expect(http.expectOne(`${base}/p1`).request.method).toBe('GET');
  });

  it('creates a policy and returns its id', async () => {
    const payload: CreateLeavePolicyRequest = {
      leaveTypeId: 't1', name: 'Annual', description: null, rules: sampleRules(),
      assignments: [{ targetKind: 'legal_entity', targetId: 'le1' }], replaceConflicts: false
    };
    const result = firstValueFrom(service.create(payload));
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'p1' });
    expect(await result).toBe('p1');
  });

  it('turns a 409 conflict answer into a typed conflict error', async () => {
    const result = firstValueFrom(service.setAssignments('p1', [], false)).catch((e: unknown) => e);
    http.expectOne(`${base}/p1/assignments`).flush(
      { code: 'leave_policy.assignment_conflict', conflicts: [{ targetKind: 'department', targetId: 'd1', targetName: 'Sales', existingPolicyId: 'p9', existingPolicyName: 'Sales annual' }] },
      { status: 409, statusText: 'Conflict' });
    const error = await result;
    expect(error).toBeInstanceOf(LeavePolicyConflictError);
    expect((error as LeavePolicyConflictError).conflicts[0].targetName).toBe('Sales');
  });

  it('uses the version, assignment, activation, clone and rename routes', () => {
    service.addVersion('p1', { applyFrom: '2026-11-01', rules: sampleRules() }).subscribe();
    expect(http.expectOne(`${base}/p1/versions`).request.method).toBe('POST');
    service.deleteVersion('p1', 'v2').subscribe();
    expect(http.expectOne(`${base}/p1/versions/v2`).request.method).toBe('DELETE');
    service.setActive('p1', false).subscribe();
    expect(http.expectOne(`${base}/p1/deactivate`).request.method).toBe('POST');
    service.setActive('p1', true).subscribe();
    expect(http.expectOne(`${base}/p1/activate`).request.method).toBe('POST');
    service.clone('p1', 'Copy').subscribe();
    const clone = http.expectOne(`${base}/p1/clone`);
    expect(clone.request.body).toEqual({ name: 'Copy' });
    service.updateDetails('p1', { name: 'New', description: null }).subscribe();
    expect(http.expectOne(`${base}/p1`).request.method).toBe('PUT');
  });
});
