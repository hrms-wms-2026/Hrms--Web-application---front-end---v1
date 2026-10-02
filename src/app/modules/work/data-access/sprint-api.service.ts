import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CompleteSprintRequestDto, CreateSprintRequestDto, EditSprintRequestDto, SetSprintTasksRequestDto,
  SprintActivityDto, SprintDto, StartSprintRequestDto
} from '../models/dto/sprint.dto';
import { PendingApprovalDto } from '../models/dto/work-approval.dto';

@Injectable({ providedIn: 'root' })
export class SprintApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getByObjective(objectiveId: string, activeOnly: boolean): Observable<SprintDto[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<SprintDto[]>(`${this.baseUrl}/objectives/${objectiveId}/sprints`, { params });
  }

  getByProject(projectId: string): Observable<SprintDto[]> {
    return this.http.get<SprintDto[]>(`${this.baseUrl}/projects/${projectId}/sprints`);
  }

  /** 201 = created; 202 = sent for approval (every mutating sprint call below: 200 applied / 202 pending). */
  create(projectId: string, request: CreateSprintRequestDto): Observable<SprintDto | PendingApprovalDto> {
    return this.http.post<SprintDto | PendingApprovalDto>(`${this.baseUrl}/projects/${projectId}/sprints`, request);
  }

  setTasks(sprintId: string, request: SetSprintTasksRequestDto): Observable<SprintDto> {
    return this.http.put<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/tasks`, request);
  }

  getActivity(sprintId: string): Observable<SprintActivityDto[]> {
    return this.http.get<SprintActivityDto[]>(`${this.baseUrl}/sprints/${sprintId}/activity`);
  }

  start(sprintId: string, request: StartSprintRequestDto): Observable<SprintDto | PendingApprovalDto> {
    return this.http.post<SprintDto | PendingApprovalDto>(`${this.baseUrl}/sprints/${sprintId}/start`, request);
  }

  edit(sprintId: string, request: EditSprintRequestDto): Observable<SprintDto | PendingApprovalDto> {
    return this.http.patch<SprintDto | PendingApprovalDto>(`${this.baseUrl}/sprints/${sprintId}`, request);
  }

  complete(sprintId: string, request: CompleteSprintRequestDto): Observable<SprintDto | PendingApprovalDto> {
    return this.http.post<SprintDto | PendingApprovalDto>(`${this.baseUrl}/sprints/${sprintId}/complete`, request);
  }

  achieve(sprintId: string): Observable<SprintDto | PendingApprovalDto> {
    return this.http.post<SprintDto | PendingApprovalDto>(`${this.baseUrl}/sprints/${sprintId}/achieve`, {});
  }

  /** Only a complete or achieved sprint. 204 = deleted (null body); 202 = sent for approval. */
  delete(sprintId: string): Observable<PendingApprovalDto | null> {
    return this.http.delete<PendingApprovalDto | null>(`${this.baseUrl}/sprints/${sprintId}`);
  }
}
