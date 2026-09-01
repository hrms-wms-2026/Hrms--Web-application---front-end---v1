import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceAuditResponse } from '../models/leave-entitlement.model';
import { LeaveBalanceAuditStore } from './leave-balance-audit.store';

describe('LeaveBalanceAuditStore', () => {
  let store: InstanceType<typeof LeaveBalanceAuditStore>;
  let httpMock: HttpTestingController;

  function row(id: string): LeaveBalanceAuditResponse {
    return { id, employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', changeType: 'accrual', daysChanged: 20, balanceAfter: 20, reason: 'Auto-generated', relatedRequestId: null, createdAt: '2026-08-25T00:00:00Z' };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveBalanceAuditStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveBalanceAuditStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the first page and resets rows', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush([row('1'), row('2')]);
    await loading;
    expect(store.rows().length).toBe(2);
    expect(store.page()).toBe(1);
  });

  it('sets hasMore to true when a full page comes back', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => row(String(i)));
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush(rows);
    await loading;
    expect(store.hasMore()).toBe(true);
  });

  it('sets hasMore to false when fewer than a full page comes back', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush([row('1')]);
    await loading;
    expect(store.hasMore()).toBe(false);
  });

  it('loadMore appends to existing rows and increments page', async () => {
    const firstPage = Array.from({ length: 25 }, (_, i) => row(String(i)));
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush(firstPage);
    await loading;

    const loadingMore = store.loadMore();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit` && r.params.get('page') === '2').flush([row('25')]);
    await loadingMore;
    expect(store.rows().length).toBe(26);
    expect(store.page()).toBe(2);
  });

  it('setFilter resets to page 1 and reloads', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush([]);
    await loading;
    store.setFilter({ changeType: 'deduction' });
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit` && r.params.get('changeType') === 'deduction' && r.params.get('page') === '1').flush([]);
  });

  it('sets error and loading false when load fails', async () => {
    const loading = store.load();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loading;
    expect(store.error()).toBeTruthy();
    expect(store.loading()).toBe(false);
  });

  it('exportCsv returns a blob and clears exporting flag', async () => {
    const blob = new Blob(['csv'], { type: 'text/csv' });
    const exporting = store.exportCsv();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit/export`).flush(blob);
    const result = await exporting;
    expect(result).toEqual(blob);
    expect(store.exporting()).toBe(false);
  });

  it('exportCsv sets exportError and returns null on failure', async () => {
    const exporting = store.exportCsv();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balance-audit/export`).flush(new Blob(['error'], { type: 'application/json' }), { status: 500, statusText: 'Internal Server Error' });
    const result = await exporting;
    expect(result).toBeNull();
    expect(store.exportError()).toBeTruthy();
    expect(store.exporting()).toBe(false);
  });
});
