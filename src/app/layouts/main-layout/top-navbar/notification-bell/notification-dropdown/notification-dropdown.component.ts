import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { NotificationItem } from '../../../../../core/services/notification-api.service';

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
    .notification-dropdown__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      width: 100%;
      text-align: left;
      padding: 10px 12px;
      border: none;
      border-bottom: 1px solid var(--color-border);
      background: transparent;
      cursor: pointer;
      color: var(--color-text-primary);
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
  `]
})
export class NotificationDropdownComponent {
  items = input.required<readonly NotificationItem[]>();
  itemClicked = output<NotificationItem>();
  markAllRead = output<void>();
}
