import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { sampleRules } from '../testing/leave-policy-fixtures';
import { LeavePolicyStore } from './leave-policy.store';

const base = `${environment.apiUrl}/leave/policies`;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('LeavePolicyStore', () => {
  let store: InstanceType<typeof LeavePolicyStore>;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeavePolicyStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeavePolicyStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('creates a policy and reloads the list', async () => {
    const saving = store.create({ leaveTypeId: 't1', name: 'Annual', description: null, rules: sampleRules(), assignments: [], replaceConflicts: false });
    http.expectOne(base).flush({ id: 'p1' });
    await flush();
    http.expectOne(`${base}?includeInactive=true`).flush([]);
    expect(await saving).toBe('saved');
  });

  it('keeps assignment conflicts for the wizard to show', async () => {
    const saving = store.create({ leaveTypeId: 't1', name: 'Annual', description: null, rules: sampleRules(), assignments: [], replaceConflicts: false });
    http.expectOne(base).flush(
      { code: 'leave_policy.assignment_conflict', conflicts: [{ targetKind: 'department', targetId: 'd1', targetName: 'Sales', existingPolicyId: 'p9', existingPolicyName: 'Sales annual' }] },
      { status: 409, statusText: 'Conflict' });
    expect(await saving).toBe('conflicts');
    expect(store.conflicts()[0].targetName).toBe('Sales');
    expect(store.actionError()).toBeNull();
  });

  it('saves an edit as assignments, then details, then a new version', async () => {
    const saving = store.saveEdit('p1', {
      details: { name: 'Annual 2027', description: null },
      version: { applyFrom: '2026-11-01', rules: sampleRules() },
      assignments: [{ targetKind: 'legal_entity', targetId: 'le1' }],
      replaceConflicts: false
    });
    http.expectOne(`${base}/p1/assignments`).flush({});
    await flush();
    http.expectOne(`${base}/p1`).flush(null);
    await flush();
    const version = http.expectOne(`${base}/p1/versions`);
    expect(version.request.body).toEqual({ applyFrom: '2026-11-01', rules: sampleRules() });
    version.flush('v2');
    await flush();
    http.expectOne(`${base}?includeInactive=true`).flush([]);
    http.expectOne(`${base}/p1`).flush({ id: 'p1' });
    expect(await saving).toBe('saved');
  });

  it('reports a failed save', async () => {
    const saving = store.setActive('p1', false);
    http.expectOne(`${base}/p1/deactivate`).flush(
      { code: 'leave_policy.has_assignments', detail: 'Unassign this policy everywhere before turning it off.' },
      { status: 409, statusText: 'Conflict' });
    expect(await saving).toBe('failed');
    expect(store.actionError()).toBeTruthy();
  });

  it('reloads the policy after a failed edit so partly saved changes show', async () => {
    const saving = store.saveEdit('p1', {
      details: null,
      version: { applyFrom: '2026-10-20', rules: sampleRules() },
      assignments: [{ targetKind: 'legal_entity', targetId: 'le1' }],
      replaceConflicts: false
    });
    http.expectOne(`${base}/p1/assignments`).flush({});
    await flush();
    http.expectOne(`${base}/p1/versions`).flush({ detail: 'A version already starts on that date.' }, { status: 400, statusText: 'Bad Request' });
    await flush();
    http.expectOne(`${base}?includeInactive=true`).flush([]);
    http.expectOne(`${base}/p1`).flush({ id: 'p1' });
    expect(await saving).toBe('failed');
  });
});
