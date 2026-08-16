import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateTaskRequestDto,
  EditTaskRequestDto,
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
}
