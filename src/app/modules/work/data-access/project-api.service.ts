import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateProjectRequestDto, CreateProjectResponseDto, EditProjectRequestDto,
  PagedResultDto, ProjectDetailDto, ProjectListItemDto
} from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto, EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../models/dto/milestone.dto';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/work/projects`;

  listMine(pageNumber: number, pageSize: number): Observable<PagedResultDto<ProjectListItemDto>> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<PagedResultDto<ProjectListItemDto>>(`${this.base}/mine`, { params });
  }

  getById(id: string): Observable<ProjectDetailDto> {
    return this.http.get<ProjectDetailDto>(`${this.base}/${id}`);
  }

  getLogoUrl(projectId: string, logoFileId: string): string {
    return `${this.base}/${projectId}/logo?v=${logoFileId}`;
  }

  create(payload: CreateProjectRequestDto): Observable<CreateProjectResponseDto> {
    const formData = new FormData();
    formData.set('categoryId', payload.categoryId);
    formData.set('name', payload.name);
    formData.set('identifier', payload.identifier);
    formData.set('description', payload.description);
    formData.set('startDate', payload.startDate);
    formData.set('targetDate', payload.targetDate);
    if (payload.releaseDate) {
      formData.set('releaseDate', payload.releaseDate);
    }
    formData.set('color', payload.color);
    formData.set('actualHours', String(payload.actualHours));
    formData.set('defaultObjectiveAllocatedHours', String(payload.defaultObjectiveAllocatedHours));
    if (payload.logoFile) {
      formData.set('logo', payload.logoFile);
    }
    if (payload.bannerFile) {
      formData.set('banner', payload.bannerFile);
    }
    return this.http.post<CreateProjectResponseDto>(this.base, formData);
  }

  edit(id: string, payload: EditProjectRequestDto): Observable<ProjectDetailDto> {
    return this.http.put<ProjectDetailDto>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  achieve(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/achieve`, {});
  }

  unachieve(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/unachieve`, {});
  }

  getMyMilestones(projectId: string): Observable<MyProjectMilestoneDto[]> {
    return this.http.get<MyProjectMilestoneDto[]>(`${this.base}/${projectId}/objectives/mine`);
  }

  getObjectiveById(id: string): Observable<ObjectiveDetailDto> {
    return this.http.get<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives/${id}`);
  }

  editObjective(id: string, payload: EditObjectiveRequestDto): Observable<HttpResponse<ObjectiveDetailDto>> {
    return this.http.put<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives/${id}`, payload, { observe: 'response' });
  }

  achieveObjective(id: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${environment.apiUrl}/work/objectives/${id}/achieve`, {}, { observe: 'response' });
  }

  unachieveObjective(id: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${environment.apiUrl}/work/objectives/${id}/unachieve`, {}, { observe: 'response' });
  }

  getMilestoneSubtree(objectiveId: string): Observable<ObjectiveSubtreeResponseDto> {
    return this.http.get<ObjectiveSubtreeResponseDto>(`${environment.apiUrl}/work/objectives/${objectiveId}/tree`);
  }

  createObjective(payload: CreateObjectiveRequestDto): Observable<ObjectiveDetailDto> {
    return this.http.post<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives`, payload);
  }
}
