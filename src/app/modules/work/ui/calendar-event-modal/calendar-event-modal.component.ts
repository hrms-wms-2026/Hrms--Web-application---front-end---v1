import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { TaskApiService } from '../../data-access/task-api.service';
import {
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarModuleDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { WorkTaskDto } from '../../models/dto/task.dto';

type ModuleCheckState = 'checked' | 'indeterminate' | 'unchecked';

@Component({
  selector: 'app-calendar-event-modal',
  standalone: true,
  imports: [DatePickerComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" (click)="cancel.emit()">
      <section class="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" (click)="$event.stopPropagation()">
        <div class="mb-4 flex items-center justify-between">
          <h2 id="calendar-event-title" class="text-lg font-semibold text-[var(--color-text-primary)]">{{ event() ? 'Edit milestone' : 'Create milestone' }}</h2>
          <button type="button" class="text-[var(--color-text-secondary)]" aria-label="Close" (click)="cancel.emit()">×</button>
        </div>

        <label class="mb-3 block text-sm text-[var(--color-text-secondary)]">Name
          <input class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)]" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="255" data-testid="event-name" />
        </label>

        <div class="mb-3 flex gap-3">
          <div class="flex-1">
            <app-date-picker
              label="Start date"
              inputTestId="event-start-date"
              [value]="startDate()"
              (valueChange)="startDate.set($event)"
            />
          </div>
          <div class="flex-1">
            <app-date-picker
              label="End date"
              inputTestId="event-end-date"
              [value]="endDate()"
              (valueChange)="endDate.set($event)"
            />
          </div>
        </div>

        <label class="mb-4 block text-sm text-[var(--color-text-secondary)]">Color
          <span class="mt-1 flex gap-2">
            <input type="color" class="h-10 w-14" [value]="color()" (input)="color.set($any($event.target).value)" />
            <input class="flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 uppercase text-[var(--color-text-primary)]" [value]="color()" (input)="color.set($any($event.target).value.toUpperCase())" pattern="^#[0-9A-Fa-f]{6}$" />
          </span>
        </label>

        <div class="mb-4 max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Modules &amp; tasks</p>
          @for (module of modules(); track module.objectiveId) {
            <div class="rounded px-1 py-0.5">
              <div class="flex items-center gap-2 text-sm">
                <button type="button" class="w-4 text-[var(--color-text-secondary)]" [attr.aria-expanded]="expanded().has(module.objectiveId)" (click)="toggleExpand(module.objectiveId)" data-testid="module-expand">
                  {{ expanded().has(module.objectiveId) ? '▾' : '▸' }}
                </button>
                <input
                  type="checkbox"
                  data-testid="module-checkbox"
                  [checked]="moduleCheckState(module.objectiveId) === 'checked'"
                  [indeterminate]="moduleCheckState(module.objectiveId) === 'indeterminate'"
                  (change)="toggleObjective(module.objectiveId)"
                />
                <span class="truncate text-[var(--color-text-primary)]">{{ module.title }}</span>
                @if (module.isAchieved) { <span class="text-xs text-[var(--color-text-secondary)]">Achieved</span> }
              </div>
              @if (expanded().has(module.objectiveId)) {
                <div class="ml-8 border-l border-[var(--color-border)] pl-2">
                  @for (task of moduleTasks()[module.objectiveId] ?? []; track task.id) {
                    <label class="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-surface-muted)]">
                      <input
                        type="checkbox"
                        data-testid="task-checkbox"
                        [checked]="isTaskLocked(module.objectiveId) || selectedTaskIds().has(task.id)"
                        [disabled]="isTaskLocked(module.objectiveId)"
                        (change)="toggleTask(task.id)"
                      />
                      <span class="truncate text-[var(--color-text-primary)]">{{ task.title }}</span>
                      @if (isTaskLocked(module.objectiveId)) {
                        <span class="text-xs text-[var(--color-text-secondary)]">included (whole module)</span>
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
        </div>

        @if (error()) { <p class="mb-3 text-sm text-[var(--color-danger)]" role="alert" data-testid="event-error">{{ error() }}</p> }
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)]" (click)="cancel.emit()">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="!valid()" (click)="submit()" data-testid="event-save">Save milestone</button>
        </div>
      </section>
    </div>
  `
})
export class CalendarEventModalComponent {
  private readonly taskApi = inject(TaskApiService);

  readonly event = input<CalendarEventDto | null>(null);
  readonly modules = input.required<readonly ProjectCalendarModuleDto[]>();
  readonly cancel = output<void>();
  readonly save = output<CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto>();

  readonly name = signal('');
  readonly color = signal('#2563EB');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly selectedObjectiveIds = signal<Set<string>>(new Set());
  readonly selectedTaskIds = signal<Set<string>>(new Set());
  readonly expanded = signal<Set<string>>(new Set());
  readonly moduleTasks = signal<Record<string, WorkTaskDto[]>>({});
  readonly error = signal<string | null>(null);

  readonly valid = () =>
    this.name().trim().length > 0 &&
    /^#[0-9A-Fa-f]{6}$/.test(this.color()) &&
    !!this.startDate() &&
    !!this.endDate() &&
    this.endDate() >= this.startDate() &&
    (this.selectedObjectiveIds().size > 0 || this.selectedTaskIds().size > 0);

  isTaskLocked = (objectiveId: string): boolean => this.selectedObjectiveIds().has(objectiveId);

  constructor() {
    effect(() => {
      const event = this.event();
      this.name.set(event?.name ?? '');
      this.color.set(event?.color ?? '#2563EB');
      this.startDate.set(event?.startDate ?? '');
      this.endDate.set(event?.endDate ?? '');
      this.selectedObjectiveIds.set(new Set(event?.objectiveIds ?? []));
      this.selectedTaskIds.set(new Set(event?.taskIds ?? []));
      this.expanded.set(new Set());
      this.moduleTasks.set({});
      this.error.set(null);
    });
  }

  moduleCheckState(objectiveId: string): ModuleCheckState {
    if (this.selectedObjectiveIds().has(objectiveId)) return 'checked';
    const tasks = this.moduleTasks()[objectiveId] ?? [];
    const picked = tasks.filter((t) => this.selectedTaskIds().has(t.id)).length;
    if (picked > 0 && picked < tasks.length) return 'indeterminate';
    if (picked > 0 && picked === tasks.length && tasks.length > 0) return 'indeterminate';
    return 'unchecked';
  }

  toggleObjective(objectiveId: string): void {
    const next = new Set(this.selectedObjectiveIds());
    if (next.has(objectiveId)) {
      next.delete(objectiveId);
    } else {
      next.add(objectiveId);
      // whole module supersedes individual task ticks for that module
      const taskIds = new Set(this.selectedTaskIds());
      for (const task of this.moduleTasks()[objectiveId] ?? []) taskIds.delete(task.id);
      this.selectedTaskIds.set(taskIds);
    }
    this.selectedObjectiveIds.set(next);
  }

  toggleTask(taskId: string): void {
    const next = new Set(this.selectedTaskIds());
    next.has(taskId) ? next.delete(taskId) : next.add(taskId);
    this.selectedTaskIds.set(next);
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
    if (!this.moduleTasks()[objectiveId]) {
      try {
        const tasks = await firstValueFrom(this.taskApi.getTasks(objectiveId));
        this.moduleTasks.set({ ...this.moduleTasks(), [objectiveId]: tasks });
      } catch {
        this.moduleTasks.set({ ...this.moduleTasks(), [objectiveId]: [] });
      }
    }
  }

  submit(): void {
    if (!this.valid()) {
      this.error.set('Enter a name, a valid #RRGGBB colour, a start and end date, and select at least one module or task.');
      return;
    }
    this.save.emit({
      name: this.name().trim(),
      color: this.color().toUpperCase(),
      startDate: this.startDate(),
      endDate: this.endDate(),
      objectiveIds: [...this.selectedObjectiveIds()],
      taskIds: [...this.selectedTaskIds()]
    });
  }
}
