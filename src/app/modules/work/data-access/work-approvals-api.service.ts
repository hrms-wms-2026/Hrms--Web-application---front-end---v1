import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { PendingApprovalDto, WorkApprovalRequestDto } from '../models/dto/work-approval.dto';
import { ObjectiveMemberApiService } from './objective-member-api.service';
import { ApprovalHistoryItemDto } from '../models/dto/approval-history.dto';

@Injectable({ providedIn: 'root' })
export class WorkApprovalsApiService {
  private readonly http = inject(HttpClient);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly workBase = `${environment.apiUrl}/work`;

  getApprovalHistory(projectId: string): Observable<ApprovalHistoryItemDto[]> {
    return this.http.get<ApprovalHistoryItemDto[]>(
      `${this.workBase}/projects/${projectId}/approval-history`
    );
  }

  /** Unified approval engine: requests waiting on the caller (inbox) or made by the caller (mine). */
  getProjectApprovals(projectId: string, scope: 'inbox' | 'mine' = 'inbox'): Observable<WorkApprovalRequestDto[]> {
    return this.http.get<WorkApprovalRequestDto[]>(`${this.workBase}/projects/${projectId}/approvals`, { params: { scope } });
  }

  approveWorkApproval(id: string, editedPayloadJson?: string, comment?: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/approve`, { editedPayloadJson, comment });
  }

  rejectWorkApproval(id: string, comment?: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/reject`, { comment });
  }

  cancelWorkApproval(id: string): Observable<WorkApprovalRequestDto> {
    return this.http.post<WorkApprovalRequestDto>(`${this.workBase}/approvals/${id}/cancel`, {});
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

  getMyObjectiveInvitations(): Observable<ObjectiveInvitationDto[]> {
    return this.memberApi.getMyInvitations();
  }

  acceptObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.acceptInvitation(id);
  }

  rejectObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.rejectInvitation(id);
  }
}
