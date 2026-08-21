import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskApiService } from './task-api.service';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';
import { TaskEditRequestDto, CreateTaskEditRequestDto } from '../models/dto/task-edit-request.dto';

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
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: []
    }];

    service.getTasks(objectiveId).subscribe((tasks) => {
      expect(tasks).toEqual(mockTasks);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/${objectiveId}/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush(mockTasks);
  });

  it('getBySprintId fetches tasks for a sprint', () => {
    const sprintId = 'spr-1';
    const mockTasks: WorkTaskDto[] = [{
      id: 't-1', objectiveId: 'obj-1', shortId: 'PRJ-1', title: 'Do it', description: null,
      taskType: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId, assigneeEmployeeIds: []
    }];

    service.getBySprintId(sprintId).subscribe((tasks) => {
      expect(tasks).toEqual(mockTasks);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/sprints/${sprintId}/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush(mockTasks);
  });

  it('deleteTask DELETEs the task by id', () => {
    service.deleteTask('t-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
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

  it('createTaskEditRequest posts to tasks/{taskId}/edit-requests', () => {
    const taskId = 't-1';
    const request: CreateTaskEditRequestDto = {
      title: 'Updated Title',
      description: 'Updated Description',
      priority: 'high',
      dueDate: '2024-12-31',
      estimatedHours: 10,
      storyPoints: 5
    };
    const mockResponse: TaskEditRequestDto = {
      id: 'ter-1',
      taskId,
      status: 'pending',
      payload: {
        title: 'Updated Title',
        description: 'Updated Description',
        priority: 'high',
        dueDate: '2024-12-31',
        estimatedHours: 10,
        storyPoints: 5
      },
      requestedByName: 'John Doe',
      createdAt: '2024-01-01T00:00:00Z'
    };

    service.createTaskEditRequest(taskId, request).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/${taskId}/edit-requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush(mockResponse);
  });

  it('approveTaskEditRequest posts to task-edit-requests/{id}/approve', () => {
    const editRequestId = 'ter-1';
    const mockTask: WorkTaskDto = {
      id: 't-1', objectiveId: 'obj-1', shortId: 'PRJ-1', title: 'Updated Title', description: 'Updated Description',
      taskType: 'task', statusId: 's-1', priority: 'high', storyPoints: 5,
      dueDate: '2024-12-31', estimatedHours: 10, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: []
    };

    service.approveTaskEditRequest(editRequestId).subscribe((response) => {
      expect(response).toEqual(mockTask);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-edit-requests/${editRequestId}/approve`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(mockTask);
  });

  it('rejectTaskEditRequest posts to task-edit-requests/{id}/reject with comment', () => {
    const editRequestId = 'ter-1';
    const comment = 'Need more information';

    service.rejectTaskEditRequest(editRequestId, comment).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-edit-requests/${editRequestId}/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment });
    req.flush(null);
  });

  it('cancelTaskEditRequest posts to task-edit-requests/{id}/cancel', () => {
    const editRequestId = 'ter-1';

    service.cancelTaskEditRequest(editRequestId).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-edit-requests/${editRequestId}/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('getMyTaskEditRequests fetches task edit requests', () => {
    const mockRequests: TaskEditRequestDto[] = [{
      id: 'ter-1', taskId: 't-1', status: 'pending',
      payload: {
        title: 'Updated Title', description: null, priority: 'high', dueDate: null, estimatedHours: 10, storyPoints: null
      },
      requestedByName: 'John Doe', createdAt: '2024-01-01T00:00:00Z'
    }];

    service.getMyTaskEditRequests().subscribe((requests) => {
      expect(requests).toEqual(mockRequests);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-edit-requests/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(mockRequests);
  });

  it('reorderTaskStatuses posts to objectives/{objectiveId}/task-statuses/reorder', () => {
    const objectiveId = 'obj-1';
    const updates = [
      { statusId: 's-1', displayOrder: 0, visibility: 'public', marksTaskComplete: false },
      { statusId: 's-2', displayOrder: 1, visibility: 'public', marksTaskComplete: false }
    ];
    const mockStatuses: TaskStatusDto[] = [
      { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's-2', name: 'In Progress', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
    ];

    service.reorderTaskStatuses(objectiveId, updates).subscribe((statuses) => {
      expect(statuses).toEqual(mockStatuses);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/${objectiveId}/task-statuses/reorder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ updates });
    req.flush(mockStatuses);
  });
});
