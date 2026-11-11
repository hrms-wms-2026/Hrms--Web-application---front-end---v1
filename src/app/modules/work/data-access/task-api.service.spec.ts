import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskApiService } from './task-api.service';
import { WorkTaskDto, TaskStatusDto } from '../models/dto/task.dto';
import { TaskCategoryDto } from '../models/dto/task-category.dto';
import { isPendingApproval } from '../models/dto/work-approval.dto';

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
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
      createdAt: '2026-01-01T00:00:00Z'
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
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
      createdAt: '2026-01-01T00:00:00Z'
    }];

    service.getBySprintId(sprintId).subscribe((tasks) => {
      expect(tasks).toEqual(mockTasks);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/sprints/${sprintId}/tasks`);
    expect(req.request.method).toBe('GET');
    req.flush(mockTasks);
  });

  it('posts each bulk action to its endpoint', () => {
    const ok = { items: [], succeeded: 0, failed: 0 };
    service.bulkMoveStatus(['a'], 's').subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/work/tasks/bulk/status') && r.body.newStatusId === 's').flush(ok);
    service.bulkAssign(['a'], 'e').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/assign') && r.body.employeeId === 'e').flush(ok);
    service.bulkSetPriority(['a'], 'high').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/priority') && r.body.priority === 'high').flush(ok);
    service.bulkSetDueDate(['a'], null).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/due-date') && r.body.dueDate === null).flush(ok);
    service.bulkConvertToSubtask(['a'], 'p').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/convert-to-subtask') && r.body.newParentTaskId === 'p').flush(ok);
    service.bulkDelete(['a']).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/delete') && r.body.taskIds[0] === 'a').flush(ok);
  });

  it('deleteTask DELETEs the task by id', () => {
    service.deleteTask('t-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('duplicateTask POSTs the duplicate payload and returns the new task', () => {
    const mockTask: WorkTaskDto = {
      id: 't-2', objectiveId: 'obj-1', shortId: 'PRJ-2', title: 'Do it (copy)', description: null,
      categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null,
      assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
      createdAt: '2026-01-01T00:00:00Z'
    };
    const payload = {
      destinationObjectiveId: 'obj-1', title: 'Do it (copy)',
      copyAttachments: true, copyAssignees: true, copyComments: false, copyDueDate: true
    };

    service.duplicateTask('t-1', payload).subscribe((task) => {
      expect(task).toEqual(mockTask);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/duplicate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockTask);
  });

  it('convertToSubtask POSTs the new parent task id and returns the updated task', () => {
    const mockTask: WorkTaskDto = {
      id: 't-1', objectiveId: 'obj-2', shortId: 'PRJ-1', title: 'Task 2', description: null,
      categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
      dueDate: null, estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: null,
      assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
      parentTaskId: 't-3', createdAt: '2026-01-01T00:00:00Z'
    };

    service.convertToSubtask('t-1', { newParentTaskId: 't-3' }).subscribe((task) => {
      expect(task).toEqual(mockTask);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/convert-to-subtask`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newParentTaskId: 't-3' });
    req.flush(mockTask);
  });

it('getStatuses fetches task statuses for a project', () => {
    const projectId = 'project-1';
    const mockStatuses: TaskStatusDto[] = [{
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public'
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
      category: 'active',
      color: '#2563EB',
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

  it('createTask returns PendingApprovalDto on 202', () => {
    let result: unknown;
    service.createTask('obj-1', { title: 'T', categoryId: 'c-1', priority: 'medium', sprintId: null }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/tasks`);
    expect(req.request.method).toBe('POST');
    req.flush({ approvalRequestId: 'r1' }, { status: 202, statusText: 'Accepted' });

    expect(result).toEqual({ approvalRequestId: 'r1' });
    expect(isPendingApproval(result)).toBe(true);
  });

  it('editTask returns PendingApprovalDto on 202', () => {
    let result: unknown;
    service.editTask('t-1', { title: 'T', priority: 'high' }).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ approvalRequestId: 'r2' }, { status: 202, statusText: 'Accepted' });

    expect(isPendingApproval(result)).toBe(true);
  });

  it('deleteTask returns PendingApprovalDto on 202', () => {
    let result: unknown = 'unset';
    service.deleteTask('t-1').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ approvalRequestId: 'r3' }, { status: 202, statusText: 'Accepted' });

    expect(result).toEqual({ approvalRequestId: 'r3' });
  });

it('reorderTaskStatuses posts to projects/{projectId}/task-statuses/reorder', () => {
    const projectId = 'project-1';
    const updates = [
      { statusId: 's-1', displayOrder: 0, visibility: 'public', category: 'active' as const, color: '#2563EB' },
      { statusId: 's-2', displayOrder: 1, visibility: 'public', category: 'active' as const, color: '#2563EB' }
    ];
    const mockStatuses: TaskStatusDto[] = [
      { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public' },
      { id: 's-2', name: 'In Progress', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public' }
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
    const request = { name: 'Bug', displayOrder: 1, kind: 'bug' };

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

  it('uploadPendingFile posts multipart form data to tasks/pending-uploads', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    service.uploadPendingFile(file, 'task_attachment').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/pending-uploads`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ fileId: 'f1', originalFileName: 'a.png', fileSizeBytes: 1, contentType: 'image/png' });
  });

  it('deletePendingFile deletes by fileId', () => {
    service.deletePendingFile('f1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/pending-uploads/f1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('downloadFile fetches the task file as a blob', () => {
    const response = new Blob(['contents'], { type: 'text/plain' });
    service.downloadFile('f1').subscribe((blob) => expect(blob).toBe(response));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/files/f1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(response);
  });

  it('getFileUrl builds the content url', () => {
    expect(service.getFileUrl('f1')).toBe(`${environment.apiUrl}/work/tasks/files/f1`);
  });

  it('getTaskById reads a principal\'s task only when forEmployeeId is given', () => {
    service.getTaskById('t1').subscribe();
    expect(httpMock.expectOne((r) => r.url === `${environment.apiUrl}/work/tasks/t1`).request.params.has('forEmployeeId')).toBe(false);

    service.getTaskById('t1', 'ceo').subscribe();
    expect(httpMock.expectOne((r) => r.url === `${environment.apiUrl}/work/tasks/t1`).request.params.get('forEmployeeId')).toBe('ceo');
  });
});
