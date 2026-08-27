import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateSprintRequestDto, EditSprintRequestDto, SprintDto } from '../models/dto/sprint.dto';
import { SprintStatus } from '../models/sprint.model';

@Injectable({ providedIn: 'root' })
export class SprintApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getByObjective(objectiveId: string, activeOnly: boolean): Observable<SprintDto[]> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<SprintDto[]>(`${this.baseUrl}/objectives/${objectiveId}/sprints`, { params });
  }

  create(objectiveId: string, request: CreateSprintRequestDto): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/objectives/${objectiveId}/sprints`, request);
  }

  edit(sprintId: string, request: EditSprintRequestDto): Observable<SprintDto> {
    return this.http.patch<SprintDto>(`${this.baseUrl}/sprints/${sprintId}`, request);
  }

  complete(sprintId: string): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/complete`, {});
  }

  achieve(sprintId: string): Observable<SprintDto> {
    return this.http.post<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/achieve`, {});
  }

  setStatus(sprintId: string, status: SprintStatus): Observable<SprintDto> {
    return this.http.patch<SprintDto>(`${this.baseUrl}/sprints/${sprintId}/status`, { status });
  }
}
