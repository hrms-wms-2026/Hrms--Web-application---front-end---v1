import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PendingApprovalDto, WorkApprovalRequestDto } from '../models/dto/work-approval.dto';
import { ObjectiveMemberApiService } from './objective-member-api.service';
import {
  ApprovalCommentDto,
  ApprovalCommentSubjectType,
  ApprovalDetailDto,
  ApprovalFeedItemDto,
  ApprovalFeedSource
} from '../models/dto/approval-feed.dto';

@Injectable({ providedIn: 'root' })
export class WorkApprovalsApiService {
  private readonly http = inject(HttpClient);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly workBase = `${environment.apiUrl}/work`;

  /** Every request the caller sent or received in the project (engine requests + module invitations), pending first. */
  getApprovalFeed(projectId: string): Observable<ApprovalFeedItemDto[]> {
    return this.http.get<ApprovalFeedItemDto[]>(`${this.workBase}/projects/${projectId}/approval-feed`);
  }

  getApprovalDetail(id: string, source: ApprovalFeedSource): Observable<ApprovalDetailDto> {
    return this.http.get<ApprovalDetailDto>(`${this.workBase}/approvals/${id}`, { params: { source } });
  }

  getApprovalComments(subjectType: ApprovalCommentSubjectType, subjectId: string): Observable<ApprovalCommentDto[]> {
    return this.http.get<ApprovalCommentDto[]>(`${this.workBase}/approval-comments`, { params: { subjectType, subjectId } });
  }

  createApprovalComment(subjectType: ApprovalCommentSubjectType, subjectId: string, content: string): Observable<ApprovalCommentDto> {
    return this.http.post<ApprovalCommentDto>(`${this.workBase}/approval-comments`, { subjectType, subjectId, content });
  }

  replyApprovalComment(parentId: string, content: string): Observable<ApprovalCommentDto> {
    return this.http.post<ApprovalCommentDto>(`${this.workBase}/approval-comments/${parentId}/replies`, { content });
  }

  editApprovalComment(id: string, content: string): Observable<ApprovalCommentDto> {
    return this.http.patch<ApprovalCommentDto>(`${this.workBase}/approval-comments/${id}`, { content });
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

  acceptObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.acceptInvitation(id);
  }

  rejectObjectiveInvitation(id: string): Observable<unknown> {
    return this.memberApi.rejectInvitation(id);
  }
}
