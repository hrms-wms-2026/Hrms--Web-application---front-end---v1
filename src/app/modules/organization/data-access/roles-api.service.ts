import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AssignRolePermissionsRequest,
  CreateRoleRequest,
  PermissionCatalogResponse,
  RoleDetailResponse,
  RoleSummaryResponse,
  UpdateRoleRequest
} from '../models/role.model';

@Injectable({ providedIn: 'root' })
export class RolesApiService {
  private readonly http = inject(HttpClient);

  getRoles(): Observable<readonly RoleSummaryResponse[]> {
    return this.http.get<readonly RoleSummaryResponse[]>(`${environment.apiUrl}/roles`);
  }

  getRole(id: string): Observable<RoleDetailResponse> {
    return this.http.get<RoleDetailResponse>(`${environment.apiUrl}/roles/${id}`);
  }

  createRole(payload: CreateRoleRequest): Observable<RoleDetailResponse> {
    return this.http.post<RoleDetailResponse>(`${environment.apiUrl}/roles`, payload);
  }

  updateRole(id: string, payload: UpdateRoleRequest): Observable<RoleDetailResponse> {
    return this.http.patch<RoleDetailResponse>(`${environment.apiUrl}/roles/${id}`, payload);
  }

  archiveRole(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/roles/${id}`);
  }

  assignPermissions(id: string, payload: AssignRolePermissionsRequest): Observable<RoleDetailResponse> {
    return this.http.put<RoleDetailResponse>(`${environment.apiUrl}/roles/${id}/permissions`, payload);
  }

  getPermissionCatalog(): Observable<PermissionCatalogResponse> {
    return this.http.get<PermissionCatalogResponse>(`${environment.apiUrl}/permissions`);
  }
}
