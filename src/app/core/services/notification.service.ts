import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  kind: 'error' | 'success' | 'info' | 'warning';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private nextId = 0;

  error(message: string): void {
    this.push('error', message);
  }

  warning(message: string): void {
    this.push('warning', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(kind: Notification['kind'], message: string): void {
    const trimmed = message?.trim();
    if (!trimmed) return;

    const current = this.notifications();
    const last = current[current.length - 1];
    if (last && last.kind === kind && last.message === trimmed) {
      return;
    }

    const notification: Notification = { id: this.nextId++, kind, message: trimmed };
    this.notifications.update((list) => [...list, notification]);
  }
}
