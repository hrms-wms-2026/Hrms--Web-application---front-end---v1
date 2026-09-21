import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../data-access/task-api.service';
import { toTaskStatusColumn, toWorkTask } from '../utils/task.mapper';
import { TaskStatusColumn, WorkTask } from '../models/task.model';
import { CreateSubtaskRequestDto, CreateTaskRequestDto, EditTaskRequestDto, InsufficientAllocationErrorDto } from '../models/dto/task.dto';

interface TaskBoardState {
  readonly statuses: readonly TaskStatusColumn[];
  readonly tasks: readonly WorkTask[];
  readonly subtasksByParentId: Readonly<Record<string, readonly WorkTask[]>>;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: TaskBoardState = { statuses: [], tasks: [], subtasksByParentId: {}, loading: false, error: null };

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

function tryParseInsufficientAllocation(err: any): InsufficientAllocationErrorDto | null {
  const body = err?.error;
  if (body && typeof body === 'object' && body.suggestedAction === 'extend_allocation' && typeof body.availableSlackHours === 'number') {
    return { availableSlackHours: body.availableSlackHours, suggestedAction: 'extend_allocation' };
  }
  const detail = typeof body?.detail === 'string' ? body.detail : null;
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail);
    if (parsed?.suggestedAction === 'extend_allocation' && typeof parsed.availableSlackHours === 'number') {
      return { availableSlackHours: parsed.availableSlackHours, suggestedAction: 'extend_allocation' };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

export const TaskBoardStore = signalStore(
  { providedIn: 'root' },
  withState<TaskBoardState>(initialState),
  withComputed(({ statuses, tasks }) => ({
    columnsWithTasks: computed(() =>
      [...statuses()]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((status) => ({ status, tasks: tasks().filter((t) => t.statusId === status.id) }))
    )
  })),
  withMethods((store, api = inject(TaskApiService)) => ({
    async loadBoard(scopeId: string, projectId?: string): Promise<void> {
      const targetProjectId = projectId ?? scopeId;
      patchState(store, { loading: true, error: null });
      try {
        const [statusDtos, taskDtos] = await Promise.all([
          firstValueFrom(api.getStatuses(targetProjectId)),
          firstValueFrom(api.getTasksByProject(targetProjectId))
        ]);
        patchState(store, {
          statuses: statusDtos.map(toTaskStatusColumn),
          tasks: taskDtos.map(toWorkTask),
          loading: false
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load the board.'), loading: false });
      }
    },

    async createTask(
      objectiveId: string,
      request: CreateTaskRequestDto
    ): Promise<WorkTask | InsufficientAllocationErrorDto | null> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.createTask(objectiveId, request));
        const task = toWorkTask(dto);
        patchState(store, { tasks: [...store.tasks(), task] });
        return task;
      } catch (err) {
        const insufficient = tryParseInsufficientAllocation(err);
        if (insufficient) {
          patchState(store, { error: null });
          return insufficient;
        }
        patchState(store, { error: extractError(err, 'Failed to create the task.') });
        return null;
      }
    },

    async editTask(taskId: string, request: EditTaskRequestDto): Promise<boolean> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.editTask(taskId, request));
        const updated = toWorkTask(dto);
        patchState(store, { tasks: store.tasks().map((t) => (t.id === taskId ? updated : t)) });
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to update the task.') });
        return false;
      }
    },

    async moveTask(taskId: string, newStatusId: string): Promise<void> {
      const previous = store.tasks();
      patchState(store, {
        tasks: previous.map((t) => (t.id === taskId ? { ...t, statusId: newStatusId } : t)),
        error: null
      });
      try {
        await firstValueFrom(api.moveTaskStatus(taskId, newStatusId));
      } catch (err) {
        patchState(store, { tasks: previous, error: extractError(err, 'Failed to move the task.') });
      }
    },

    async loadSubtasks(parentTaskId: string): Promise<void> {
      try {
        const dtos = await firstValueFrom(api.getSubtasks(parentTaskId));
        patchState(store, { subtasksByParentId: { ...store.subtasksByParentId(), [parentTaskId]: dtos.map(toWorkTask) } });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load subtasks.') });
      }
    },

    async createSubtask(parentTaskId: string, request: CreateSubtaskRequestDto): Promise<WorkTask | null> {
      patchState(store, { error: null });
      try {
        const dto = await firstValueFrom(api.createSubtask(parentTaskId, request));
        const subtask = toWorkTask(dto);
        const existing = store.subtasksByParentId()[parentTaskId] ?? [];
        patchState(store, {
          subtasksByParentId: { ...store.subtasksByParentId(), [parentTaskId]: [...existing, subtask] },
          tasks: store.tasks().map((t) => (t.id === parentTaskId ? { ...t, subtaskTotalCount: t.subtaskTotalCount + 1 } : t))
        });
        return subtask;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the subtask.') });
        return null;
      }
    }
  }))
);
