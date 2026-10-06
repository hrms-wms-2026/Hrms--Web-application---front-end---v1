import { Component, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { TrayPresenceStore } from '../../../../core/tray-presence/state/tray-presence.store';
import { tenantWorkspaceReady } from '../../../../core/tray-presence/utils/tenant-workspace-ready';
import { NotificationItem } from '../../../../core/services/notification-api.service';
import { NotificationNavigationService } from '../../../../core/services/notification-navigation.service';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { WorkApprovalsApiService } from '../../../../modules/work/data-access/work-approvals-api.service';
import {
  NotificationDecisionState,
  NotificationDropdownComponent,
  isInvitationNotification
} from './notification-dropdown/notification-dropdown.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [PopoverComponent, NotificationDropdownComponent],
  template: `
    <app-popover [open]="isOpen()" ariaLabel="Notifications" (closed)="close()">
      <button
        type="button"
        popover-trigger
        class="notification-bell__btn"
        aria-label="Notifications"
        title="Notifications"
        (click)="toggle()"
        data-testid="notification-bell"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        @if (store.unreadCount() > 0) {
          <span class="notification-bell__badge" aria-hidden="true" data-testid="notification-badge">
            {{ store.unreadCount() > 9 ? '9+' : store.unreadCount() }}
          </span>
        }
      </button>

      <div popover-panel>
        <app-notification-dropdown
          [items]="store.items()"
          [pendingIds]="pendingDecisionIds()"
          [decisions]="decisions()"
          (itemClicked)="onItemClicked($event)"
          (approveClicked)="onApprove($event)"
          (rejectClicked)="onReject($event)"
          (markAllRead)="onMarkAllRead()"
        />
      </div>
    </app-popover>
  `,
  styles: [`
    .notification-bell__btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: 1px solid transparent;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      cursor: pointer;
    }
    .notification-bell__btn:hover {
      background: var(--color-border);
      color: var(--color-text-primary);
    }
    .notification-bell__badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 14px;
      height: 14px;
      padding: 0 3px;
      border-radius: 999px;
      background: var(--color-danger);
      color: var(--color-surface);
      font-size: 9px;
      line-height: 14px;
      text-align: center;
      border: 1.5px solid var(--color-surface);
    }
  `]
})
export class NotificationBellComponent implements OnDestroy {
  protected readonly store = inject(NotificationsStore);
  private readonly navigation = inject(NotificationNavigationService);
  private readonly permissionService = inject(PermissionService);
  private readonly trayPresence = inject(TrayPresenceStore);
  private readonly authStore = inject(AuthStore);
  private readonly workApprovalsApi = inject(WorkApprovalsApiService);

  protected readonly isOpen = signal(false);
  protected readonly pendingDecisionIds = signal<ReadonlySet<string>>(new Set());
  protected readonly decisions = signal<ReadonlyMap<string, NotificationDecisionState>>(new Map());
  private pollId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const unlocked = tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence);
      untracked(() => {
        if (unlocked) this.startPolling();
        else this.stopPolling();
      });
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private startPolling(): void {
    if (this.pollId) return;
    void this.store.refreshUnreadCount();
    this.pollId = setInterval(() => void this.store.refreshUnreadCount(), 60_000);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) void this.openAndClear();
  }

  // Opening the panel is the "I've seen these" signal - clear the unread badge
  // right away instead of waiting for a separate "Mark all read" click.
  private async openAndClear(): Promise<void> {
    await this.store.loadMine();
    await this.store.markAllRead();
  }

  close(): void {
    this.isOpen.set(false);
  }

  async onItemClicked(item: NotificationItem): Promise<void> {
    await this.store.markRead(item.id);
    this.close();
    await this.navigation.navigate(item);
  }

  async onMarkAllRead(): Promise<void> {
    await this.store.markAllRead();
  }

  async onApprove(item: NotificationItem): Promise<void> {
    const call = isInvitationNotification(item)
      ? () => this.workApprovalsApi.acceptObjectiveInvitation(item.relatedEntityId!)
      : () => this.workApprovalsApi.approveWorkApproval(item.relatedEntityId!);
    await this.decide(item, call, 'approved');
  }

  async onReject(item: NotificationItem): Promise<void> {
    const call = isInvitationNotification(item)
      ? () => this.workApprovalsApi.rejectObjectiveInvitation(item.relatedEntityId!)
      : () => this.workApprovalsApi.rejectWorkApproval(item.relatedEntityId!);
    await this.decide(item, call, 'rejected');
  }

  private async decide(
    item: NotificationItem,
    call: () => Observable<unknown>,
    successState: NotificationDecisionState
  ): Promise<void> {
    if (!item.relatedEntityId || this.pendingDecisionIds().has(item.id)) return;

    this.pendingDecisionIds.update(ids => new Set(ids).add(item.id));
    try {
      await firstValueFrom(call());
      this.decisions.update(map => new Map(map).set(item.id, successState));
      if (!item.isRead) await this.store.markRead(item.id);
    } catch {
      // Already decided/cancelled by someone else, or no longer the approver - surface it inline.
      this.decisions.update(map => new Map(map).set(item.id, 'error'));
    } finally {
      this.pendingDecisionIds.update(ids => {
        const next = new Set(ids);
        next.delete(item.id);
        return next;
      });
    }
  }
}
