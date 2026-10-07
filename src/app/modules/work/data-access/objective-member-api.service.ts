import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ObjectiveMemberListDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { AddObjectiveMemberOutcomeDto, RemoveObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto } from '../models/dto/milestone.dto';

@Injectable({ providedIn: 'root' })
export class ObjectiveMemberApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/work/objectives`;

  getMembers(objectiveId: string): Observable<ObjectiveMemberListDto> {
    return this.http.get<ObjectiveMemberListDto>(`${this.base}/${objectiveId}/members`);
  }

  addMember(objectiveId: string, employeeId: string): Observable<HttpResponse<AddObjectiveMemberOutcomeDto>> {
    return this.http.post<AddObjectiveMemberOutcomeDto>(
      `${this.base}/${objectiveId}/members`, { employeeId }, { observe: 'response' });
  }

  removeMember(objectiveId: string, employeeId: string): Observable<HttpResponse<RemoveObjectiveMemberOutcomeDto>> {
    return this.http.delete<RemoveObjectiveMemberOutcomeDto>(`${this.base}/${objectiveId}/members/${employeeId}`, { observe: 'response' });
  }

  getMyInvitations(): Observable<ObjectiveInvitationDto[]> {
    return this.http.get<ObjectiveInvitationDto[]>(`${this.base}/invitations/mine`);
  }

  acceptInvitation(invitationId: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${this.base}/invitations/${invitationId}/accept`, {}, { observe: 'response' });
  }

  rejectInvitation(invitationId: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${this.base}/invitations/${invitationId}/reject`, {}, { observe: 'response' });
  }

  cancelInvitation(invitationId: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${this.base}/invitations/${invitationId}/cancel`, {}, { observe: 'response' });
  }

  transferHead(objectiveId: string, newHeadEmployeeId: string): Observable<HttpResponse<TransferObjectiveHeadOutcomeDto>> {
    return this.http.post<TransferObjectiveHeadOutcomeDto>(
      `${this.base}/${objectiveId}/transfer`, { newHeadEmployeeId }, { observe: 'response' });
  }
}
