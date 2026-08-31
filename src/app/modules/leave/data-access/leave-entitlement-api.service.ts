import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdjustEntitlementRequest, CreateManualEntitlementRequest, GenerateEntitlementsRequest, LeaveBalanceAuditListFilter, LeaveBalanceAuditResponse, LeaveEntitlementGenerationPreviewResponse, LeaveEntitlementGenerationResultResponse, LeaveEntitlementListFilter, LeaveEntitlementResponse, RecalculateEntitlementRequest } from '../models/leave-entitlement.model';

/** Client for ONEVO.Api's LeaveEntitlementsController at /api/v1/leave/entitlements. */
@Injectable({ providedIn: 'root' })
export class LeaveEntitlementApiService {
  private readonly http = inject(HttpClient);
  list(year: number, filter: LeaveEntitlementListFilter): Observable<LeaveEntitlementResponse[]> { let params = new HttpParams().set('year', year); if (filter.legalEntityId) params = params.set('legalEntityId', filter.legalEntityId); if (filter.departmentId) params = params.set('departmentId', filter.departmentId); if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId); if (filter.search) params = params.set('search', filter.search); return this.http.get<LeaveEntitlementResponse[]>(`${environment.apiUrl}/leave/entitlements`, { params }); }
  previewGenerate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationPreviewResponse> { return this.http.post<LeaveEntitlementGenerationPreviewResponse>(`${environment.apiUrl}/leave/entitlements/generate/preview`, payload); }
  generate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationResultResponse> { return this.http.post<LeaveEntitlementGenerationResultResponse>(`${environment.apiUrl}/leave/entitlements/generate`, payload); }
  createManual(payload: CreateManualEntitlementRequest): Observable<LeaveEntitlementResponse> { return this.http.post<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/manual`, payload); }
  adjust(entitlementId: string, payload: AdjustEntitlementRequest): Observable<LeaveEntitlementResponse> { return this.http.put<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/${entitlementId}/adjust`, payload); }
  recalculate(entitlementId: string, payload: RecalculateEntitlementRequest): Observable<LeaveEntitlementResponse> { return this.http.post<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/${entitlementId}/recalculate`, payload); }
  listBalanceAudit(filter: LeaveBalanceAuditListFilter, page: number, pageSize: number): Observable<LeaveBalanceAuditResponse[]> { let params = this.toAuditParams(filter); params = params.set('page', page).set('pageSize', pageSize); return this.http.get<LeaveBalanceAuditResponse[]>(`${environment.apiUrl}/leave/balance-audit`, { params }); }
  exportBalanceAudit(filter: LeaveBalanceAuditListFilter): Observable<Blob> { return this.http.get(`${environment.apiUrl}/leave/balance-audit/export`, { params: this.toAuditParams(filter), responseType: 'blob' }); }
  exportGeneratePreview(payload: GenerateEntitlementsRequest): Observable<Blob> { return this.http.post(`${environment.apiUrl}/leave/entitlements/generate/preview/export`, payload, { responseType: 'blob' }); }
  private toAuditParams(filter: LeaveBalanceAuditListFilter): HttpParams { let params = new HttpParams(); if (filter.employeeId) params = params.set('employeeId', filter.employeeId); if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId); if (filter.changeType) params = params.set('changeType', filter.changeType); if (filter.fromDate) params = params.set('fromDate', filter.fromDate); if (filter.toDate) params = params.set('toDate', filter.toDate); return params; }
}
