import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { CalendarApiService } from '../data-access/calendar-api.service';
import { ProjectApiService } from '../data-access/project-api.service';
import {
  CalendarDateChange,
  CalendarDateSaveResult,
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarEventBandDto,
  ProjectCalendarModuleDto,
  UpdateCalendarEventRequestDto
} from '../models/dto/calendar.dto';
import { EditObjectiveRequestDto } from '../models/dto/milestone.dto';

interface ProjectCalendarState {
  readonly projectId: string | null;
  readonly modules: readonly ProjectCalendarModuleDto[];
  readonly bands: readonly ProjectCalendarEventBandDto[];
  readonly events: readonly CalendarEventDto[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly pendingObjectiveIds: readonly string[];
  readonly approvalMessages: Readonly<Record<string, string>>;
}

const initialState: ProjectCalendarState = {
  projectId: null,
  modules: [],
  bands: [],
  events: [],
  loading: false,
  saving: false,
  error: null,
  pendingObjectiveIds: [],
  approvalMessages: {}
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

/**
 * Bands carry the event window; the whole-module link ids come from the modules'
 * "whole" event links. Exact task-link ids are not in the read payload (it only has
 * counts) - the event editor re-fetches them from a create/update response, and an
 * event opened cold starts with no task ticks.
 */
function bandsToEvents(
  bands: readonly ProjectCalendarEventBandDto[],
  modules: readonly ProjectCalendarModuleDto[]
): CalendarEventDto[] {
  return bands.map((band) => ({
    id: band.eventId,
    projectId: modules[0]?.projectId ?? '',
    name: band.name,
    color: band.color,
    status: 'active',
    startDate: band.startDate,
    endDate: band.endDate,
    objectiveIds: modules
      .filter((m) => m.events.some((e) => e.eventId === band.eventId && e.membership === 'whole'))
      .map((m) => m.objectiveId),
    taskIds: []
  }));
}

export const ProjectCalendarStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectCalendarState>(initialState),
  withComputed(({ bands, modules, pendingObjectiveIds }) => ({
    activeEvents: computed(() => bands()),
    editableModules: computed(() => modules().filter((m) => m.canEdit && !m.isAchieved)),
    pendingSet: computed(() => new Set(pendingObjectiveIds()))
  })),
  withMethods((store, calendarApi = inject(CalendarApiService), objectiveApi = inject(ProjectApiService)) => {
    async function load(projectId: string): Promise<void> {
      patchState(store, { projectId, loading: true, error: null });
      try {
        const payload = await firstValueFrom(calendarApi.getProjectCalendar(projectId));
        patchState(store, {
          modules: payload.modules,
          bands: payload.bands,
          events: bandsToEvents(payload.bands, payload.modules),
          loading: false
        });
      } catch (err) {
        patchState(store, { loading: false, error: extractError(err, 'Failed to load the project calendar.') });
      }
    }

    return {
      load,

      async saveDates(change: CalendarDateChange): Promise<CalendarDateSaveResult> {
        const current = store.modules().find((item) => item.objectiveId === change.objectiveId);
        if (!current) return { success: false, applied: false, pendingApproval: false };
        const previous = store.modules();
        patchState(store, {
          modules: previous.map((item) =>
            item.objectiveId === change.objectiveId
              ? { ...item, startDate: change.startDate, endDate: change.endDate }
              : item
          ),
          saving: true,
          error: null
        });
        const payload: EditObjectiveRequestDto = {
          title: current.title,
          description: current.description ?? '',
          startDate: change.startDate,
          endDate: change.endDate,
          allocatedHours: current.allocatedHours ?? 0
        };
        try {
          const response = await firstValueFrom(objectiveApi.editObjective(change.objectiveId, payload));
          const body = response.body as (typeof current & { applied?: boolean }) | null;
          const applied = body?.applied ?? response.status !== 202;
          if (!applied) {
            patchState(store, {
              modules: previous,
              saving: false,
              pendingObjectiveIds: [...new Set([...store.pendingObjectiveIds(), change.objectiveId])],
              approvalMessages: {
                ...store.approvalMessages(),
                [change.objectiveId]: `${current.title} needs approval before this date change can be applied.`
              }
            });
            return { success: true, applied: false, pendingApproval: true };
          }
          patchState(store, { saving: false });
          return { success: true, applied: true, pendingApproval: false };
        } catch (err) {
          patchState(store, { modules: previous, saving: false, error: extractError(err, `Failed to save ${current.title}.`) });
          return { success: false, applied: false, pendingApproval: false };
        }
      },

      clearApprovalMessage(objectiveId: string): void {
        const messages = { ...store.approvalMessages() };
        delete messages[objectiveId];
        patchState(store, {
          approvalMessages: messages,
          pendingObjectiveIds: store.pendingObjectiveIds().filter((id) => id !== objectiveId)
        });
      },

      async createEvent(payload: CreateCalendarEventRequestDto): Promise<boolean> {
        const projectId = store.projectId();
        if (!projectId) return false;
        try {
          await firstValueFrom(calendarApi.createEvent(projectId, payload));
          await load(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to create the calendar event.') });
          return false;
        }
      },

      async updateEvent(id: string, payload: UpdateCalendarEventRequestDto): Promise<boolean> {
        const projectId = store.projectId();
        try {
          await firstValueFrom(calendarApi.updateEvent(id, payload));
          if (projectId) await load(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to update the calendar event.') });
          return false;
        }
      },

      saveEventDates(eventId: string, startDate: string, endDate: string): Promise<boolean> {
        return this.updateEvent(eventId, { startDate, endDate });
      },

      async closeEvent(id: string): Promise<boolean> {
        const projectId = store.projectId();
        try {
          await firstValueFrom(calendarApi.closeEvent(id));
          if (projectId) await load(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to close the calendar event.') });
          return false;
        }
      }
    };
  })
);
