import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Subscription, firstValueFrom } from 'rxjs';
import { MyTeamLedProgressApiService } from '../data-access/my-team-led-progress-api.service';
import { TeamProgressDetailApiService } from '../data-access/team-progress-detail-api.service';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { LedTimePeriod, LedTimeProgress } from '../models/team-progress-detail.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

interface MyTeamLedProgressState {
  readonly data: LedWorkProgressResponse | null;
  readonly loading: boolean;
  readonly error: string | null;
  /** When the backend last answered successfully - drives the card's "Refreshed ..." label. */
  readonly loadedAt: Date | null;
  /** Planned vs worked time for timePeriod (week by default), loaded with the card. Separate from the allocation
   * figures above: a failure here never hides them. */
  readonly timePeriod: LedTimePeriod;
  readonly time: LedTimeProgress | null;
  readonly timeError: boolean;
}

const initialState: MyTeamLedProgressState = {
  data: null,
  loading: false,
  error: null,
  loadedAt: null,
  timePeriod: 'week',
  time: null,
  timeError: false
};

function extractError(err: unknown, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

export const MyTeamLedProgressStore = signalStore(
  { providedIn: 'root' },
  withState<MyTeamLedProgressState>(initialState),
  withMethods((store, api = inject(MyTeamLedProgressApiService), detailApi = inject(TeamProgressDetailApiService)) => {
    // Only the latest time request may land: a newer period cancels the one in flight.
    let timeSub: Subscription | null = null;
    return {
    /** Loads the time figures for a period (the previous answer stays shown until the new one lands, unless the period
     * changed - then nothing from the old period is shown under the new label). */
    loadTime(period: LedTimePeriod): void {
      timeSub?.unsubscribe();
      patchState(store, period === store.timePeriod() ? { timeError: false } : { timePeriod: period, time: null, timeError: false });
      timeSub = detailApi.getTimeProgress(period).subscribe({
        next: (time) => patchState(store, { time }),
        error: () => patchState(store, { timeError: true })
      });
    },
    /** Applies a response the dashboard widget context already fetched, exactly as load() applies its own. */
    seed(data: LedWorkProgressResponse): void {
      patchState(store, { data, loading: false, error: null, loadedAt: new Date() });
    },
    /** A reload is running elsewhere (the dashboard refresh) - same state load() sets while in flight. */
    markLoading(): void {
      patchState(store, { loading: true, error: null });
    },
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const data = await firstValueFrom(api.getLedProgress());
        patchState(store, { data, loading: false, loadedAt: new Date() });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load team progress.'), loading: false });
      }
    }
    };
  })
);
