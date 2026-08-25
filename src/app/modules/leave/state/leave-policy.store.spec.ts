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
});
