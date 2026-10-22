import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { RequestsListComponent } from './requests-list.component';

describe('RequestsListComponent', () => {
  let fixture: ComponentFixture<RequestsListComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RequestsListComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RequestsListComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads all requests and leave types on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  });

  it('reloads with a status filter when setStatusFilter is called', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.setStatusFilter('rejected');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/all?status=rejected`).flush([]);
  });

  it('opens a row through the HR ledger endpoint and hides approve actions when it is not the viewer turn', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.onRowClicked('req-1');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/req-1/detail`).flush({
      requestId: 'req-1', employeeId: 'emp-1', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
      startAt: '2026-09-10', endAt: '2026-09-12', totalHours: 3, paidHours: 3, unpaidHours: 0, status: 'pending', reason: null,
      approvers: [], submissionConflictSnapshotJson: null, currentWarnings: [], remainingHours: 17, canDecide: false, canChangeDecision: false
    });
    await fixture.whenStable();
    expect(fixture.componentInstance.store.detail()?.requestId).toBe('req-1');
    expect(fixture.componentInstance.canDecide()).toBe(false);
  });
});
