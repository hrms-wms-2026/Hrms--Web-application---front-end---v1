import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  kind: 'error' | 'success' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private nextId = 0;

  error(message: string): void {
    this.push('error', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(kind: Notification['kind'], message: string): void {
    const notification: Notification = { id: this.nextId++, kind, message };
    this.notifications.update((list) => [...list, notification]);
  }
}
