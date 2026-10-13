import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import {
  ModuleCheckState, PickerModule, PickerTask, moduleCheckState, setModuleBulk, toggleId, toggleModuleLive
} from '../../utils/module-task-selection';

@Component({
  selector: 'app-module-task-picker',
  standalone: true,
  template: `
    @for (module of modules(); track module.objectiveId) {
      <div class="rounded px-1 py-0.5">
        <div class="flex items-center gap-2 text-sm">
          <button type="button" class="w-4 text-[var(--color-text-secondary)]" [attr.aria-expanded]="expanded().has(module.objectiveId)"
                  (click)="toggleExpand(module.objectiveId)" data-testid="module-expand">
            {{ expanded().has(module.objectiveId) ? '▾' : '▸' }}
          </button>
          <input type="checkbox" data-testid="module-checkbox"
                 [disabled]="!isModuleAllowed(module.objectiveId)"
                 [checked]="checkState(module.objectiveId) === 'checked'"
                 [indeterminate]="checkState(module.objectiveId) === 'indeterminate'"
                 (change)="onModuleToggled(module.objectiveId)" />
          <span class="truncate text-[var(--color-text-primary)]">{{ module.title }}</span>
          @if (module.isAchieved) { <span class="text-xs text-[var(--color-text-secondary)]">Achieved</span> }
          @if (!isModuleAllowed(module.objectiveId)) { <span class="text-xs text-[var(--color-text-secondary)]">Not your module</span> }
        </div>
        @if (expanded().has(module.objectiveId)) {
          <div class="ml-8 border-l border-[var(--color-border)] pl-2">
            @for (task of moduleTasks()[module.objectiveId] ?? []; track task.id) {
              <label class="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-surface-muted)]">
                <input type="checkbox" data-testid="task-checkbox"
                       [checked]="isTaskLocked(module.objectiveId) || selectedTaskIds().has(task.id)"
                       [disabled]="isTaskLocked(module.objectiveId) || !isPickable(task)"
                       (change)="onTaskToggled(task.id)" />
                <span class="truncate text-[var(--color-text-primary)]">{{ task.title }}</span>
                @if (isTaskLocked(module.objectiveId)) {
                  <span class="text-xs text-[var(--color-text-secondary)]">included (whole module)</span>
                } @else if (task.sprintId && task.sprintId !== currentSprintId()) {
                  <span class="text-xs text-[var(--color-text-secondary)]" data-testid="task-sprint-badge">
                    In {{ sprintNames()[task.sprintId] ?? 'another sprint' }}@if (frozenSprintIds().has(task.sprintId)) { · frozen }
                  </span>
                }
              </label>
            } @empty {
              <p class="px-2 py-1 text-xs text-[var(--color-text-secondary)]">No tasks in this module.</p>
            }
          </div>
        }
      </div>
    } @empty {
      <p class="text-sm text-[var(--color-text-secondary)]">No modules are visible.</p>
    }
  `
})
export class ModuleTaskPickerComponent {
  private readonly taskApi = inject(TaskApiService);

  readonly modules = input.required<readonly PickerModule[]>();
  readonly moduleMode = input<'live' | 'bulk'>('live');
  readonly allowedObjectiveIds = input<ReadonlySet<string> | null>(null);
  readonly sprintNames = input<Record<string, string | undefined>>({});
  readonly frozenSprintIds = input<ReadonlySet<string>>(new Set());
  readonly currentSprintId = input<string | null>(null);
  readonly selectedTaskIds = input<ReadonlySet<string>>(new Set());
  readonly selectedObjectiveIds = input<ReadonlySet<string>>(new Set());

  readonly selectedTaskIdsChange = output<Set<string>>();
  readonly selectedObjectiveIdsChange = output<Set<string>>();

  readonly expanded = signal<Set<string>>(new Set());
  readonly moduleTasks = signal<Record<string, PickerTask[] | undefined>>({});

  isModuleAllowed = (objectiveId: string): boolean => {
    const allowed = this.allowedObjectiveIds();
    return allowed === null || allowed.has(objectiveId);
  };

  isPickable = (task: PickerTask): boolean =>
    this.isModuleAllowed(task.objectiveId) && !(task.sprintId && this.frozenSprintIds().has(task.sprintId));

  isTaskLocked = (objectiveId: string): boolean =>
    this.moduleMode() === 'live' && this.selectedObjectiveIds().has(objectiveId);

  checkState(objectiveId: string): ModuleCheckState {
    return moduleCheckState(this.moduleMode(), objectiveId, this.moduleTasks()[objectiveId],
      this.selectedTaskIds(), this.selectedObjectiveIds(), this.isPickable);
  }

  async onModuleToggled(objectiveId: string): Promise<void> {
    if (!this.isModuleAllowed(objectiveId)) return;
    if (this.moduleMode() === 'live') {
      const next = toggleModuleLive(objectiveId, this.moduleTasks()[objectiveId], this.selectedTaskIds(), this.selectedObjectiveIds());
      this.selectedTaskIdsChange.emit(next.taskIds);
      this.selectedObjectiveIdsChange.emit(next.objectiveIds);
      return;
    }
    // Capture the checkbox's shown state BEFORE loading tasks: an unexpanded module has no
    // cached tasks yet, so checkState() sees none and shows 'unchecked' even when every
    // pickable task is already selected. Acting on that shown state (rather than recomputing
    // "all selected?" once the real tasks load) keeps the click's intent - add vs remove -
    // consistent with what the user saw and clicked.
    const before = this.checkState(objectiveId);
    const tasks = await this.ensureTasks(objectiveId);
    this.selectedTaskIdsChange.emit(setModuleBulk(tasks, this.selectedTaskIds(), this.isPickable, before !== 'checked'));
  }

  onTaskToggled(taskId: string): void {
    this.selectedTaskIdsChange.emit(toggleId(this.selectedTaskIds(), taskId));
  }

  async toggleExpand(objectiveId: string): Promise<void> {
    const next = new Set(this.expanded());
    if (next.has(objectiveId)) {
      next.delete(objectiveId);
      this.expanded.set(next);
      return;
    }
    next.add(objectiveId);
    this.expanded.set(next);
    await this.ensureTasks(objectiveId);
  }

  private async ensureTasks(objectiveId: string): Promise<PickerTask[]> {
    const cached = this.moduleTasks()[objectiveId];
    if (cached) return cached;
    let tasks: PickerTask[] = [];
    try {
      const dtos = await firstValueFrom(this.taskApi.getTasks(objectiveId));
      tasks = dtos.map((d) => ({ id: d.id, title: d.title, objectiveId: d.objectiveId, sprintId: d.sprintId, shortId: d.shortId }));
    } catch {
      tasks = [];
    }
    this.moduleTasks.set({ ...this.moduleTasks(), [objectiveId]: tasks });
    return tasks;
  }
}
