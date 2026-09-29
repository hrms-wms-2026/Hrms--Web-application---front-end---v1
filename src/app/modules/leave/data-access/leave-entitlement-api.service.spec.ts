import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceAuditListFilter, LeaveBalanceAuditResponse } from '../models/leave-entitlement.model';
import { LeaveEntitlementApiService } from './leave-entitlement-api.service';
describe('LeaveEntitlementApiService', () => { let service: LeaveEntitlementApiService; let http: HttpTestingController; beforeEach(() => { TestBed.configureTestingModule({ providers: [LeaveEntitlementApiService, provideHttpClient(), provideHttpClientTesting()] }); service = TestBed.inject(LeaveEntitlementApiService); http = TestBed.inject(HttpTestingController); }); afterEach(() => http.verify()); it('lists a specific year with its provided filters', () => { service.list(2026, { legalEntityId: 'le-1', search: 'anu' }).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026&legalEntityId=le-1&search=anu`); expect(req.request.method).toBe('GET'); req.flush([]); }); it('uses the preview endpoint before bulk generation', () => { service.previewGenerate({ year: 2026, legalEntityId: 'le-1' }).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview`); expect(req.request.method).toBe('POST'); req.flush({ year: 2026, employeeCount: 0, entitlementLineCount: 0, lines: [], skipped: [] }); }); it('adjusts through the entitlement-specific endpoint', () => { service.adjust('ent-1', { totalDays: 18, carriedForwardDays: 2, reason: 'Correction', confirmNegativeRemaining: false }).subscribe(); const req = http.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`); expect(req.request.method).toBe('PUT'); req.flush({}); });

  it('lists balance audit rows with filters', () => {
    const rows: LeaveBalanceAuditResponse[] = [];
    service.listBalanceAudit({ leaveTypeId: 'type-1', changeType: 'accrual' }, 1, 25).subscribe((res) => expect(res).toEqual(rows));
    const req = http.expectOne(`${environment.apiUrl}/leave/balance-audit?leaveTypeId=type-1&changeType=accrual&page=1&pageSize=25`);
    expect(req.request.method).toBe('GET');
    req.flush(rows);
  });

  it('lists balance audit rows with no filters', () => {
    const filter: LeaveBalanceAuditListFilter = {};
    service.listBalanceAudit(filter, 1, 25).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/balance-audit?page=1&pageSize=25`);
    req.flush([]);
  });

  it('exports balance audit as a blob', () => {
    const blob = new Blob(['csv'], { type: 'text/csv' });
    service.exportBalanceAudit({ leaveTypeId: 'type-1' }).subscribe((res) => expect(res).toEqual(blob));
    const req = http.expectOne(`${environment.apiUrl}/leave/balance-audit/export?leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(blob);
  });

  it('exports the generate preview as a blob', () => {
    const blob = new Blob(['csv'], { type: 'text/csv' });
    service.exportGeneratePreview({ year: 2026, legalEntityId: null }).subscribe((res) => expect(res).toEqual(blob));
    const req = http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview/export`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.body).toEqual({ year: 2026, legalEntityId: null });
    req.flush(blob);
  });
});
