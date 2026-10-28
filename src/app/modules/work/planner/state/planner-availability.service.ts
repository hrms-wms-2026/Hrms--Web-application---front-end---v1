import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PlannerApiService } from '../data-access/planner-api.service';

export type PlannerAvailability = 'unknown' | 'on' | 'off';

/**
 * Whether the day planner is on (Planner:Enabled). One silent probe per session decides it; the Planner nav item shows
 * only once it is 'on', so nobody is sent to a page that answers 503.
 */
@Injectable({ providedIn: 'root' })
export class PlannerAvailabilityService {
  private readonly injector = inject(Injector);
  private readonly current = signal<PlannerAvailability>('unknown');
  private probing: Promise<void> | null = null;

  readonly state = this.current.asReadonly();

  /** Asks once; later calls reuse the first answer. Any answer but 503 planner_disabled counts as on. */
  probe(): Promise<void> {
    this.probing ??= this.ask();
    return this.probing;
  }

  markAvailable(on: boolean): void {
    this.current.set(on ? 'on' : 'off');
  }

  private async ask(): Promise<void> {
    try {
      await firstValueFrom(this.injector.get(PlannerApiService).getMyDay(null));
      this.markAvailable(true);
    } catch (e) {
      this.markAvailable(!(e instanceof HttpErrorResponse && e.status === 503 && e.error?.code === 'planner_disabled'));
    }
  }
}
