import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, map } from 'rxjs';
import { DeviceChangeRequestApiService } from '../../attendance/data-access/device-change-request-api.service';
import { LocationChangeRequestApiService } from '../../attendance/data-access/location-change-request-api.service';
import { TimeTrackingApiService } from '../../attendance/data-access/time-tracking-api.service';
import { LeaveApprovalApiService } from '../../leave/data-access/leave-approval-api.service';
import { WorkApprovalsApiService } from '../../work/data-access/work-approvals-api.service';

export type ApprovalDecision = 'approve' | 'reject';

/** Sources whose reject needs a reason on their own approval page - the inbox asks for one too. */
const REASON_REQUIRED_ON_REJECT = new Set([
  'leave.approval',
  'attendance.correction',
  'attendance.work_area',
  'attendance.location',
  'attendance.device_change'
]);

const DECIDABLE = new Set([
  ...REASON_REQUIRED_ON_REJECT,
  'work.task_creation',
  'work.task_edit',
  'work.objective_change',
  'work.status_template_change'
]);

/** Max characters for a comment / reject reason, as on the attendance approval pages. */
export const DECISION_COMMENT_MAX = 2000;

export function canDecideInline(sourceKey: string): boolean {
  return DECIDABLE.has(sourceKey);
}

export function rejectReasonRequired(sourceKey: string): boolean {
  return REASON_REQUIRED_ON_REJECT.has(sourceKey);
}

/**
 * Approves or rejects an Action Center approval from the dashboard through each module's existing
 * API - the same calls and payload shapes the dedicated approval pages make, so the backend's
 * authorization and workflow rules apply unchanged. `entityId` is the ActionItem's entityId, which
 * every source sets to that API's own request id (work sources: the unified WorkApprovalRequest).
 */
@Injectable({ providedIn: 'root' })
export class ActionCenterDecisionService {
  private readonly leave = inject(LeaveApprovalApiService);
  private readonly timeTracking = inject(TimeTrackingApiService);
  private readonly device = inject(DeviceChangeRequestApiService);
  private readonly location = inject(LocationChangeRequestApiService);
  private readonly work = inject(WorkApprovalsApiService);

  /** `comment` is the optional approve comment or the reject reason. */
  decide(sourceKey: string, entityId: string, decision: ApprovalDecision, comment: string | null): Promise<void> {
    return firstValueFrom(this.request(sourceKey, entityId, decision, comment).pipe(map(() => undefined)));
  }

  private request(sourceKey: string, id: string, decision: ApprovalDecision, comment: string | null): Observable<unknown> {
    const approve = decision === 'approve';
    switch (sourceKey) {
      case 'leave.approval':
        return approve ? this.leave.approve(id, { comment }) : this.leave.reject(id, { reason: comment ?? '' });
      case 'attendance.correction':
        return approve
          ? this.timeTracking.approveCorrection(id, { reviewComment: comment })
          : this.timeTracking.rejectCorrection(id, { reviewComment: comment ?? '' });
      case 'attendance.work_area':
        return approve
          ? this.timeTracking.approveWorkAreaChangeRequest(id, comment)
          : this.timeTracking.rejectWorkAreaChangeRequest(id, comment ?? '');
      case 'attendance.location':
        return approve ? this.location.approve(id, comment) : this.location.reject(id, comment ?? '');
      case 'attendance.device_change':
        return approve ? this.device.approve(id, comment) : this.device.reject(id, comment ?? '');
      case 'work.task_creation':
      case 'work.task_edit':
      case 'work.objective_change':
      case 'work.status_template_change':
        return approve
          ? this.work.approveWorkApproval(id, undefined, comment ?? undefined)
          : this.work.rejectWorkApproval(id, comment ?? undefined);
      default:
        throw new Error(`No approval API for ${sourceKey}.`);
    }
  }
}
