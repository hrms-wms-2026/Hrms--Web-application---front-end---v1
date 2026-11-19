import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EXCEPTION_ALERT_ENTITY_TYPE } from '../../shared/models/exception-evidence.model';
import { TaskApiService } from '../../modules/work/data-access/task-api.service';
import { NotificationItem } from './notification-api.service';

const WORK_RELATED_TYPES = new Set([
  'task',
  'task_creation_request',
  'task_edit_request',
  'objective_change_request',
  'allocation_extend',
  'task_status_change_request',
  // The approval engine's direct-change notices point at the module or sprint itself.
  'module',
  'sprint'
]);

/** Work requests, invitations and monitor alerts live in the Inbox: type → the item's inbox kind. */
const INBOX_WORK_KINDS: Record<string, string> = {
  work_approval_request: 'approval',
  project_member_invitation: 'invitation',
  monitor_alert: 'monitor_alert'
};
const INBOX_TYPE_PREFIX = 'inbox:';

/** Replies and status changes from Crownus support point at the ticket in Settings > Support. */
const SUPPORT_TICKET_ENTITY_TYPE = 'support_ticket';

/** Where a notification click should take the viewer - shared by the top-navbar bell dropdown
 * and the dashboard Notifications card so both navigate identically. */
@Injectable({ providedIn: 'root' })
export class NotificationNavigationService {
  private readonly router = inject(Router);
  private readonly taskApi = inject(TaskApiService);

  async navigate(item: NotificationItem): Promise<void> {
    // Approvers review attendance requests in the Inbox.
    if (item.isNavigable && item.destinationKey === 'attendance_correction_approval' && item.attendanceCorrectionId) {
      await this.router.navigate(['/inbox', 'attendance', 'correction', item.attendanceCorrectionId]);
      return;
    }

    if (item.isNavigable && item.destinationKey === 'work_area_change_approval' && item.workAreaChangeRequestId) {
      await this.router.navigate(['/inbox', 'attendance', 'work_mode_change', item.workAreaChangeRequestId]);
      return;
    }

    // Calendar integration health (re-authorize, sync conflict, failed connection) is fixed in Settings > Calendar Sync.
    if (item.templateCode?.startsWith('calendar_connection_')) {
      await this.router.navigate(['/settings/calendar-connections']);
      return;
    }

    const type = item.relatedEntityType;
    const id = item.relatedEntityId;

    // Conversation notices (mentions, added to a chat) carry "inbox:{source}:{kind}".
    if (type?.startsWith(INBOX_TYPE_PREFIX) && id) {
      const [source, kind] = type.slice(INBOX_TYPE_PREFIX.length).split(':');
      if (source && kind) await this.router.navigate(['/inbox', source, kind, id]);
      return;
    }

    if (type && id && INBOX_WORK_KINDS[type]) {
      await this.router.navigate(['/inbox', 'work', INBOX_WORK_KINDS[type], id]);
      return;
    }

    if (type === SUPPORT_TICKET_ENTITY_TYPE && id) {
      await this.router.navigate(['/settings', 'support', id]);
      return;
    }

    if (type === EXCEPTION_ALERT_ENTITY_TYPE && id) {
      // Older notices about a monitoring exception case open it in the Inbox.
      await this.router.navigate(['/inbox', 'monitoring', 'exception_case', id]);
      return;
    }

    // The backend only marks the *_request_created notice (sent to the approver) as navigable -
    // the *_request_decided/_cancelled notice sent back to the requester has isNavigable: false
    // but still carries this relatedEntityType, so it otherwise falls through and does nothing.
    if (type === 'attendance_correction' || type === 'work_area_change_request') {
      await this.router.navigate(['/attendance']);
      return;
    }

    if (!type || !id || !WORK_RELATED_TYPES.has(type)) {
      return;
    }

    try {
      const nav = await firstValueFrom(this.taskApi.getNotificationNavigation(type, id));
      // Approvals moved to the Inbox; any older request type still answered with 'approvals' goes there.
      if (nav.targetTab === 'approvals') {
        await this.router.navigate(['/inbox']);
        return;
      }
      // 'board' is a project-level sibling of 'milestones/:milestoneId' (/work/:id/board) - only
      // 'tree' actually lives under milestones/:objectiveId.
      const commands =
        nav.targetTab === 'board'
          ? ['/work', nav.projectId, nav.targetTab]
          : ['/work', nav.projectId, 'milestones', nav.objectiveId, nav.targetTab];
      const extras = nav.targetTab === 'board' && nav.taskId ? { queryParams: { highlightTaskId: nav.taskId } } : {};
      await this.router.navigate(commands, extras);
    } catch {
      await this.router.navigate(['/work']);
    }
  }
}
