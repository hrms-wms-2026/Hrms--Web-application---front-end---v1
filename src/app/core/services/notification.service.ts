import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  kind: 'error' | 'success' | 'info' | 'warning';
  message: string;
  /** Support reference (the request's correlation id) shown on an error toast with a copy button. */
  reference?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private nextId = 0;

  /** `reference`: the failed request's correlation id, shown so the user can quote it to support. */
  error(message: string, reference?: string): void {
    this.push('error', message, reference);
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

  private push(kind: Notification['kind'], message: string, reference?: string): void {
    const trimmed = message?.trim();
    if (!trimmed) return;

    const current = this.notifications();
    const last = current[current.length - 1];
    if (last && last.kind === kind && last.message === trimmed) {
      return;
    }

    const notification: Notification = reference
      ? { id: this.nextId++, kind, message: trimmed, reference }
      : { id: this.nextId++, kind, message: trimmed };
    this.notifications.update((list) => [...list, notification]);
  }
}
