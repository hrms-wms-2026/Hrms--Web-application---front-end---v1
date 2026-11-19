import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  LeaveBalanceAuditListFilter,
  LeaveBalanceAuditResponse,
  LeaveEntitlementGenerationPreviewResponse,
  LeaveEntitlementGenerationResultResponse,
  LeaveEntitlementListFilter,
  LeaveEntitlementResponse,
  RecalculateEntitlementRequest
} from '../models/leave-entitlement.model';

/** Client for ONEVO.Api's LeaveEntitlementsController at /api/v1/leave/entitlements. */
@Injectable({ providedIn: 'root' })
export class LeaveEntitlementApiService {
  private readonly api = inject(ApiClient);

  list(year: number, filter: LeaveEntitlementListFilter): Observable<LeaveEntitlementResponse[]> {
    return this.api.get<LeaveEntitlementResponse[]>('/leave/entitlements', {
      params: {
        year,
        legalEntityId: filter.legalEntityId,
        departmentId: filter.departmentId,
        leaveTypeId: filter.leaveTypeId,
        search: filter.search
      }
    });
  }

  previewGenerate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationPreviewResponse> {
    return this.api.post<LeaveEntitlementGenerationPreviewResponse>('/leave/entitlements/generate/preview', payload);
  }

  generate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationResultResponse> {
    return this.api.post<LeaveEntitlementGenerationResultResponse>('/leave/entitlements/generate', payload);
  }

  createManual(payload: CreateManualEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.post<LeaveEntitlementResponse>('/leave/entitlements/manual', payload);
  }

  adjust(entitlementId: string, payload: AdjustEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.put<LeaveEntitlementResponse>(`/leave/entitlements/${entitlementId}/adjust`, payload);
  }

  recalculate(entitlementId: string, payload: RecalculateEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.post<LeaveEntitlementResponse>(`/leave/entitlements/${entitlementId}/recalculate`, payload);
  }

  listBalanceAudit(filter: LeaveBalanceAuditListFilter, page: number, pageSize: number): Observable<LeaveBalanceAuditResponse[]> {
    return this.api.get<LeaveBalanceAuditResponse[]>('/leave/balance-audit', {
      params: { ...auditParams(filter), page, pageSize }
    });
  }

  exportBalanceAudit(filter: LeaveBalanceAuditListFilter): Observable<Blob> {
    return this.api.getBlob('/leave/balance-audit/export', { params: auditParams(filter) });
  }

  exportGeneratePreview(payload: GenerateEntitlementsRequest): Observable<Blob> {
    return this.api.postBlob('/leave/entitlements/generate/preview/export', payload);
  }
}

/** Key order here is the query-string order the backend and specs expect. */
function auditParams(filter: LeaveBalanceAuditListFilter): object {
  return {
    employeeId: filter.employeeId,
    leaveTypeId: filter.leaveTypeId,
    changeType: filter.changeType,
    fromDate: filter.fromDate,
    toDate: filter.toDate
  };
}
