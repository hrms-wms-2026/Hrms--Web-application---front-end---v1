import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { NotificationItem } from '../../../../core/services/notification-api.service';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { NotificationDropdownComponent } from './notification-dropdown/notification-dropdown.component';

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
          (itemClicked)="onItemClicked($event)"
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
export class NotificationBellComponent implements OnInit, OnDestroy {
  protected readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  protected readonly isOpen = signal(false);
  private pollId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    void this.store.refreshUnreadCount();
    this.pollId = setInterval(() => void this.store.refreshUnreadCount(), 60_000);
  }

  ngOnDestroy(): void {
    if (this.pollId) clearInterval(this.pollId);
  }

  toggle(): void {
    const next = !this.isOpen();
    this.isOpen.set(next);
    if (next) void this.store.loadMine();
  }

  close(): void {
    this.isOpen.set(false);
  }

  async onItemClicked(item: NotificationItem): Promise<void> {
    await this.store.markRead(item.id);
    this.close();
    const path = this.resolveNavigation(item);
    if (path) await this.router.navigate(path);
  }

  async onMarkAllRead(): Promise<void> {
    await this.store.markAllRead();
  }

  private resolveNavigation(item: NotificationItem): string[] | null {
    const type = item.relatedEntityType;
    if (
      type === 'objective_change_request'
      || type === 'allocation_extend'
      || type === 'task_creation_request'
    ) {
      // Approvals is nested under a milestone; without project context land on Work list.
      // Callers with deep links can refine later once relatedEntity carries project/objective ids.
      return ['/work'];
    }
    if (type === 'task') {
      return ['/work'];
    }
    return ['/work'];
  }
}