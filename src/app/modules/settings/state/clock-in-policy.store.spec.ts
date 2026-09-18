import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT,
  CLOCK_IN_POLICY_LOAD_ERROR,
  CLOCK_IN_POLICY_SAVE_ERROR,
  ClockInPolicyStore
} from './clock-in-policy.store';
import {
  ClockInPolicyListItemResponse,
  ClockInPolicyResponse
} from '../models/clock-in-policy.model';
import { createDefaultClockInPolicyFormModel } from '../utils/clock-in-policy-form.utils';

describe('ClockInPolicyStore', () => {
  let store: InstanceType<typeof ClockInPolicyStore>;
  let httpMock: HttpTestingController;

  const listItem: ClockInPolicyListItemResponse = {
    id: 'policy-1',
    legalEntityId: 'le-1',
    name: 'Default',
    scopeType: 'full_company',
    effectiveFrom: '2026-08-21',
    effectiveTo: null,
    isActive: true,
    lateDeductionRuleCount: 2,
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
    lateDeductionRules: [
      { id: 'r1', lateArrivalMinute: 15, multiplier: 0, timeOffTypeId: 'tot-1', isActive: true }
    ],
    isActive: true,
    createdById: 'user-1',
    createdAt: '2026-08-21T00:00:00Z',
    updatedAt: '2026-08-21T00:00:00Z'
  };

  const listUrl = (leId: string) =>
    `${environment.apiUrl}/attendance/legal-entities/${leId}/clock-in-policies?includeInactive=false`;
  const createUrl = `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies`;
  const detailUrl = `${environment.apiUrl}/attendance/legal-entities/le-1/clock-in-policies/policy-1`;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ClockInPolicyStore, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(ClockInPolicyStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('does not call the API when legalEntityId is missing or empty', async () => {
    await store.loadCompanyPolicy('');
    await store.loadCompanyPolicy('   ');
    await store.saveCompanyPolicy('', createDefaultClockInPolicyFormModel());
    httpMock.expectNone(() => true);
    expect(store.loading()).toBe(false);
  });

  it('loadCompanyPolicy leaves policy null when no company-wide policy exists', async () => {
    const promise = store.loadCompanyPolicy('le-1');
    expect(store.loading()).toBe(true);
    httpMock.expectOne(listUrl('le-1')).flush([]);
    await promise;
    expect(store.policy()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.multipleCompanyPolicies()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  it('loadCompanyPolicy loads detail when one full_company policy exists', async () => {
    const promise = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([listItem]);
    await Promise.resolve();
    httpMock.expectOne(detailUrl).flush(detail);
    await promise;
    expect(store.policy()).toEqual(detail);
    expect(store.error()).toBeNull();
    expect(store.multipleCompanyPolicies()).toBe(false);
  });

  it('loadCompanyPolicy sets blocking conflict when multiple full_company policies exist', async () => {
    const promise = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([
      listItem,
      { ...listItem, id: 'policy-2', name: 'Other' }
    ]);
    await promise;
    expect(store.policy()).toBeNull();
    expect(store.multipleCompanyPolicies()).toBe(true);
    expect(store.error()).toBe(CLOCK_IN_POLICY_COMPANY_WIDE_CONFLICT);
  });

  it('saveCompanyPolicy does not save when multiple company-wide policies are present', async () => {
    const load = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([
      listItem,
      { ...listItem, id: 'policy-2', name: 'Other' }
    ]);
    await load;

    const saved = await store.saveCompanyPolicy('le-1', createDefaultClockInPolicyFormModel());
    expect(saved).toBeNull();
    httpMock.expectNone(() => true);
  });

  it('saveCompanyPolicy POSTs when no company-wide policy exists', async () => {
    const load = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([]);
    await load;

    const form = createDefaultClockInPolicyFormModel(new Date(2026, 7, 21));
    const promise = store.saveCompanyPolicy('le-1', form);
    const req = httpMock.expectOne(createUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('Default clock-in policy');
    expect(req.request.body.scope.type).toBe('full_company');
    expect(req.request.body.lateDeductionRules).toEqual([]);
    req.flush(detail);
    const saved = await promise;
    expect(saved).toEqual(detail);
    expect(store.policy()).toEqual(detail);
  });

  it('saveCompanyPolicy PUTs and preserves late deduction rules when one exists', async () => {
    const load = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([listItem]);
    await Promise.resolve();
    httpMock.expectOne(detailUrl).flush(detail);
    await load;

    const form = createDefaultClockInPolicyFormModel();
    form.name = detail.name;
    form.effectiveFrom = detail.effectiveFrom;
    const promise = store.saveCompanyPolicy('le-1', form);
    const req = httpMock.expectOne((r) => r.url === detailUrl && r.method === 'PUT');
    expect(req.request.body.lateDeductionRules).toEqual([
      { lateArrivalMinute: 15, multiplier: 0, timeOffTypeId: 'tot-1' }
    ]);
    req.flush(detail);
    await promise;
    expect(store.policy()).toEqual(detail);
  });

  it('stores sanitized load and save errors', async () => {
    const load = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush(
      { detail: 'raw_machine_code_xyz' },
      { status: 500, statusText: 'Server Error' }
    );
    await load;
    expect(store.error()).toBe(CLOCK_IN_POLICY_LOAD_ERROR);

    store.clear();
    const loadOk = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([]);
    await loadOk;

    const save = store.saveCompanyPolicy('le-1', createDefaultClockInPolicyFormModel());
    httpMock
      .expectOne(createUrl)
      .flush({ detail: 'SQL_EXCEPTION_42' }, { status: 500, statusText: 'Server Error' });
    const saved = await save;
    expect(saved).toBeNull();
    expect(store.saveError()).toBe(CLOCK_IN_POLICY_SAVE_ERROR);
  });

  it('dedupes concurrent loads for the same legalEntityId', async () => {
    const first = store.loadCompanyPolicy('le-1');
    const second = store.loadCompanyPolicy('le-1');
    const reqs = httpMock.match(listUrl('le-1'));
    expect(reqs.length).toBe(1);
    reqs[0].flush([]);
    await Promise.all([first, second]);
    expect(store.policy()).toBeNull();
  });

  it('clear resets state', async () => {
    const promise = store.loadCompanyPolicy('le-1');
    httpMock.expectOne(listUrl('le-1')).flush([]);
    await promise;

    store.clear();
    expect(store.policy()).toBeNull();
    expect(store.legalEntityId()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.multipleCompanyPolicies()).toBe(false);
  });
});
