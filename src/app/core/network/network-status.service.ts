import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Whether the browser says it is online (Improvements task 20). Drives the offline banner, and lets the error
 * handler skip "could not reach the server" toasts while the banner already explains it.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly onlineState = signal(this.window?.navigator.onLine ?? true);
  readonly online = this.onlineState.asReadonly();

  constructor() {
    const win = this.window;
    if (!win) return;
    const goOnline = (): void => this.onlineState.set(true);
    const goOffline = (): void => this.onlineState.set(false);
    win.addEventListener('online', goOnline);
    win.addEventListener('offline', goOffline);
    inject(DestroyRef).onDestroy(() => {
      win.removeEventListener('online', goOnline);
      win.removeEventListener('offline', goOffline);
    });
  }
}
