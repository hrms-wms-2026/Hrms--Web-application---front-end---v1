import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CompleteSprintRequestDto, CreateSprintRequestDto, EditSprintRequestDto, SetSprintTasksRequestDto,
  SprintActivityDto, SprintDto, StartSprintRequestDto
} from '../models/dto/sprint.dto';

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

  create(projectId: string, request: CreateSprintRequestDto): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/projects/${projectId}/sprints`, request);
  }

  setTasks(sprintId: string, request: SetSprintTasksRequestDto): Observable<SprintDto> {
    return this.http.put<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/tasks`, request);
  }

  getActivity(sprintId: string): Observable<SprintActivityDto[]> {
    return this.http.get<SprintActivityDto[]>(`${this.baseUrl}/sprints/${sprintId}/activity`);
  }

  start(sprintId: string, request: StartSprintRequestDto): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/start`, request);
  }

  edit(sprintId: string, request: EditSprintRequestDto): Observable<SprintDto> {
    return this.http.patch<SprintDto>(`${this.baseUrl}/sprints/${sprintId}`, request);
  }

  complete(sprintId: string, request: CompleteSprintRequestDto): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/complete`, request);
  }

  achieve(sprintId: string): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/achieve`, {});
  }
}
