import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskStatusChangeRequestApiService } from './task-status-change-request-api.service';

describe('TaskStatusChangeRequestApiService', () => {
  let service: TaskStatusChangeRequestApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), TaskStatusChangeRequestApiService]
    });
    service = TestBed.inject(TaskStatusChangeRequestApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists requests from the project status-template endpoint', () => {
    service.getForProject('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/task-status-change-requests`);
    expect(req.request.method).toBe('GET');
    req.flush({ canEditDirectly: false, canRequest: true, requests: [] });
  });

  it('approve POSTs /work/approvals/r1/approve', () => {
    service.approve('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('reject POSTs /work/approvals/r1/reject with { comment }', () => {
    service.reject('r1', 'Not now').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment: 'Not now' });
    req.flush({});
  });

  it('cancel POSTs /work/approvals/r1/cancel', () => {
    service.cancel('r1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/approvals/r1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});
