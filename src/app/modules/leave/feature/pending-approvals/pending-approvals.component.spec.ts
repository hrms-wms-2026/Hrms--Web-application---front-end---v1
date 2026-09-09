import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { PendingApprovalsComponent } from './pending-approvals.component';

describe('PendingApprovalsComponent', () => {
  let fixture: ComponentFixture<PendingApprovalsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PendingApprovalsComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PendingApprovalsComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads pending approvals and leave types on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  });

  it('opens the detail sheet when a row is clicked', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([
      { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-25T00:00:00Z' }
    ]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/req-1/approval`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10T00:00:00Z', endAt: '2026-09-12T00:00:00Z', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17
    });
  });

  it('clears selection after a bulk approve completes', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onSelectionChanged(new Set(['req-1', 'req-2']));
    expect(fixture.componentInstance.selectedIds().size).toBe(2);
    const bulking = fixture.componentInstance.onBulkApprove();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/bulk-approve`).flush({ items: [], successCount: 2, failureCount: 0 });
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    await bulking;
    expect(fixture.componentInstance.selectedIds().size).toBe(0);
  });
});
