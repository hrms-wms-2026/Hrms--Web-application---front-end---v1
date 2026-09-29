import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ProjectTaskStatusChangeRequestsDto,
  TaskStatusChangeRequestDto,
  TaskStatusChangeSetDto,
} from '../models/dto/task-status-change-request.dto';

/** Requests from non-top-module members to change a project's task statuses, decided by the
 *  project's top (default) module owner or its members. */
@Injectable({ providedIn: 'root' })
export class TaskStatusChangeRequestApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getForProject(projectId: string): Observable<ProjectTaskStatusChangeRequestsDto> {
    return this.http.get<ProjectTaskStatusChangeRequestsDto>(
      `${this.baseUrl}/projects/${projectId}/task-status-change-requests`,
    );
  }

  create(projectId: string, changes: TaskStatusChangeSetDto, note: string | null): Observable<TaskStatusChangeRequestDto> {
    return this.http.post<TaskStatusChangeRequestDto>(
      `${this.baseUrl}/projects/${projectId}/task-status-change-requests`,
      { note, changes },
    );
  }

  approve(id: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/task-status-change-requests/${id}/approve`, {});
  }

  reject(id: string, comment: string | null): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-status-change-requests/${id}/reject`, { comment });
  }

  cancel(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/task-status-change-requests/${id}/cancel`, {});
  }
}
