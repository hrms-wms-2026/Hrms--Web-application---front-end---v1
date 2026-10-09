import { Component, effect, input, output, signal } from '@angular/core';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import {
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarModuleDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { ModuleTaskPickerComponent } from '../module-task-picker/module-task-picker.component';
import { SprintTaskPickerComponent } from '../sprint-task-picker/sprint-task-picker.component';
import { toggleModuleLive } from '../../utils/module-task-selection';

@Component({
  selector: 'app-calendar-event-modal',
  host: { 'animate.leave': 'ui-popup-leave' },
  standalone: true,
  imports: [DatePickerComponent, ModuleTaskPickerComponent, SprintTaskPickerComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" (click)="cancel.emit()">
      <section class="ui-scroll-open w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" (click)="$event.stopPropagation()">
        <div class="ui-popup-header -mx-5 -mt-5 mb-4 flex items-center justify-between [--popup-pad:1.25rem]">
          <span class="ui-popup-icon" data-icon="flag" aria-hidden="true"></span>
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

        <label class="mb-4 block text-sm text-[var(--color-text-secondary)]">Description
          <textarea
            class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)]"
            rows="3" maxlength="2000"
            [value]="description()"
            (input)="description.set($any($event.target).value)"
            data-testid="event-description"
          ></textarea>
        </label>

        <div class="mb-4 max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
          <div class="mb-2 inline-flex rounded-md border border-[var(--color-border)] p-0.5 text-xs" role="tablist" aria-label="Pick tasks by">
            <button type="button" role="tab" data-testid="view-tree" [attr.aria-selected]="view() === 'tree'"
                    class="rounded px-2 py-1" [class.bg-[var(--color-surface-muted)]]="view() === 'tree'" (click)="view.set('tree')">Tree view</button>
            <button type="button" role="tab" data-testid="view-sprint" [attr.aria-selected]="view() === 'sprint'"
                    class="rounded px-2 py-1" [class.bg-[var(--color-surface-muted)]]="view() === 'sprint'" (click)="view.set('sprint')">Sprint view</button>
          </div>
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">{{ view() === 'tree' ? 'Modules & tasks' : 'Sprints & tasks' }}</p>
          @if (view() === 'tree') {
            <app-module-task-picker
              moduleMode="live"
              [modules]="modules()"
              [selectedTaskIds]="selectedTaskIds()"
              [selectedObjectiveIds]="selectedObjectiveIds()"
              (selectedTaskIdsChange)="selectedTaskIds.set($event)"
              (selectedObjectiveIdsChange)="selectedObjectiveIds.set($event)"
            />
          } @else {
            <app-sprint-task-picker
              [projectId]="projectId()"
              [selectedTaskIds]="selectedTaskIds()"
              [lockedObjectiveIds]="selectedObjectiveIds()"
              (selectedTaskIdsChange)="selectedTaskIds.set($event)"
            />
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
  readonly event = input<CalendarEventDto | null>(null);
  readonly modules = input.required<readonly ProjectCalendarModuleDto[]>();
  readonly projectId = input<string>('');
  readonly cancel = output<void>();
  readonly save = output<CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto>();

  readonly view = signal<'tree' | 'sprint'>('tree');
  readonly name = signal('');
  readonly color = signal('#2563EB');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly description = signal('');
  readonly selectedObjectiveIds = signal<Set<string>>(new Set());
  readonly selectedTaskIds = signal<Set<string>>(new Set());
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
      this.description.set(event?.description ?? '');
      this.selectedObjectiveIds.set(new Set(event?.objectiveIds ?? []));
      this.selectedTaskIds.set(new Set(event?.taskIds ?? []));
      this.error.set(null);
      this.view.set('tree');
    });
  }

  toggleObjective(objectiveId: string): void {
    const next = toggleModuleLive(objectiveId, undefined, this.selectedTaskIds(), this.selectedObjectiveIds());
    this.selectedTaskIds.set(next.taskIds);
    this.selectedObjectiveIds.set(next.objectiveIds);
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
      taskIds: [...this.selectedTaskIds()],
      description: this.description().trim()
    });
  }
}
