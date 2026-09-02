import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskApiService } from './task-api.service';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';
import { TaskCategoryDto } from '../models/dto/task-category.dto';
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
      categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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
      categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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

it('getStatuses fetches task statuses for a project', () => {
    const projectId = 'project-1';
    const mockStatuses: TaskStatusDto[] = [{
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public'
    }];

    service.getStatuses(projectId).subscribe((statuses) => {
      expect(statuses).toEqual(mockStatuses);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/${projectId}/task-statuses`);
    expect(req.request.method).toBe('GET');
    req.flush(mockStatuses);
  });

  it('createStatus posts to the task-statuses endpoint', () => {
    service.createStatus('project-1', {
      name: 'Blocked',
      displayOrder: 4,
      visibility: 'private',
      marksTaskComplete: false,
      requiresApproval: false
    }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/project-1/task-statuses`);
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
      categoryId: 'task', statusId: 's-1', priority: 'high', storyPoints: 5,
      dueDate: '2024-12-31', estimatedHours: 10, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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

it('reorderTaskStatuses posts to projects/{projectId}/task-statuses/reorder', () => {
    const projectId = 'project-1';
    const updates = [
      { statusId: 's-1', displayOrder: 0, visibility: 'public', marksTaskComplete: false },
      { statusId: 's-2', displayOrder: 1, visibility: 'public', marksTaskComplete: false }
    ];
    const mockStatuses: TaskStatusDto[] = [
      { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's-2', name: 'In Progress', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
    ];

    service.reorderTaskStatuses(projectId, updates).subscribe((statuses) => {
      expect(statuses).toEqual(mockStatuses);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/${projectId}/task-statuses/reorder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ updates });
    req.flush(mockStatuses);
  });

  it('getCategories fetches task categories for a project', () => {
    const projectId = 'project-1';
    const mockCategories: TaskCategoryDto[] = [{ id: 'c-1', name: 'Feature', displayOrder: 0 }];

    service.getCategories(projectId).subscribe((categories) => expect(categories).toEqual(mockCategories));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/${projectId}/task-categories`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCategories);
  });

  it('createCategory posts a category to the project endpoint', () => {
    const request = { name: 'Bug', displayOrder: 1 };

    service.createCategory('project-1', request).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/project-1/task-categories`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ id: 'c-2', ...request });
  });

  it('editCategory patches a category by id', () => {
    const request = { name: 'Defect', displayOrder: 1 };

    service.editCategory('c-2', request).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-categories/c-2`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(request);
    req.flush(null);
  });

  it('deleteCategory deletes a category by id', () => {
    service.deleteCategory('c-2').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/work/task-categories/c-2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

    it('getMyTasks builds the my-tasks URL with an optional sprintId param', () => {
    service.getMyTasks('p1', 's1').subscribe();
    const req = httpMock.expectOne((request) =>
      request.url === `${environment.apiUrl}/work/projects/p1/my-tasks` && request.params.get('sprintId') === 's1'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getMyTasks omits sprintId when not provided', () => {
    service.getMyTasks('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/my-tasks`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('sprintId')).toBe(false);
    req.flush([]);
  });

  it('getTaskHistory GETs the history endpoint', () => {
    service.getTaskHistory('t1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/history`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getTaskById GETs the single task endpoint', () => {
    service.getTaskById('t1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('clockIn POSTs with no body', () => {
    service.clockIn('t1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/clock-in`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('push POSTs percent and reason', () => {
    service.push('t1', { percent: 60, reason: 'made progress' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/push`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ percent: 60, reason: 'made progress' });
    req.flush({});
  });

  it('addClockingSessionReason PATCHes the reason', () => {
    service.addClockingSessionReason('s1', 'note').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/clocking-sessions/s1/reason`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: 'note' });
    req.flush(null);
  });

  it('addPercentageLogReason PATCHes the reason', () => {
    service.addPercentageLogReason('l1', 'note').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/percentage-log/l1/reason`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: 'note' });
    req.flush(null);
  });

  it('reorderTaskCategories posts category order for a project', () => {

    const updates = [{ categoryId: 'c-1', displayOrder: 0 }];
    const mockCategories: TaskCategoryDto[] = [{ id: 'c-1', name: 'Feature', displayOrder: 0 }];

    service.reorderTaskCategories('project-1', updates).subscribe((categories) => expect(categories).toEqual(mockCategories));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/project-1/task-categories/reorder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ updates });
    req.flush(mockCategories);
  });
});
