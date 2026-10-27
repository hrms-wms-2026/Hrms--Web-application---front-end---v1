import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { TeamAttendanceApiService } from '../data-access/team-attendance-api.service';
import {
  TeamAttendancePeriodMode,
  TeamAttendancePeriodQuery,
  TeamAttendanceSummaryResponse
} from '../models/team-attendance.model';

interface TeamAttendanceState {
  /** The selected period, shared by every card view and the detail dialog. */
  readonly query: TeamAttendancePeriodQuery;
  readonly data: TeamAttendanceSummaryResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
}

const initialState: TeamAttendanceState = {
  query: { mode: 'week', anchor: null, departmentId: null },
  data: null,
  loading: false,
  error: null,
  loadedAt: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

/** yyyy-MM-dd plus a number of days or months, in UTC so no time zone can shift the date. Month steps land on the 1st. */
export function shiftIsoDate(iso: string, unit: 'day' | 'month', amount: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = unit === 'day'
    ? new Date(Date.UTC(year, month - 1, day + amount))
    : new Date(Date.UTC(year, month - 1 + amount, 1));
  return date.toISOString().slice(0, 10);
}

export const TeamAttendanceStore = signalStore(
  { providedIn: 'root' },
  withState<TeamAttendanceState>(initialState),
  withMethods((store, api = inject(TeamAttendanceApiService)) => {
    // Only the latest request may land: a newer period cancels the one in flight.
    let inFlight: Subscription | null = null;

    const fetch = (query: TeamAttendancePeriodQuery): void => {
      inFlight?.unsubscribe();
      patchState(store, { query, loading: true, error: null });
      inFlight = api.getSummary(query).subscribe({
        next: (data) => patchState(store, { data, loading: false, loadedAt: new Date() }),
        error: (err) => patchState(store, { error: extractError(err, 'Failed to load team attendance.'), loading: false })
      });
    };

    return {
      /** Applies the dashboard bootstrap (this week, no department) when that is the selected period; otherwise the
       * selected period is reloaded, so a dashboard refresh never resets the viewer's choice. */
      seed(data: TeamAttendanceSummaryResponse): void {
        const q = store.query();
        const matches = q.departmentId === null && q.mode === data.mode && (q.anchor === null || q.anchor === data.rangeStart);
        if (!matches) {
          fetch(q);
          return;
        }
        inFlight?.unsubscribe();
        patchState(store, { data, loading: false, error: null, loadedAt: new Date(), query: { ...q, anchor: data.rangeStart } });
      },
      markLoading(): void {
        patchState(store, { loading: true, error: null });
      },
      load(): void {
        fetch(store.query());
      },
      /** Switching from the period that contains today stays on today; from a past period, on its start. */
      setMode(mode: TeamAttendancePeriodMode): void {
        const data = store.data();
        const q = store.query();
        if (mode === q.mode) return;
        const anchor = data?.isProvisional ? data.today : (q.anchor ?? data?.rangeStart ?? null);
        fetch({ ...q, mode, anchor });
      },
      shift(step: -1 | 1): void {
        const q = store.query();
        const from = q.anchor ?? store.data()?.rangeStart;
        if (!from) return;
        const anchor = q.mode === 'week' ? shiftIsoDate(from, 'day', 7 * step) : shiftIsoDate(from, 'month', step);
        fetch({ ...q, anchor });
      },
      setDepartment(departmentId: string | null): void {
        fetch({ ...store.query(), departmentId });
      }
    };
  })
);
