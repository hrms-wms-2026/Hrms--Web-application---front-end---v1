import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateDepartmentRequest,
  DepartmentArchiveDependencyResponse,
  DepartmentListPageResponse,
  DepartmentResponse,
  DepartmentTreeResponse,
  ListDepartmentsQueryParams,
  UpdateDepartmentRequest
} from '../models/department.model';

@Injectable({ providedIn: 'root' })
export class DepartmentApiService {
  private readonly http = inject(HttpClient);

  listFlat(
    legalEntityId: string,
    params?: ListDepartmentsQueryParams
  ): Observable<DepartmentListPageResponse> {
    let httpParams = new HttpParams().set('view', 'flat');
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.includeInactive !== undefined) httpParams = httpParams.set('includeInactive', params.includeInactive);
      if (params.parentDepartmentId) httpParams = httpParams.set('parentDepartmentId', params.parentDepartmentId);
      if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
      if (params.sortDirection) httpParams = httpParams.set('sortDirection', params.sortDirection);
      if (params.page) httpParams = httpParams.set('page', params.page);
      if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
    }
    return this.http.get<DepartmentListPageResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments`,
      { params: httpParams }
    );
  }

  listTree(
    legalEntityId: string,
    params?: Pick<ListDepartmentsQueryParams, 'search' | 'includeInactive'>
  ): Observable<DepartmentTreeResponse> {
    let httpParams = new HttpParams().set('view', 'tree');
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.includeInactive !== undefined) httpParams = httpParams.set('includeInactive', params.includeInactive);
    }
    return this.http.get<DepartmentTreeResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments`,
      { params: httpParams }
    );
  }

  getDepartment(legalEntityId: string, departmentId: string): Observable<DepartmentResponse> {
    return this.http.get<DepartmentResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments/${departmentId}`
    );
  }

  createDepartment(
    legalEntityId: string,
    payload: CreateDepartmentRequest
  ): Observable<DepartmentResponse> {
    return this.http.post<DepartmentResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments`,
      payload
    );
  }

  updateDepartment(
    legalEntityId: string,
    departmentId: string,
    payload: UpdateDepartmentRequest
  ): Observable<DepartmentResponse> {
    return this.http.put<DepartmentResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments/${departmentId}`,
      payload
    );
  }

  checkArchive(
    legalEntityId: string,
    departmentId: string
  ): Observable<DepartmentArchiveDependencyResponse> {
    return this.http.post<DepartmentArchiveDependencyResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments/${departmentId}/archive-check`,
      {}
    );
  }

  archiveDepartment(legalEntityId: string, departmentId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments/${departmentId}/archive`,
      {}
    );
  }

  restoreDepartment(legalEntityId: string, departmentId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/departments/${departmentId}/restore`,
      {}
    );
  }
}
