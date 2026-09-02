import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveEntitlementStore } from './leave-entitlement.store';
describe('LeaveEntitlementStore', () => {
  let store: InstanceType<typeof LeaveEntitlementStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveEntitlementStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveEntitlementStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads entitlement items', async () => {
    const work = store.load();
    http.expectOne((request) => request.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    await work;
    expect(store.items()).toEqual([]);
    expect(store.loading()).toBe(false);
  });

  it('sets loadError on a failed load', async () => {
    const work = store.load();
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await work;
    expect(store.loadError()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('previewGenerate populates generationPreview and returns true', async () => {
    const preview = { year: 2026, employeeCount: 5, entitlementLineCount: 5, lines: [], skipped: [] };
    const work = store.previewGenerate({ year: 2026, legalEntityId: null });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview`).flush(preview);
    expect(await work).toBe(true);
    expect(store.generationPreview()).toEqual(preview);
    expect(store.generating()).toBe(false);
  });

  it('sets generationError and returns false when previewGenerate fails', async () => {
    const work = store.previewGenerate({ year: 2026, legalEntityId: null });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe(false);
    expect(store.generationError()).toBeTruthy();
    expect(store.generating()).toBe(false);
  });

  it('generate triggers a reload and returns true', async () => {
    const work = store.generate({ year: 2026, legalEntityId: null });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/generate`).flush({ year: 2026, createdCount: 3, skippedCount: 0, errorCount: 0, created: [], skipped: [], errors: [] });
    await Promise.resolve();
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    expect(await work).toBe(true);
    expect(store.generating()).toBe(false);
  });

  it('sets generationError and returns false when generate fails', async () => {
    const work = store.generate({ year: 2026, legalEntityId: null });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/generate`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe(false);
    expect(store.generationError()).toBeTruthy();
  });

  it('createManual triggers a reload and returns true', async () => {
    const work = store.createManual({ employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, totalDays: 5, carriedForwardDays: 0, reason: 'Manual grant' });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/manual`).flush({});
    await Promise.resolve();
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    expect(await work).toBe(true);
    expect(store.saving()).toBe(false);
  });

  it('sets actionError and returns false when createManual fails', async () => {
    const work = store.createManual({ employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, totalDays: 5, carriedForwardDays: 0, reason: 'Grant' });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/manual`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('adjust succeeds, reloads, and returns success', async () => {
    const work = store.adjust('ent-1', { totalDays: 18, carriedForwardDays: 2, reason: 'Correction', confirmNegativeRemaining: true });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`).flush({});
    await Promise.resolve();
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    expect(await work).toBe('success');
    expect(store.saving()).toBe(false);
  });

  it('keeps a 409 adjustment available for confirmation', async () => {
    const work = store.adjust('ent-1', { totalDays: 5, carriedForwardDays: 0, reason: 'Correction', confirmNegativeRemaining: false });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`).flush({ detail: 'Remaining would go negative' }, { status: 409, statusText: 'Conflict' });
    expect(await work).toBe('confirm');
    expect(store.actionError()).toBeNull();
  });

  it('sets actionError and returns error when adjust fails with non-409', async () => {
    const work = store.adjust('ent-1', { totalDays: 18, carriedForwardDays: 2, reason: 'x', confirmNegativeRemaining: false });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe('error');
    expect(store.actionError()).toBeTruthy();
  });

  it('recalculate succeeds, reloads, and returns success', async () => {
    const work = store.recalculate('ent-1', { confirmNegativeRemaining: true });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/recalculate`).flush({});
    await Promise.resolve();
    http.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    expect(await work).toBe('success');
  });

  it('returns confirm when recalculate gets a 409 without confirmNegativeRemaining', async () => {
    const work = store.recalculate('ent-1', { confirmNegativeRemaining: false });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/recalculate`).flush({ detail: 'Would go negative' }, { status: 409, statusText: 'Conflict' });
    expect(await work).toBe('confirm');
    expect(store.actionError()).toBeNull();
  });

  it('sets actionError and returns error when recalculate fails with non-409', async () => {
    const work = store.recalculate('ent-1', { confirmNegativeRemaining: false });
    http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/recalculate`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    expect(await work).toBe('error');
    expect(store.actionError()).toBeTruthy();
  });
});
