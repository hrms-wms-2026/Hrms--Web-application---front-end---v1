import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WorkApprovalsApiService } from './work-approvals-api.service';
import { ObjectiveMemberApiService } from './objective-member-api.service';
import { TaskCreationRequestDto } from '../models/dto/task-creation-request.dto';
import { ObjectiveChangeRequestDto } from '../models/dto/allocation-request.dto';

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

  it('getMyTaskCreationRequests fetches the owner queue', () => {
    const mock: TaskCreationRequestDto[] = [{
      id: 'r1',
      objectiveId: 'obj-1',
      status: 'pending',
      payload: {
        title: 'Build login', description: null, categoryId: 'task', priority: 'medium',
        dueDate: null, estimatedHours: 5, storyPoints: null
      },
      createdAt: '2026-08-17T00:00:00Z'
    }];

    service.getMyTaskCreationRequests().subscribe((res) => expect(res).toEqual(mock));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-creation-requests/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('getApprovalHistory fetches project-scoped sent and received history', () => {
    service.getApprovalHistory('project-1').subscribe((res) => expect(res).toEqual([]));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/project-1/approval-history`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('approveTaskCreationRequest posts approve', () => {
    service.approveTaskCreationRequest('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-creation-requests/r1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('rejectTaskCreationRequest posts reject with comment', () => {
    service.rejectTaskCreationRequest('r1', 'Not needed').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-creation-requests/r1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment: 'Not needed' });
    req.flush(null);
  });

  it('getMyAllocationRequests filters extend_allocation from change-requests/mine', () => {
    const mine: ObjectiveChangeRequestDto[] = [
      {
        id: 'a1', objectiveId: 'obj-1', requestType: 'extend_allocation', requestedById: 'e1',
        reportingManagerId: 'e2', status: 'pending',
        payloadJson: JSON.stringify({ requestedAdditionalHours: 8, reason: 'Need more' }),
        decidedAt: null, decidedById: null, createdAt: '2026-08-17T00:00:00Z'
      },
      {
        id: 'c1', objectiveId: 'obj-1', requestType: 'edit_fields', requestedById: 'e1',
        reportingManagerId: 'e2', status: 'pending', payloadJson: null,
        decidedAt: null, decidedById: null, createdAt: '2026-08-17T00:00:00Z'
      }
    ];

    service.getMyAllocationRequests().subscribe((res) => {
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('a1');
      expect(res[0].payload.requestedAdditionalHours).toBe(8);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/change-requests/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(mine);
  });

  it('maps PascalCase allocation payloads and preserves requester and module context', () => {
    const mine: ObjectiveChangeRequestDto[] = [{
      id: 'a2', objectiveId: 'obj-2', requestType: 'extend_allocation', requestedById: 'employee-1',
      requestedByName: 'Nimal Perera', objectiveTitle: 'Hardware integration', projectId: 'project-1',
      currentAllocatedHours: 24, reportingManagerId: 'manager-1', status: 'pending',
      payloadJson: JSON.stringify({ RequestedAdditionalHours: 6, Reason: 'Integration testing' }),
      decidedAt: null, decidedById: null, createdAt: '2026-09-25T00:00:00Z'
    }];

    service.getMyAllocationRequests().subscribe((res) => {
      expect(res[0].payload).toEqual({ requestedAdditionalHours: 6, reason: 'Integration testing' });
      expect(res[0].requestedByName).toBe('Nimal Perera');
      expect(res[0].objectiveTitle).toBe('Hardware integration');
      expect(res[0].currentAllocatedHours).toBe(24);
    });

    httpMock.expectOne(`${environment.apiUrl}/work/objectives/change-requests/mine`).flush(mine);
  });

  it('approveAllocationRequest posts the edited additional hours to change-request approve', () => {
    service.approveAllocationRequest('a1', 12).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/change-requests/a1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ approvedAdditionalHours: 12 });
    req.flush(null);
  });

  it('approveObjectiveChangeRequest posts an empty body when approving as-is', () => {
    service.approveObjectiveChangeRequest('c1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/change-requests/c1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('approveObjectiveChangeRequest posts the approver-edited fields when overriding an Edit request', () => {
    const approvedEdit = { title: 'New Title', description: 'desc', startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 };
    service.approveObjectiveChangeRequest('c1', approvedEdit).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/change-requests/c1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(approvedEdit);
    req.flush(null);
  });
});
