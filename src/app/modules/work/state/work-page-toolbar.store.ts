import { TemplateRef } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

interface WorkPageToolbarState {
  readonly template: TemplateRef<unknown> | null;
}

const initialState: WorkPageToolbarState = { template: null };

/**
 * Lets a routed tab (Board, Backlog, ...) project its own toolbar (Filter, Create task, ...)
 * into the persistent project-detail header instead of rendering it inline in the tab body.
 * Each tab must set its template on init and clear it (set null) on destroy so the next tab
 * doesn't briefly inherit a stale toolbar while the router swaps outlet content.
 */
export const WorkPageToolbarStore = signalStore(
  { providedIn: 'root' },
  withState<WorkPageToolbarState>(initialState),
  withMethods((store) => ({
    setTemplate(template: TemplateRef<unknown> | null): void {
      patchState(store, { template });
    }
  }))
);
