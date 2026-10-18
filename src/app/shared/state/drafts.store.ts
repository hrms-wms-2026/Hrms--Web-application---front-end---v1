import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../core/auth/state/permission.service';
import { PeopleApiService } from '../../modules/people/data-access/people-api.service';
import { DraftListItemResponse } from '../../modules/people/models/onboarding-draft.model';
import { TaskDraftApiService } from '../../modules/work/data-access/task-draft-api.service';

export interface DraftChip {
  readonly kind: 'task' | 'employee';
  readonly id: string;
  readonly label: string;
  readonly badge: string | null;
  /** Task drafts only - the project whose backlog the draft reopens in. */
  readonly projectId: string | null;
}

interface DraftsState {
  readonly chips: readonly DraftChip[];
  readonly activeDraft: DraftChip | null;
}

function employeeBadge(status: string): string | null {
  if (status === 'waiting_for_seat') return 'Waiting for seat';
  if (status === 'waiting_for_position_approval') return 'Awaiting approval';
  return null;
}

/** The current user's own unsaved work (task drafts + onboarding drafts) shown in the drafts bar. */
export const DraftsStore = signalStore(
  { providedIn: 'root' },
  withState<DraftsState>({ chips: [], activeDraft: null }),
  withMethods((
    store,
    taskDrafts = inject(TaskDraftApiService),
    peopleApi = inject(PeopleApiService),
    permissions = inject(PermissionService)
  ) => {
    let requestId = 0;

    return {
      async load(): Promise<void> {
        const id = ++requestId;
        const [tasks, employees] = await Promise.allSettled([
          firstValueFrom(taskDrafts.list()),
          permissions.hasPermission('employees:write')
            ? firstValueFrom(peopleApi.listDrafts({ mine: true, page: 1, pageSize: 50 }))
            : Promise.resolve({ items: [] as DraftListItemResponse[] })
        ]);
        if (id !== requestId) return;

        const taskChips: DraftChip[] = tasks.status === 'fulfilled'
          ? tasks.value.map((d) => ({
              kind: 'task' as const,
              id: d.id,
              label: d.title.trim() || 'Untitled task',
              badge: null,
              projectId: d.projectId
            }))
          : [];
        const employeeChips: DraftChip[] = employees.status === 'fulfilled'
          ? employees.value.items.map((d) => ({
              kind: 'employee' as const,
              id: d.id,
              label: d.displayName.trim() || 'Untitled employee',
              badge: employeeBadge(d.status),
              projectId: null
            }))
          : [];
        patchState(store, { chips: [...taskChips, ...employeeChips] });
      },

      openDraft(chip: DraftChip): void {
        patchState(store, { activeDraft: chip });
      },

      closeDraft(): void {
        patchState(store, { activeDraft: null });
      },

      async removeChip(chip: DraftChip): Promise<boolean> {
        try {
          await firstValueFrom(chip.kind === 'task' ? taskDrafts.remove(chip.id) : peopleApi.cancelDraft(chip.id));
          patchState(store, {
            chips: store.chips().filter((c) => !(c.kind === chip.kind && c.id === chip.id)),
            activeDraft: store.activeDraft()?.id === chip.id ? null : store.activeDraft()
          });
          return true;
        } catch {
          return false;
        }
      }
    };
  })
);
