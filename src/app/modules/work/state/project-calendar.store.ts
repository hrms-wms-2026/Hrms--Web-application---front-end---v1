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
  ProjectCalendarItemDto,
  UpdateCalendarEventRequestDto
} from '../models/dto/calendar.dto';
import { EditObjectiveRequestDto } from '../models/dto/milestone.dto';

interface ProjectCalendarState {
  readonly projectId: string | null;
  readonly items: readonly ProjectCalendarItemDto[];
  readonly events: readonly CalendarEventDto[];
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly pendingObjectiveIds: readonly string[];
  readonly approvalMessages: Readonly<Record<string, string>>;
}

const initialState: ProjectCalendarState = {
  projectId: null,
  items: [],
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

function eventFromItems(items: readonly ProjectCalendarItemDto[]): CalendarEventDto[] {
  const grouped = new Map<string, CalendarEventDto>();
  for (const item of items) {
    if (!item.calendarEventId || !item.calendarEventColor) continue;
    const existing = grouped.get(item.calendarEventId);
    if (existing) {
      if (!existing.objectiveIds.includes(item.objectiveId)) existing.objectiveIds.push(item.objectiveId);
      continue;
    }
    grouped.set(item.calendarEventId, {
      id: item.calendarEventId,
      projectId: item.projectId,
      name: 'Calendar event',
      color: item.calendarEventColor,
      status: 'active',
      objectiveIds: [item.objectiveId]
    });
  }
  return [...grouped.values()];
}

function replaceEventMembership(
  items: readonly ProjectCalendarItemDto[],
  event: CalendarEventDto | null,
  eventId: string,
  objectiveIds: readonly string[]
): ProjectCalendarItemDto[] {
  const color = event?.color ?? null;
  const selected = new Set(objectiveIds);
  return items.map((item) => {
    if (item.calendarEventId === eventId && !selected.has(item.objectiveId)) {
      return { ...item, calendarEventId: null, calendarEventColor: null };
    }
    if (selected.has(item.objectiveId)) {
      return { ...item, calendarEventId: eventId, calendarEventColor: color };
    }
    return item;
  });
}

export const ProjectCalendarStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectCalendarState>(initialState),
  withComputed(({ items, events, pendingObjectiveIds }) => ({
    activeEvents: computed(() => events().filter((event) => event.status === 'active')),
    editableItems: computed(() => items().filter((item) => item.canEdit && !item.isAchieved)),
    pendingSet: computed(() => new Set(pendingObjectiveIds()))
  })),
  withMethods((store, calendarApi = inject(CalendarApiService), objectiveApi = inject(ProjectApiService)) => ({
    async load(projectId: string): Promise<void> {
      patchState(store, { projectId, loading: true, error: null });
      try {
        const items = await firstValueFrom(calendarApi.getProjectCalendar(projectId));
        patchState(store, { items, events: eventFromItems(items), loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: extractError(err, 'Failed to load the project calendar.') });
      }
    },

    async saveDates(change: CalendarDateChange): Promise<CalendarDateSaveResult> {
      const current = store.items().find((item) => item.objectiveId === change.objectiveId);
      if (!current) return { success: false, applied: false, pendingApproval: false };
      const previous = store.items();
      patchState(store, {
        items: previous.map((item) => item.objectiveId === change.objectiveId ? { ...item, startDate: change.startDate, endDate: change.endDate } : item),
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
            items: previous,
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
        patchState(store, { items: previous, saving: false, error: extractError(err, `Failed to save ${current.title}.`) });
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
        const event = await firstValueFrom(calendarApi.createEvent(projectId, payload));
        const items = replaceEventMembership(store.items(), event, event.id, payload.objectiveIds);
        patchState(store, { items, events: [...store.events().filter((item) => item.id !== event.id), event], error: null });
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the calendar event.') });
        return false;
      }
    },

    async updateEvent(id: string, payload: UpdateCalendarEventRequestDto): Promise<boolean> {
      try {
        const event = await firstValueFrom(calendarApi.updateEvent(id, payload));
        const previous = store.events().find((item) => item.id === id);
        const next = { ...previous, ...event, id } as CalendarEventDto;
        const items = payload.objectiveIds ? replaceEventMembership(store.items(), next, id, payload.objectiveIds) : store.items().map((item) => item.calendarEventId === id ? { ...item, calendarEventColor: next.color } : item);
        patchState(store, { items, events: [...store.events().filter((item) => item.id !== id), next], error: null });
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to update the calendar event.') });
        return false;
      }
    },

    async closeEvent(id: string): Promise<boolean> {
      try {
        await firstValueFrom(calendarApi.closeEvent(id));
        patchState(store, {
          items: store.items().map((item) => item.calendarEventId === id ? { ...item, calendarEventId: null, calendarEventColor: null } : item),
          events: store.events().map((event) => event.id === id ? { ...event, status: 'archived' } : event),
          error: null
        });
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to close the calendar event.') });
        return false;
      }
    }
  }))
);
