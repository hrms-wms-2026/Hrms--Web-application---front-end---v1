import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PendingApprovalDto, WorkApprovalRequestDto } from '../models/dto/work-approval.dto';
import { ObjectiveMemberApiService } from './objective-member-api.service';

/** Decisions on Work approval requests and invitations (used by the notification bell, the dashboard
 * action center and the Tree tab) plus the allocation request. The request list itself is the Inbox. */
@Injectable({ providedIn: 'root' })
export class WorkApprovalsApiService {
  private readonly http = inject(HttpClient);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly workBase = `${environment.apiUrl}/work`;

  approveWorkApproval(id: string, editedPayloadJson?: string, comment?: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/approve`, { editedPayloadJson, comment });
  }

  rejectWorkApproval(id: string, comment?: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/reject`, { comment });
  }

  cancelWorkApproval(id: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/cancel`, {});
  }

  revertWorkApproval(id: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/revert`, {});
  }

  /** 200 = hours added (null body; the caller is the parent's owner or above); 202 = sent for approval. */
  createAllocationRequest(
    objectiveId: string,
    payload: { requestedAdditionalHours: number; reason: string }
  ): Observable<PendingApprovalDto | null> {
    return this.http.post<PendingApprovalDto | null>(
      `${this.workBase}/objectives/${objectiveId}/allocation-requests`,
      payload
    );
  }

  acceptObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.acceptInvitation(id);
  }

  rejectObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.rejectInvitation(id);
  }

  cancelObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.cancelInvitation(id);
  }
}
