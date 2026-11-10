import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { Observable, firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PlannerApiService } from '../../work/planner/data-access/planner-api.service';
import { PlannerFocusResponse, PlannerRangeDay, PlannerRangeResponse } from '../../work/planner/models/planner.models';
import { PlannerAvailabilityService } from '../../work/planner/state/planner-availability.service';
import { plannerErrorMessage } from '../../work/planner/utils/planner-error-messages';

interface PlannerLayerState {
  /** The planner is on and its reads answered; while false the page is the plain calendar. */
  readonly active: boolean;
  readonly range: PlannerRangeResponse | null;
  readonly focus: PlannerFocusResponse | null;
  readonly saving: boolean;
  readonly error: string | null;
  readonly from: string | null;
  readonly to: string | null;
  /** A principal's days the caller is viewing as their meeting delegate; null = the caller's own. */
  readonly forEmployeeId: string | null;
}

function errorCode(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? err.error?.code : undefined;
}

/**
 * The planner layer of the calendar page (2026-10-27 Planner = Calendar design): the visible days' blocks and work windows
 * and the Focus list. It stays empty unless the planner is on, so the page falls back to the plain calendar.
 */
export const PlannerLayerStore = signalStore(
  withState<PlannerLayerState>({ active: false, range: null, focus: null, saving: false, error: null, from: null, to: null, forEmployeeId: null }),
  withComputed((store) => ({
    dayByDate: computed<ReadonlyMap<string, PlannerRangeDay>>(() => new Map((store.range()?.days ?? []).map((d) => [d.date, d]))),
    focusCount: computed(() => (store.focus()?.groups ?? []).reduce((sum, g) => sum + g.count, 0)),
  })),
  withMethods((store, api = inject(PlannerApiService), availability = inject(PlannerAvailabilityService),
    notify = inject(NotificationService)) => {
    // Only the newest load may land: paging quickly, or a write's refetch racing a navigation, must not leave another
    // range on screen.
    let latest = 0;

    async function load(from: string, to: string, forEmployeeId: string | null = null): Promise<void> {
      const mine = ++latest;
      patchState(store, { from, to, forEmployeeId });
      if (availability.state() !== 'on') {
        patchState(store, { active: false });
        return;
      }
      try {
        const [range, focus] = await Promise.all([
          firstValueFrom(api.getRange(from, to, forEmployeeId)),
          forEmployeeId ? Promise.resolve(null) : firstValueFrom(api.getFocus()),
        ]);
        if (mine !== latest) return;
        patchState(store, { active: true, range, focus, error: null });
      } catch (err) {
        if (mine !== latest) return;
        if (errorCode(err) === 'planner_disabled') {
          availability.markAvailable(false);
          patchState(store, { active: false, range: null, focus: null });
          return;
        }
        // The planner is on and this read failed (the API restarting, say): stay the Planner and say so, not a plain calendar.
        patchState(store, { active: true, error: plannerErrorMessage(errorCode(err)) });
      }
    }

    /** quiet: the caller shows the refusal itself (the store still keeps it in `error`). */
    async function write(call: Observable<unknown>, quiet = false): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(call);
        patchState(store, { saving: false });
        const { from, to } = { from: store.from(), to: store.to() };
        if (from && to) await load(from, to, store.forEmployeeId());
        return true;
      } catch (err) {
        const message = plannerErrorMessage(errorCode(err));
        patchState(store, { saving: false, error: message });
        if (!quiet) notify.error(message);
        return false;
      }
    }

    return {
      load,
      createBlock: (taskId: string, startAt: string, endAt: string, opts?: { quiet?: boolean }) =>
        write(api.createBlock({ taskId, startAt, endAt }), opts?.quiet ?? false),
      moveBlock: (blockId: string, startAt: string, endAt: string) => write(api.moveBlock(blockId, { startAt, endAt })),
      removeBlock: (blockId: string) => write(api.deleteBlock(blockId)),
    };
  }),
);
