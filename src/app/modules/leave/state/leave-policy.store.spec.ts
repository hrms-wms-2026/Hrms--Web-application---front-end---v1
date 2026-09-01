import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CreateLeavePolicyRequest } from '../models/leave-policy.model';
import { LeavePolicyStore } from './leave-policy.store';
function payload(confirmReplaceExistingLegalEntityAssignments = false): CreateLeavePolicyRequest { return { name: 'Policy', description: null, country: 'LK', jobLevel: null, accrualMethod: 'annual', accrualStart: 'immediately', accrualAfterNMonths: null, prorationMethod: 'calendar_days', probationRestriction: false, minimumTenureMonths: 0, firstYearReducedPercent: null, minimumNoticeDays: 7, maxConsecutiveDays: null, minDaysPerRequest: 0.5, maxTeamAbsencePercent: null, approvalMode: 'any_one', effectiveFrom: '2026-01-01', leaveTypes: [], blackoutPeriods: [], legalEntityIds: ['le1'], confirmReplaceExistingLegalEntityAssignments }; }
describe('LeavePolicyStore', () => {
  let store: InstanceType<typeof LeavePolicyStore>; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [LeavePolicyStore, provideHttpClient(), provideHttpClientTesting()] }); store = TestBed.inject(LeavePolicyStore); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('loads policies into state', async () => { const work = store.loadPolicies(); http.expectOne(`${environment.apiUrl}/leave/policies`).flush([{ id: 'p1', name: 'Policy', leaveTypes: [], legalEntities: [] }]); await work; expect(store.items().map((policy) => policy.id)).toEqual(['p1']); expect(store.loadError()).toBeNull(); });
  it('returns confirm-replace and retains the conflict message on 409 create', async () => { const work = store.createPolicy(payload(false)); http.expectOne(`${environment.apiUrl}/leave/policies`).flush({ detail: 'Legal Entity Acme already has an active policy.' }, { status: 409, statusText: 'Conflict' }); expect(await work).toBe('confirm-replace'); expect(store.replacementConfirmationMessage()).toContain('already has an active policy'); });
  it('adds a successful creation to the list', async () => { const work = store.createPolicy(payload(true)); http.expectOne(`${environment.apiUrl}/leave/policies`).flush({ id: 'p2', name: 'Policy', leaveTypes: [], legalEntities: [] }); expect(await work).toBe('created'); expect(store.items()[0].id).toBe('p2'); });

  it('sets loadError and returns on a failed loadPolicies', async () => {
    const work = store.loadPolicies();
    http.expectOne(`${environment.apiUrl}/leave/policies`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await work;
    expect(store.loadError()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('loads a single policy into selectedPolicy', async () => {
    const full = { id: 'p1', name: 'Policy', description: null, country: 'LK', jobLevel: null, accrualMethod: 'annual', accrualStart: 'immediately', accrualAfterNMonths: null, prorationMethod: 'calendar_days', probationRestriction: false, minimumTenureMonths: 0, firstYearReducedPercent: null, minimumNoticeDays: 7, maxConsecutiveDays: null, minDaysPerRequest: 0.5, maxTeamAbsencePercent: null, approvalMode: 'any_one', effectiveFrom: '2026-01-01', isActive: true, leaveTypes: [], legalEntities: [], blackoutPeriods: [], createdAt: '2026-08-01T00:00:00Z', updatedAt: null };
    const work = store.loadPolicy('p1');
    http.expectOne(`${environment.apiUrl}/leave/policies/p1`).flush(full);
    await work;
    expect(store.selectedPolicy()?.id).toBe('p1');
    expect(store.loading()).toBe(false);
  });

  it('clones a policy and prepends it to the list', async () => {
    const cloned = { id: 'p3', name: 'Policy Clone', leaveTypes: [], legalEntities: [] };
    const work = store.clonePolicy('p1', { name: 'Policy Clone', country: 'LK', effectiveFrom: '2026-01-01', legalEntityIds: ['le1'], confirmReplaceExistingLegalEntityAssignments: false });
    http.expectOne(`${environment.apiUrl}/leave/policies/p1/clone`).flush(cloned);
    expect(await work).toBe('created');
    expect(store.items()[0].id).toBe('p3');
  });

  it('returns failed and sets actionError on a non-409 createPolicy error', async () => {
    const work = store.createPolicy(payload(false));
    http.expectOne(`${environment.apiUrl}/leave/policies`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe('failed');
    expect(store.actionError()).toBeTruthy();
  });
});
