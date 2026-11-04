import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Subscription } from 'rxjs';
import { TeamWorkTaskApiService } from '../data-access/team-work-task-api.service';
import {
  TeamWorkTaskHoursResponse,
  TeamWorkTaskPeriod,
  TeamWorkTaskQuery,
} from '../models/team-work-task.model';
import { shiftIsoDate } from './team-attendance.store';

interface TeamWorkTaskState {
  /** The selected period, shared by every card view and the detail dialog. */
  readonly query: TeamWorkTaskQuery;
  readonly data: TeamWorkTaskHoursResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly loadedAt: Date | null;
}

const initialState: TeamWorkTaskState = {
  query: { period: 'week', anchor: null },
  data: null,
  loading: false,
  error: null,
  loadedAt: null,
};

interface HttpErrorLike {
  error?: { detail?: string; message?: string } | null;
  message?: string;
}

function extractError(err: unknown, fallback: string): string {
  const e = err as HttpErrorLike | null | undefined;
  return e?.error?.detail || e?.error?.message || e?.message || fallback;
}

/** The anchor one period before or after <paramref name="from"/>. */
export function shiftWorkTaskAnchor(
  period: TeamWorkTaskPeriod,
  from: string,
  step: -1 | 1,
): string {
  if (period === 'day') return shiftIsoDate(from, 'day', step);
  if (period === 'week') return shiftIsoDate(from, 'day', 7 * step);
  return shiftIsoDate(from, 'month', step);
}

export const TeamWorkTaskStore = signalStore(
  { providedIn: 'root' },
  withState<TeamWorkTaskState>(initialState),
  withMethods((store, api = inject(TeamWorkTaskApiService)) => {
    // Only the latest request may land: a newer period cancels the one in flight.
    let inFlight: Subscription | null = null;

    const fetch = (query: TeamWorkTaskQuery): void => {
      inFlight?.unsubscribe();
      patchState(store, { query, loading: true, error: null });
      inFlight = api.get(query).subscribe({
        next: (data) => patchState(store, { data, loading: false, loadedAt: new Date() }),
        error: (err) =>
          patchState(store, {
            error: extractError(err, 'Failed to load work vs task hours.'),
            loading: false,
          }),
      });
    };

    return {
      /** Applies a dashboard payload when it is the selected period; otherwise reloads the selected period. */
      seed(data: TeamWorkTaskHoursResponse): void {
        const q = store.query();
        if (q.period !== data.period || (q.anchor !== null && q.anchor !== data.rangeStart)) {
          fetch(q);
          return;
        }
        inFlight?.unsubscribe();
        patchState(store, {
          data,
          loading: false,
          error: null,
          loadedAt: new Date(),
          query: { ...q, anchor: data.rangeStart },
        });
      },
      markLoading(): void {
        patchState(store, { loading: true, error: null });
      },
      load(): void {
        fetch(store.query());
      },
      /** Switching from the period that contains today stays on today; from a past period, on its start. */
      setPeriod(period: TeamWorkTaskPeriod): void {
        const data = store.data();
        const q = store.query();
        if (period === q.period) return;
        const anchor = data?.isProvisional ? data.today : (q.anchor ?? data?.rangeStart ?? null);
        fetch({ period, anchor });
      },
      shift(step: -1 | 1): void {
        const q = store.query();
        const from = q.anchor ?? store.data()?.rangeStart;
        if (!from) return;
        fetch({ ...q, anchor: shiftWorkTaskAnchor(q.period, from, step) });
      },
    };
  }),
);
