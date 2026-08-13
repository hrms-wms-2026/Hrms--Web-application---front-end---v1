import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Notification, NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastHostComponent implements OnDestroy {
  readonly notificationService = inject(NotificationService);
  private readonly activeTimers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly notifications = this.notificationService.notifications;

  constructor() {
    effect(() => {
      const list = this.notifications();
      const currentIds = new Set(list.map((n) => n.id));

      // Schedule timers for newly added notifications
      for (const toast of list) {
        if (!this.activeTimers.has(toast.id)) {
          const duration = toast.kind === 'error' || toast.kind === 'warning' ? 8000 : 5000;
          const timer = setTimeout(() => {
            this.dismiss(toast.id);
          }, duration);
          this.activeTimers.set(toast.id, timer);
        }
      }

      // Clean up timers for removed notifications
      for (const [id, timer] of Array.from(this.activeTimers.entries())) {
        if (!currentIds.has(id)) {
          clearTimeout(timer);
          this.activeTimers.delete(id);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  getRole(kind: Notification['kind']): string {
    return kind === 'error' ? 'alert' : 'status';
  }

  getAriaLive(kind: Notification['kind']): 'assertive' | 'polite' {
    return kind === 'error' ? 'assertive' : 'polite';
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.notificationService.dismiss(id);
  }

  private clearTimer(id: number): void {
    const timer = this.activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(id);
    }
  }

  private clearAllTimers(): void {
    this.activeTimers.forEach((timer) => clearTimeout(timer));
    this.activeTimers.clear();
  }
}
