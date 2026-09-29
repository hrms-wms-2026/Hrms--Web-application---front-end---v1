import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { ProjectMonitorApiService } from './project-monitor-api.service';

describe('ProjectMonitorApiService', () => {
  let service: ProjectMonitorApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/work/projects/p1/monitor`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectMonitorApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the module form values to module-check', () => {
    const body = { startDate: '2026-10-05', endDate: '2026-10-16', allocatedHours: 500, memberEmployeeIds: ['e1'] };
    service.checkModule('p1', body).subscribe();
    const req = http.expectOne(`${base}/module-check`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ warnings: [] });
  });

  it('posts the task form values to task-check', () => {
    const body = { taskId: null, assigneeEmployeeIds: ['e1'], dueDate: '2026-10-07', estimatedHours: 10 };
    service.checkTask('p1', body).subscribe();
    const req = http.expectOne(`${base}/task-check`);
    expect(req.request.method).toBe('POST');
    req.flush({ warnings: [] });
  });

  it('gets the open alerts', () => {
    service.listAlerts('p1').subscribe();
    const req = http.expectOne(`${base}/alerts`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
