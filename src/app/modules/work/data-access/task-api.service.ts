import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateTaskRequestDto,
  CreateTaskStatusRequestDto,
  EditTaskRequestDto,
  EditTaskStatusRequestDto,
  TaskStatusDto,
  WorkTaskDto
} from '../models/dto/task.dto';
import {
  CreateTaskCategoryRequestDto,
  EditTaskCategoryRequestDto,
  TaskCategoryDto
} from '../models/dto/task-category.dto';
import {
  CreateTaskEditRequestDto,
  TaskEditRequestDto
} from '../models/dto/task-edit-request.dto';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getStatuses(projectId: string): Observable<TaskStatusDto[]> {
    return this.http.get<TaskStatusDto[]>(`${this.baseUrl}/projects/${projectId}/task-statuses`);
  }

  createStatus(projectId: string, request: CreateTaskStatusRequestDto): Observable<TaskStatusDto> {
    return this.http.post<TaskStatusDto>(`${this.baseUrl}/projects/${projectId}/task-statuses`, request);
  }

  editStatus(_projectId: string, id: string, request: EditTaskStatusRequestDto): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/task-statuses/${id}`, request);
  }

  deleteStatus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/task-statuses/${id}`);
  }

  getTasks(objectiveId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/objectives/${objectiveId}/tasks`);
  }

  getTasksByProject(projectId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/projects/${projectId}/tasks`);
  }

  getBySprintId(sprintId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/sprints/${sprintId}/tasks`);
  }

  createTask(objectiveId: string, request: CreateTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/objectives/${objectiveId}/tasks`, request);
  }

  deleteTask(taskId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${taskId}`);
  }

  editTask(taskId: string, request: EditTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.patch<WorkTaskDto>(`${this.baseUrl}/tasks/${taskId}`, request);
  }

  moveTaskStatus(taskId: string, newStatusId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/tasks/${taskId}/status`, { newStatusId });
  }

  assignTask(taskId: string, employeeId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/assignments`, { employeeId });
  }

  unassignTask(taskId: string, employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/tasks/${taskId}/assignments/${employeeId}`);
  }

  createTaskCreationRequest(objectiveId: string, request: CreateTaskRequestDto): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/objectives/${objectiveId}/task-creation-requests`, request);
  }

  getNotificationNavigation(
    relatedEntityType: string,
    relatedEntityId: string
  ): Observable<{ projectId: string; objectiveId: string; taskId: string | null; targetTab: 'board' | 'approvals' }> {
    const params = new HttpParams()
      .set('relatedEntityType', relatedEntityType)
      .set('relatedEntityId', relatedEntityId);
    return this.http.get<{ projectId: string; objectiveId: string; taskId: string | null; targetTab: 'board' | 'approvals' }>(
      `${this.baseUrl}/notification-navigation`,
      { params }
    );
  }

  createTaskEditRequest(taskId: string, request: CreateTaskEditRequestDto): Observable<TaskEditRequestDto> {
    return this.http.post<TaskEditRequestDto>(`${this.baseUrl}/tasks/${taskId}/edit-requests`, request);
  }

  approveTaskEditRequest(id: string): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/task-edit-requests/${id}/approve`, {});
  }

  rejectTaskEditRequest(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-edit-requests/${id}/reject`, { comment });
  }

  cancelTaskEditRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-edit-requests/${id}/cancel`, {});
  }

  getMyTaskEditRequests(): Observable<TaskEditRequestDto[]> {
    return this.http.get<TaskEditRequestDto[]>(`${this.baseUrl}/task-edit-requests/mine`);
  }

  reorderTaskStatuses(projectId: string, updates: { statusId: string; displayOrder: number; visibility: string; marksTaskComplete: boolean }[]): Observable<TaskStatusDto[]> {
    return this.http.post<TaskStatusDto[]>(`${this.baseUrl}/projects/${projectId}/task-statuses/reorder`, { updates });
  }

  getCategories(projectId: string): Observable<TaskCategoryDto[]> {
    return this.http.get<TaskCategoryDto[]>(`${this.baseUrl}/projects/${projectId}/task-categories`);
  }

  createCategory(projectId: string, request: CreateTaskCategoryRequestDto): Observable<TaskCategoryDto> {
    return this.http.post<TaskCategoryDto>(`${this.baseUrl}/projects/${projectId}/task-categories`, request);
  }

  editCategory(id: string, request: EditTaskCategoryRequestDto): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/task-categories/${id}`, request);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/task-categories/${id}`);
  }

  reorderTaskCategories(projectId: string, updates: { categoryId: string; displayOrder: number }[]): Observable<TaskCategoryDto[]> {
    return this.http.post<TaskCategoryDto[]>(`${this.baseUrl}/projects/${projectId}/task-categories/reorder`, { updates });
  }
}
