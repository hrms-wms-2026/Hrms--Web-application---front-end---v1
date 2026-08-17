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

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getStatuses(objectiveId: string): Observable<TaskStatusDto[]> {
    return this.http.get<TaskStatusDto[]>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses`);
  }

  createStatus(objectiveId: string, request: CreateTaskStatusRequestDto): Observable<TaskStatusDto> {
    return this.http.post<TaskStatusDto>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses`, request);
  }

  editStatus(objectiveId: string, id: string, request: EditTaskStatusRequestDto): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/objectives/${objectiveId}/task-statuses/${id}`, request);
  }

  deleteStatus(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/task-statuses/${id}`);
  }

  getTasks(objectiveId: string): Observable<WorkTaskDto[]> {
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/objectives/${objectiveId}/tasks`);
  }

  createTask(objectiveId: string, request: CreateTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/objectives/${objectiveId}/tasks`, request);
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
}
