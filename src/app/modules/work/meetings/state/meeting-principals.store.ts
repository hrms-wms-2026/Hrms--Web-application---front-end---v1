import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MeetingApiService } from '../data-access/meeting-api.service';
import { MeetingPrincipalView } from '../models/meeting.models';

/**
 * The people whose meetings the caller may run (meeting delegates, 2026-11-10). Empty for most people, so the
 * calendar's "whose calendar" selector and the meeting form's Organizer select stay hidden for them.
 */
@Injectable({ providedIn: 'root' })
export class MeetingPrincipalsStore {
  private readonly api = inject(MeetingApiService);
  private readonly rows = signal<readonly MeetingPrincipalView[]>([]);
  private loaded = false;

  readonly principals = this.rows.asReadonly();

  /** Reads the list once; `force` reads it again (a principal may have added or removed the caller since). */
  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    this.loaded = true;
    try {
      this.rows.set(await firstValueFrom(this.api.listPrincipals()));
    } catch {
      // Not knowing is the same as having none: the delegate controls stay hidden.
      this.rows.set([]);
      this.loaded = false;
    }
  }
}
