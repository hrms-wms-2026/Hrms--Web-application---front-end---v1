import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../modules/work/data-access/task-api.service';
import { NotificationItem } from './notification-api.service';

const WORK_RELATED_TYPES = new Set([
  'task',
  'task_creation_request',
  'objective_change_request',
  'allocation_extend'
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
      const commands = ['/work', nav.projectId, 'milestones', nav.objectiveId, nav.targetTab];
      const extras =
        nav.targetTab === 'board' && nav.taskId
          ? { queryParams: { highlightTaskId: nav.taskId } }
          : {};
      await this.router.navigate(commands, extras);
    } catch {
      await this.router.navigate(['/work']);
    }
  }
}
