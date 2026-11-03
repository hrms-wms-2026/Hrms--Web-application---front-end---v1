import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LeaveRequestApiService } from '../../leave/data-access/leave-request-api.service';

/** One of the caller's own leave requests, drawn on their Planner. */
export interface PlannerLeave {
  id: string;
  startAt: string;
  endAt: string;
  status: 'pending' | 'approved';
  typeName: string;
}

const REFRESH_MS = 60_000;

/**
 * The caller's pending and approved leave on the Planner (2026-11-03 design). The backend pushes no leave decision in
 * real time, so the layer re-reads on load and range change, when the tab is visible or focused again, and every
 * 60 seconds while visible: an approval shows within a minute.
 */
@Injectable()
export class PlannerLeaveLayerStore implements OnDestroy {
  private readonly api = inject(LeaveRequestApiService);
  private readonly document = inject(DOCUMENT);

  private readonly items = signal<readonly PlannerLeave[]>([]);
  readonly leaves = this.items.asReadonly();
  private range: { from: string; to: string } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onVisible = () => { if (this.document.visibilityState === 'visible') void this.reload(); };
  private readonly onFocus = () => void this.reload();

  async load(from: string, to: string): Promise<void> {
    this.range = { from, to };
    try {
      const rows = await firstValueFrom(this.api.listMine({ fromDate: from, toDate: to }));
      if (this.range?.from !== from || this.range.to !== to) return;
      this.items.set(rows
        .filter((r) => r.status === 'pending' || r.status === 'approved')
        .map((r) => ({ id: r.id, startAt: r.startAt, endAt: r.endAt, status: r.status as PlannerLeave['status'], typeName: r.leaveTypeName })));
    } catch {
      // A failed read keeps what is shown; the next refresh tries again.
    }
  }

  startAutoRefresh(): void {
    if (this.timer) return;
    this.document.addEventListener('visibilitychange', this.onVisible);
    this.document.defaultView?.addEventListener('focus', this.onFocus);
    this.timer = setInterval(() => { if (this.document.visibilityState === 'visible') void this.reload(); }, REFRESH_MS);
  }

  stopAutoRefresh(): void {
    this.document.removeEventListener('visibilitychange', this.onVisible);
    this.document.defaultView?.removeEventListener('focus', this.onFocus);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private reload(): Promise<void> {
    return this.range ? this.load(this.range.from, this.range.to) : Promise.resolve();
  }
}
