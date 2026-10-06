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
      { requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', submittedAt: '2026-08-25T00:00:00Z' }
    ]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/req-1/approval`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: true, forwardTo: null, canChangeDecision: false
    });
  });

  it('shows the load error in the detail sheet instead of a blank modal', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush(
      { detail: 'You are not an approver for this request.' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.store.detailError()).toBeTruthy();
    expect(fixture.componentInstance.canDecide()).toBe(false);
    expect(document.querySelector('[data-testid="detail-load-error"]')).not.toBeNull();
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

  it('loads the approval history when the History tab is opened and lists past actions', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.setTab('history');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/approval-history`).flush([
      { requestId: 'req-9', employeeId: 'emp-3', employeeName: 'Tharmi Rajendran', leaveTypeName: 'Annual Leave', startAt: '2026-10-08T03:30:00Z', endAt: '2026-10-08T12:30:00Z', totalHours: 8, myAction: 'forwarded', actedAt: '2026-10-06T08:00:00Z', myComment: 'Please decide', requestStatus: 'pending' }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="history-row"]');
    expect(rows.length).toBe(1);
    expect((rows[0] as HTMLElement).textContent).toContain('Tharmi Rajendran');
    expect((fixture.nativeElement.querySelector('[data-testid="history-action"]') as HTMLElement).textContent).toContain('Forwarded');
  });

  it('forwards the open request and reports who it went to', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: true, forwardTo: { employeeId: 'mgr-2', name: 'Nadesh Coomaraswamy' }, canChangeDecision: false
    });
    await fixture.whenStable();
    const forwarding = fixture.componentInstance.onDecision({ kind: 'forward', note: 'Long leave' });
    const forwardReq = httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/forward`);
    expect(forwardReq.request.body).toEqual({ note: 'Long leave' });
    forwardReq.flush({ requestId: 'req-1', status: 'pending', currentApproverState: 'pending', paidHoursMovedFromPending: 0, unpaidHours: 0, remainingHours: 17, currentWarnings: [] });
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/approval`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null, approvers: [], infoMessages: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: false, forwardTo: null, canChangeDecision: false
    });
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/pending-approvals`).flush([]);
    await forwarding;
    expect(fixture.componentInstance.detailOpen()).toBe(false);
  });
});
