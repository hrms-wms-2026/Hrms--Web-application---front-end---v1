import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { NotificationItem } from '../../../../core/services/notification-api.service';
import { NotificationNavigationService } from '../../../../core/services/notification-navigation.service';

const MAX_VISIBLE_NOTIFICATIONS = 4;

@Component({
  selector: 'app-dashboard-notifications-card',
  standalone: true,
  imports: [],
  templateUrl: './dashboard-notifications-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardNotificationsCardComponent implements OnInit {
  private readonly store = inject(NotificationsStore);
  private readonly navigation = inject(NotificationNavigationService);

  protected readonly items = computed(() => this.store.items().slice(0, MAX_VISIBLE_NOTIFICATIONS));
  protected readonly loading = this.store.loading;
  protected readonly unreadCount = this.store.unreadCount;

  ngOnInit(): void {
    void this.store.loadMine();
  }

  protected async onItemClicked(item: NotificationItem): Promise<void> {
    await this.store.markRead(item.id);
    await this.navigation.navigate(item);
  }

  protected async onMarkAllRead(): Promise<void> {
    await this.store.markAllRead();
  }

  protected timeLabel(date: Date): string {
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}
