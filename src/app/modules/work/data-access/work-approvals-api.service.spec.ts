import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkApprovalsApiService } from './work-approvals-api.service';
import { ObjectiveMemberApiService } from './objective-member-api.service';

describe('WorkApprovalsApiService', () => {
  let service: WorkApprovalsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WorkApprovalsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ObjectiveMemberApiService,
          useValue: {
            getMyInvitations: () => of([]),
            acceptInvitation: () => of(null),
            rejectInvitation: () => of(null)
          }
        }
      ]
    });
    service = TestBed.inject(WorkApprovalsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getApprovalHistory fetches project-scoped sent and received history', () => {
    service.getApprovalHistory('project-1').subscribe((res) => expect(res).toEqual([]));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/project-1/approval-history`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getProjectApprovals GETs /work/projects/p1/approvals?scope=inbox', () => {
    service.getProjectApprovals('p1').subscribe((res) => expect(res).toEqual([]));

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/work/projects/p1/approvals`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('scope')).toBe('inbox');
    req.flush([]);
  });

  it('approveWorkApproval POSTs editedPayloadJson + comment', () => {
    service.approveWorkApproval('r1', '{"Title":"x"}', 'ok').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ editedPayloadJson: '{"Title":"x"}', comment: 'ok' });
    req.flush({});
  });

  it('rejectWorkApproval POSTs the comment', () => {
    service.rejectWorkApproval('r1', 'Not needed').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment: 'Not needed' });
    req.flush({});
  });

  it('cancelWorkApproval POSTs to approvals/{id}/cancel', () => {
    service.cancelWorkApproval('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('createAllocationRequest POSTs to allocation-requests and passes a 202 approvalRequestId through', () => {
    service.createAllocationRequest('obj-1', { requestedAdditionalHours: 5, reason: 'Scope grew' })
      .subscribe((res) => expect(res).toEqual({ approvalRequestId: 'ar-1' }));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/allocation-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ requestedAdditionalHours: 5, reason: 'Scope grew' });
    req.flush({ approvalRequestId: 'ar-1' }, { status: 202, statusText: 'Accepted' });
  });
});
