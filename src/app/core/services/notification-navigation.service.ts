import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../modules/work/data-access/task-api.service';
import { NotificationItem } from './notification-api.service';

const WORK_RELATED_TYPES = new Set([
  'task',
  'task_creation_request',
  'task_edit_request',
  'work_approval_request',
  'objective_change_request',
  'allocation_extend',
  'project_member_invitation',
  'task_status_change_request'
]);

/** Where a notification click should take the viewer - shared by the top-navbar bell dropdown
 * and the dashboard Notifications card so both navigate identically. */
@Injectable({ providedIn: 'root' })
export class NotificationNavigationService {
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);

  async navigate(item: NotificationItem): Promise<void> {
    if (item.isNavigable && item.destinationKey === 'attendance_correction_approval' && item.attendanceCorrectionId) {
      await this.router.navigate(['/attendance/time-tracking'], {
        queryParams: { view: 'team', type: 'corrections', requestId: item.attendanceCorrectionId }
      });
      return;
    }

    if (item.isNavigable && item.destinationKey === 'work_area_change_approval' && item.workAreaChangeRequestId) {
      await this.router.navigate(['/attendance/time-tracking'], {
        queryParams: { view: 'team', type: 'work-area', requestId: item.workAreaChangeRequestId }
      });
      return;
    }

    const type = item.relatedEntityType;
    const id = item.relatedEntityId;
    if (!type || !id || !WORK_RELATED_TYPES.has(type)) {
      return;
    }

    try {
      const nav = await firstValueFrom(this.taskApi.getNotificationNavigation(type, id));
      // 'board' and 'approvals' are project-level siblings of 'milestones/:milestoneId'
      // (/work/:id/board, /work/:id/approvals) - only 'tree' actually lives under
      // milestones/:objectiveId.
      const commands =
        nav.targetTab === 'board' || nav.targetTab === 'approvals'
          ? ['/work', nav.projectId, nav.targetTab]
          : ['/work', nav.projectId, 'milestones', nav.objectiveId, nav.targetTab];
      const extras =
        nav.targetTab === 'board' && nav.taskId
          ? { queryParams: { highlightTaskId: nav.taskId } }
          : nav.targetTab === 'tree'
            ? { queryParams: { openMembers: '1' } }
            : {};
      await this.router.navigate(commands, extras);
    } catch {
      await this.router.navigate(['/work']);
    }
  }
}
