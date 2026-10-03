import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ProjectTaskStatusChangeRequestsDto,
  TaskStatusChangeRequestDto,
  TaskStatusChangeSetDto,
} from '../models/dto/task-status-change-request.dto';

/** Requests from project members to change the project's task statuses. Listing and creating use
 *  the status-template endpoints; deciding goes through the unified work approvals API, and only
 *  the project's top (root) module owner can decide. */
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
    return this.http.post(`${this.baseUrl}/approvals/${id}/approve`, {});
  }

  reject(id: string, comment: string | null): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/approvals/${id}/reject`, { comment });
  }

  cancel(id: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/approvals/${id}/cancel`, {});
  }
}
