import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';

export type MeetingsAvailability = 'on' | 'read_only' | 'disabled';

/**
 * Whether meetings can be written (spec 7, 8). There is no flags endpoint, so the first write the server refuses with
 * meetings_disabled (503) or meetings_read_only (409) tells the app; the New meeting entry points follow it.
 */
@Injectable({ providedIn: 'root' })
export class MeetingsAvailabilityService {
  private readonly current = signal<MeetingsAvailability>('on');

  readonly state = this.current.asReadonly();
  readonly canCreate = computed(() => this.current() === 'on');

  noteError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) return;
    const code = error.error?.code as string | undefined;
    if (error.status === 503 && code === 'meetings_disabled') this.current.set('disabled');
    else if (error.status === 409 && code === 'meetings_read_only') this.current.set('read_only');
  }
}
