import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AllocationRequestDto, EditObjectiveRequestPayloadDto, ObjectiveChangeRequestDto } from '../models/dto/allocation-request.dto';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { TaskCreationRequestDto } from '../models/dto/task-creation-request.dto';
import { ObjectiveMemberApiService } from './objective-member-api.service';

@Injectable({ providedIn: 'root' })
export class WorkApprovalsApiService {
  private readonly http = inject(HttpClient);
  private readonly memberApi = inject(ObjectiveMemberApiService);
  private readonly workBase = `${environment.apiUrl}/work`;

  getMyTaskCreationRequests(): Observable<TaskCreationRequestDto[]> {
    return this.http.get<TaskCreationRequestDto[]>(`${this.workBase}/task-creation-requests/mine`);
  }

  approveTaskCreationRequest(id: string): Observable<unknown> {
    return this.http.post(`${this.workBase}/task-creation-requests/${id}/approve`, {});
  }

  rejectTaskCreationRequest(id: string, comment: string): Observable<void> {
    return this.http.post<void>(`${this.workBase}/task-creation-requests/${id}/reject`, { comment });
  }

  getMyObjectiveChangeRequests(): Observable<ObjectiveChangeRequestDto[]> {
    return this.http.get<ObjectiveChangeRequestDto[]>(`${this.workBase}/objectives/change-requests/mine`).pipe(
      map((items) => items.filter((i) => i.requestType !== 'extend_allocation'))
    );
  }

  getMyAllocationRequests(): Observable<AllocationRequestDto[]> {
    return this.http.get<ObjectiveChangeRequestDto[]>(`${this.workBase}/objectives/change-requests/mine`).pipe(
      map((items) =>
        items
          .filter((i) => i.requestType === 'extend_allocation')
          .map((i) => this.toAllocationRequest(i))
      )
    );
  }

  createAllocationRequest(
    objectiveId: string,
    payload: { requestedAdditionalHours: number; reason: string }
  ): Observable<unknown> {
    return this.http.post(
      `${this.workBase}/objectives/${objectiveId}/allocation-requests`,
      payload
    );
  }

  approveObjectiveChangeRequest(id: string, approvedEdit?: EditObjectiveRequestPayloadDto): Observable<void> {
    return this.http.post<void>(`${this.workBase}/objectives/change-requests/${id}/approve`, approvedEdit ?? {});
  }

  rejectObjectiveChangeRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.workBase}/objectives/change-requests/${id}/reject`, {});
  }

  approveAllocationRequest(id: string, approvedAdditionalHours: number): Observable<void> {
    return this.http.post<void>(
      `${this.workBase}/objectives/change-requests/${id}/approve`,
      { approvedAdditionalHours }
    );
  }

  rejectAllocationRequest(id: string): Observable<void> {
    return this.rejectObjectiveChangeRequest(id);
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

  private toAllocationRequest(dto: ObjectiveChangeRequestDto): AllocationRequestDto {
    let payload = { requestedAdditionalHours: 0, reason: '' };
    if (dto.payloadJson) {
      try {
        const parsed = JSON.parse(dto.payloadJson) as { requestedAdditionalHours?: number; reason?: string };
        payload = {
          requestedAdditionalHours: parsed.requestedAdditionalHours ?? 0,
          reason: parsed.reason ?? ''
        };
      } catch {
        /* keep defaults */
      }
    }
    return {
      id: dto.id,
      objectiveId: dto.objectiveId,
      requestType: 'extend_allocation',
      status: dto.status,
      payload,
      createdAt: dto.createdAt
    };
  }
}
