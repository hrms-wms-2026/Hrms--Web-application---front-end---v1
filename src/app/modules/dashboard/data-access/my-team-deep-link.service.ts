import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../work/data-access/task-api.service';
import { ActionItemLink } from '../models/my-team-action-items.model';

/** The My Team attendance link types and their Inbox kinds. */
const ATTENDANCE_INBOX_KINDS: Record<string, string> = {
  corrections: 'correction', 'work-area': 'work_mode_change', location: 'location_change', 'device-change': 'device_change'
};

/** Resolves an ActionItem's {kind, params} (My Team spec §15) to an actual route. The
 * destination always re-authorizes - this never performs an action inline. */
@Injectable({ providedIn: 'root' })
export class MyTeamDeepLinkService {
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);

  async navigate(link: ActionItemLink): Promise<void> {
    switch (link.kind) {
      case 'leave.approval':
        await this.router.navigate(['/inbox', 'leave', 'request', link.params['requestId']]);
        return;

      case 'attendance.approval':
        await this.router.navigate(['/inbox', 'attendance', ATTENDANCE_INBOX_KINDS[link.params['type']] ?? 'correction', link.params['requestId']]);
        return;

      case 'monitoring.exception':
        await this.router.navigate(['/attendance/alerts'], {
          queryParams: { alertId: link.params['alertId'] }
        });
        return;

      case 'work.request':
        await this.navigateWorkRequest(link.params['relatedEntityType'], link.params['relatedEntityId']);
        return;
    }
  }

  private async navigateWorkRequest(relatedEntityType: string, relatedEntityId: string): Promise<void> {
    try {
      const nav = await firstValueFrom(this.taskApi.getNotificationNavigation(relatedEntityType, relatedEntityId));
      // 'board' and 'approvals' are project-level siblings of 'milestones/:objectiveId' - only
      // 'tree' actually lives under milestones/:objectiveId (same rule NotificationNavigationService uses).
      const commands =
        nav.targetTab === 'board' || nav.targetTab === 'approvals'
          ? ['/work', nav.projectId, nav.targetTab]
          : ['/work', nav.projectId, 'milestones', nav.objectiveId, nav.targetTab];
      // The Approvals page opens one request's detail from ?request=<id> (the work approval request
      // id the dashboard item carries); the board highlights a task.
      const extras =
        nav.targetTab === 'board' && nav.taskId
          ? { queryParams: { highlightTaskId: nav.taskId } }
          : nav.targetTab === 'approvals'
            ? { queryParams: { request: relatedEntityId } }
            : {};
      await this.router.navigate(commands, extras);
    } catch {
      await this.router.navigate(['/work']);
    }
  }
}
