import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

/** Who covers the caller's leave approvals while they are away (api/v1/leave/approval-delegates). */
export interface ApprovalDelegateDto {
  id: string;
  delegateEmployeeId: string;
  delegateName: string;
  startDate: string;
  endDate: string;
}

export interface CreateApprovalDelegateRequest {
  delegateEmployeeId: string;
  startDate: string;
  endDate: string;
}

@Injectable({ providedIn: 'root' })
export class ApprovalDelegatesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/leave/approval-delegates`;

  list(): Observable<ApprovalDelegateDto[]> {
    return this.http.get<ApprovalDelegateDto[]>(this.base);
  }

  create(request: CreateApprovalDelegateRequest): Observable<ApprovalDelegateDto> {
    return this.http.post<ApprovalDelegateDto>(this.base, request);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(id)}`);
  }
}
