import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintDto } from '../../models/dto/sprint.dto';
import { ModuleCheckState, PickerTask, moduleCheckState, setModuleBulk, toggleId } from '../../utils/module-task-selection';

// Timeline order for the Sprint view: sprints with a startDate come first, earliest
// first; dateless (Draft) sprints have no position on a timeline, so they trail the
// dated ones in whatever order the API returned them (server creation order).
export function orderSprintsForTimeline(sprints: readonly SprintDto[]): SprintDto[] {
  const dated = sprints.filter((s) => !!s.startDate).sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string));
  const dateless = sprints.filter((s) => !s.startDate);
  return [...dated, ...dateless];
}

@Component({
  selector: 'app-sprint-task-picker',
  standalone: true,
  template: `
    @for (sprint of sprints(); track sprint.id) {
      <div class="rounded px-1 py-0.5">
        <div class="flex items-center gap-2 text-sm">
          <button type="button" class="w-4 text-[var(--color-text-secondary)]" [attr.aria-expanded]="expanded().has(sprint.id)"
                  (click)="toggleExpand(sprint.id)" data-testid="sprint-expand">
            {{ expanded().has(sprint.id) ? '▾' : '▸' }}
          </button>
          <input type="checkbox" data-testid="sprint-checkbox"
                 [checked]="checkState(sprint.id) === 'checked'"
                 [indeterminate]="checkState(sprint.id) === 'indeterminate'"
                 (change)="onSprintToggled(sprint.id)" />
          <span class="truncate text-[var(--color-text-primary)]">{{ sprint.name }}</span>
          <span class="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">{{ sprint.status }}</span>
          <span class="text-xs text-[var(--color-text-secondary)]">{{ sprint.startDate ? (sprint.startDate + ' – ' + sprint.endDate) : 'No dates yet' }}</span>
        </div>
        @if (expanded().has(sprint.id)) {
          <div class="ml-8 border-l border-[var(--color-border)] pl-2">
            @for (task of sprintTasks()[sprint.id] ?? []; track task.id) {
              <label class="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-surface-muted)]">
                <input type="checkbox" data-testid="sprint-task-checkbox"
                       [checked]="isTaskLocked(task.objectiveId) || selectedTaskIds().has(task.id)"
                       [disabled]="isTaskLocked(task.objectiveId)"
                       (change)="onTaskToggled(task.id)" />
                <span class="truncate text-[var(--color-text-primary)]">{{ task.title }}</span>
                @if (isTaskLocked(task.objectiveId)) {
                  <span class="text-xs text-[var(--color-text-secondary)]">included (whole module)</span>
                }
              </label>
            } @empty {
              <p class="px-2 py-1 text-xs text-[var(--color-text-secondary)]">No tasks in this sprint.</p>
            }
          </div>
        }
      </div>
    } @empty {
      <p class="text-sm text-[var(--color-text-secondary)]">No sprints yet.</p>
    }
  `
})
export class SprintTaskPickerComponent {
  private readonly sprintApi = inject(SprintApiService);
  private readonly taskApi = inject(TaskApiService);

  readonly projectId = input.required<string>();
  readonly selectedTaskIds = input<ReadonlySet<string>>(new Set());
  readonly lockedObjectiveIds = input<ReadonlySet<string>>(new Set());

  readonly selectedTaskIdsChange = output<Set<string>>();

  readonly sprints = signal<SprintDto[]>([]);
  readonly expanded = signal<Set<string>>(new Set());
  readonly sprintTasks = signal<Record<string, PickerTask[] | undefined>>({});

  private loadedForProjectId: string | null = null;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      if (!projectId || projectId === this.loadedForProjectId) return;
      this.loadedForProjectId = projectId;
      this.sprintApi.getByProject(projectId).subscribe((sprints) => {
        this.sprints.set(orderSprintsForTimeline(sprints));
      });
    });
  }

  isTaskLocked = (objectiveId: string): boolean => this.lockedObjectiveIds().has(objectiveId);

  isPickable = (task: PickerTask): boolean => !this.isTaskLocked(task.objectiveId);

  checkState(sprintId: string): ModuleCheckState {
    return moduleCheckState('bulk', sprintId, this.sprintTasks()[sprintId], this.selectedTaskIds(), new Set(), this.isPickable);
  }

  async onSprintToggled(sprintId: string): Promise<void> {
    // Same show-then-act fix as ModuleTaskPickerComponent.onModuleToggled: capture the
    // checkbox's shown state before ensureTasks loads the real task list, so an unexpanded
    // sprint whose pickable tasks are already all selected doesn't get its tick read as
    // "deselect everything" once the tasks load in.
    const before = this.checkState(sprintId);
    const tasks = await this.ensureTasks(sprintId);
    this.selectedTaskIdsChange.emit(setModuleBulk(tasks, this.selectedTaskIds(), this.isPickable, before !== 'checked'));
  }

  onTaskToggled(taskId: string): void {
    this.selectedTaskIdsChange.emit(toggleId(this.selectedTaskIds(), taskId));
  }

  async toggleExpand(sprintId: string): Promise<void> {
    const next = new Set(this.expanded());
    if (next.has(sprintId)) {
      next.delete(sprintId);
      this.expanded.set(next);
      return;
    }
    next.add(sprintId);
    this.expanded.set(next);
    await this.ensureTasks(sprintId);
  }

  private async ensureTasks(sprintId: string): Promise<PickerTask[]> {
    const cached = this.sprintTasks()[sprintId];
    if (cached) return cached;
    let tasks: PickerTask[] = [];
    try {
      const dtos = await firstValueFrom(this.taskApi.getBySprintId(sprintId));
      tasks = dtos.map((d) => ({ id: d.id, title: d.title, objectiveId: d.objectiveId, sprintId: d.sprintId, shortId: d.shortId }));
    } catch {
      tasks = [];
    }
    this.sprintTasks.set({ ...this.sprintTasks(), [sprintId]: tasks });
    return tasks;
  }
}
