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
  /** The caller may also plan that principal's tasks ("Can also plan my tasks"): their Focus list loads too. */
  readonly planning: boolean;
  /** Set to the principal when a write for them answered 404: the delegate permission is gone. The page clears it. */
  readonly accessLost: string | null;
}

function errorCode(err: unknown): string | undefined {
  return err instanceof HttpErrorResponse ? err.error?.code : undefined;
}

/**
 * The planner layer of the calendar page (2026-10-27 Planner = Calendar design): the visible days' blocks and work windows
 * and the Focus list. It stays empty unless the planner is on, so the page falls back to the plain calendar.
 */
export const PlannerLayerStore = signalStore(
  withState<PlannerLayerState>({ active: false, range: null, focus: null, saving: false, error: null, from: null, to: null, forEmployeeId: null,
    planning: false, accessLost: null }),
  withComputed((store) => ({
    dayByDate: computed<ReadonlyMap<string, PlannerRangeDay>>(() => new Map((store.range()?.days ?? []).map((d) => [d.date, d]))),
    focusCount: computed(() => (store.focus()?.groups ?? []).reduce((sum, g) => sum + g.count, 0)),
  })),
  withMethods((store, api = inject(PlannerApiService), availability = inject(PlannerAvailabilityService),
    notify = inject(NotificationService)) => {
    // Only the newest load may land: paging quickly, or a write's refetch racing a navigation, must not leave another
    // range on screen.
    let latest = 0;

    /** `planning`: on a principal's calendar, the caller is their planning delegate and reads their Focus list too. */
    async function load(from: string, to: string, forEmployeeId: string | null = null, planning = false): Promise<void> {
      const mine = ++latest;
      patchState(store, { from, to, forEmployeeId, planning });
      if (availability.state() !== 'on') {
        patchState(store, { active: false });
        return;
      }
      try {
        const [range, focus] = await Promise.all([
          firstValueFrom(api.getRange(from, to, forEmployeeId)),
          !forEmployeeId ? firstValueFrom(api.getFocus())
            : planning ? firstValueFrom(api.getFocus(forEmployeeId)) : Promise.resolve(null),
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
        if (from && to) await load(from, to, store.forEmployeeId(), store.planning());
        return true;
      } catch (err) {
        const code = errorCode(err);
        const message = plannerErrorMessage(code);
        patchState(store, { saving: false, error: message });
        // Someone else wrote this block first: show the plan as it is now.
        if (code === 'planner_block_changed' && store.from() && store.to()) {
          void load(store.from()!, store.to()!, store.forEmployeeId(), store.planning());
        }
        // A write for a principal that is not found: the delegate permission was revoked, switched off or expired.
        if (code === 'planner_not_found' && store.forEmployeeId()) {
          patchState(store, { accessLost: store.forEmployeeId() });
          return false;
        }
        if (!quiet) notify.error(message);
        return false;
      }
    }

    /** The block's version as last read, sent back so a block someone else wrote meanwhile is refused (409). */
    function versionOf(blockId: string): string | undefined {
      for (const day of store.range()?.days ?? []) {
        const block = day.blocks.find((b) => b.id === blockId);
        if (block) return block.version || undefined;
      }
      return undefined;
    }

    return {
      load,
      createBlock: (taskId: string, startAt: string, endAt: string, opts?: { quiet?: boolean }) =>
        write(api.createBlock({ taskId, startAt, endAt }, store.forEmployeeId()), opts?.quiet ?? false),
      moveBlock: (blockId: string, startAt: string, endAt: string) => {
        const expectedVersion = versionOf(blockId);
        return write(api.moveBlock(blockId, expectedVersion ? { startAt, endAt, expectedVersion } : { startAt, endAt },
          store.forEmployeeId()));
      },
      removeBlock: (blockId: string) => write(api.deleteBlock(blockId, versionOf(blockId), store.forEmployeeId())),
      clearAccessLost: () => patchState(store, { accessLost: null }),
    };
  }),
);
