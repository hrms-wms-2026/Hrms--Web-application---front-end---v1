import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { PendingApprovalsComponent } from './pending-approvals.component';

describe('PendingApprovalsComponent', () => {
  let fixture: ComponentFixture<PendingApprovalsComponent>;
  let httpMock: HttpTestingController;

  async function setup(queryParams: Record<string, string> = {}): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PendingApprovalsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } }
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PendingApprovalsComponent);
  }

  beforeEach(async () => {
    await setup();
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
      { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-25T00:00:00Z' }
    ]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/req-1/approval`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17
    });
  });

  it('auto-opens the detail sheet from a requestId deep-link query param', async () => {
    await setup({ requestId: 'req-9' });
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/req-9/approval`).flush({
      requestId: 'req-9', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17
    });
  });

  it('does not open the detail sheet when there is no requestId query param', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    expect(fixture.componentInstance.detailOpen()).toBe(false);
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

  it('clears selection after a bulk reject completes', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onSelectionChanged(new Set(['req-1']));
    fixture.componentInstance.bulkRejectReason.set('Coverage too low');
    const rejecting = fixture.componentInstance.onBulkReject();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/bulk-reject`).flush({ items: [], successCount: 1, failureCount: 0 });
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    await rejecting;
    expect(fixture.componentInstance.selectedIds().size).toBe(0);
  });

  it('loads cover periods when Cover my approvals is opened', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.openCover();
    expect(fixture.componentInstance.coverOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/approval-delegates`).flush([]);
  });

  it('saves a cover period then reloads the list', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    const saving = fixture.componentInstance.onSaveCover({
      delegateEmployeeId: 'emp-2', startDate: '2026-09-01', endDate: '2026-09-10'
    });
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/approval-delegates` && r.method === 'POST').flush({
      id: 'd1', delegateEmployeeId: 'emp-2', delegateName: 'Sam Lee', startDate: '2026-09-01', endDate: '2026-09-10'
    });
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/approval-delegates` && r.method === 'GET').flush([]);
    await saving;
  });
});
