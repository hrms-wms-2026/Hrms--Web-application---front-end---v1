import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { NotificationItem } from '../../../../../core/services/notification-api.service';

/** WM approval-request notifications can be decided right from the bell; every other
 * type (including the already-decided/commented approval notifications, which share
 * the same relatedEntityType) stays click-to-navigate only. */
const ACTIONABLE_TEMPLATE_CODE = 'work_approval_requested';

export type NotificationDecisionState = 'approved' | 'rejected' | 'error';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="notification-dropdown" data-testid="notification-dropdown">
      <div class="notification-dropdown__header">
        <span>Notifications</span>
        <button type="button" class="notification-dropdown__mark-all" (click)="markAllRead.emit()">
          Mark all read
        </button>
      </div>
      @if (items().length === 0) {
        <p class="notification-dropdown__empty">You're all caught up.</p>
      } @else {
        <ul class="notification-dropdown__list">
          @for (item of items(); track item.id) {
            <li>
              <div class="notification-dropdown__row">
                <button
                  type="button"
                  class="notification-dropdown__item"
                  [class.notification-dropdown__item--unread]="!item.isRead"
                  (click)="itemClicked.emit(item)"
                >
                  <span class="notification-dropdown__title">{{ item.title }}</span>
                  <span class="notification-dropdown__body">{{ item.body }}</span>
                  <span class="notification-dropdown__time">{{ item.createdAt | date: 'MMM d, h:mm a' }}</span>
                </button>
                @if (isActionable(item)) {
                  @if (decisionState(item.id); as decision) {
                    <span
                      class="notification-dropdown__decision"
                      [class.notification-dropdown__decision--error]="decision === 'error'"
                      data-testid="notification-decision"
                    >
                      {{ decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Already handled' }}
                    </span>
                  } @else {
                    <div class="notification-dropdown__actions">
                      <button
                        type="button"
                        class="notification-dropdown__action notification-dropdown__action--approve"
                        data-testid="notification-approve"
                        [disabled]="isPending(item.id)"
                        (click)="approveClicked.emit(item)"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        class="notification-dropdown__action notification-dropdown__action--reject"
                        data-testid="notification-reject"
                        [disabled]="isPending(item.id)"
                        (click)="rejectClicked.emit(item)"
                      >
                        Reject
                      </button>
                    </div>
                  }
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .notification-dropdown {
      width: 320px;
      max-height: 420px;
      overflow: auto;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
    }
    .notification-dropdown__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
      border-bottom: 1px solid var(--color-border);
    }
    .notification-dropdown__mark-all {
      border: none;
      background: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      font-size: 12px;
    }
    .notification-dropdown__empty {
      margin: 0;
      padding: 16px;
      font-size: 13px;
      color: var(--color-text-secondary);
    }
    .notification-dropdown__list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .notification-dropdown__row {
      display: flex;
      flex-direction: column;
      width: 100%;
      border-bottom: 1px solid var(--color-border);
    }
    .notification-dropdown__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      text-align: left;
      padding: 10px 12px 4px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--color-text-primary);
      font: inherit;
    }
    .notification-dropdown__item--unread {
      background: var(--color-surface-secondary);
    }
    .notification-dropdown__title {
      font-size: 13px;
      font-weight: 600;
    }
    .notification-dropdown__body,
    .notification-dropdown__time {
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .notification-dropdown__actions {
      display: flex;
      gap: 8px;
      padding: 0 12px 10px;
    }
    .notification-dropdown__action {
      flex: 1;
      padding: 5px 0;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .notification-dropdown__action--approve {
      color: var(--color-success, #1a7f37);
      border-color: var(--color-success, #1a7f37);
    }
    .notification-dropdown__action--reject {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }
    .notification-dropdown__action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .notification-dropdown__decision {
      padding: 0 12px 10px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary);
    }
    .notification-dropdown__decision--error {
      color: var(--color-danger);
    }
  `]
})
export class NotificationDropdownComponent {
  items = input.required<readonly NotificationItem[]>();
  pendingIds = input<ReadonlySet<string>>(new Set());
  decisions = input<ReadonlyMap<string, NotificationDecisionState>>(new Map());
  itemClicked = output<NotificationItem>();
  approveClicked = output<NotificationItem>();
  rejectClicked = output<NotificationItem>();
  markAllRead = output<void>();

  isActionable(item: NotificationItem): boolean {
    return item.templateCode === ACTIONABLE_TEMPLATE_CODE;
  }

  isPending(id: string): boolean {
    return this.pendingIds().has(id);
  }

  decisionState(id: string): NotificationDecisionState | undefined {
    return this.decisions().get(id);
  }
}
