import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskApiService } from './task-api.service';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';

describe('TaskApiService', () => {
  let service: TaskApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TaskApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getTasks fetches tasks for an objective', () => {
    const objectiveId = 'obj-1';
    const mockTasks: WorkTaskDto[] = [{
      id: 't-1', objectiveId, shortId: 'PRJ-1', title: 'Do it', description: null,
      taskType: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0
    }];

    service.getTasks(objectiveId).subscribe((tasks) => {
      expect(tasks).toEqual(mockTasks);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/${objectiveId}/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush(mockTasks);
  });

  it('getStatuses fetches task statuses for an objective', () => {
    const objectiveId = 'obj-1';
    const mockStatuses: TaskStatusDto[] = [{
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public'
    }];

    service.getStatuses(objectiveId).subscribe((statuses) => {
      expect(statuses).toEqual(mockStatuses);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/${objectiveId}/task-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatuses);
  });

  it('createStatus posts to the task-statuses endpoint', () => {
    service.createStatus('obj-1', {
      name: 'Blocked',
      displayOrder: 4,
      visibility: 'private',
      marksTaskComplete: false,
      requiresApproval: false
    }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/task-statuses`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('deleteStatus sends DELETE to task-statuses/{id}', () => {
    service.deleteStatus('s-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-statuses/s-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
