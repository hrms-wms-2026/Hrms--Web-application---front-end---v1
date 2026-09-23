import { Component, effect, input, output, signal } from '@angular/core';
import {
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarModuleDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';
import { ModuleTaskPickerComponent } from '../module-task-picker/module-task-picker.component';
import { toggleModuleLive } from '../../utils/module-task-selection';

@Component({
  selector: 'app-calendar-event-modal',
  standalone: true,
  imports: [ModuleTaskPickerComponent],
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
          <label class="flex-1 text-sm text-[var(--color-text-secondary)]">Start date
            <input type="date" class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)]" [value]="startDate()" (input)="startDate.set($any($event.target).value)" data-testid="event-start-date" />
          </label>
          <label class="flex-1 text-sm text-[var(--color-text-secondary)]">End date
            <input type="date" class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)]" [value]="endDate()" (input)="endDate.set($any($event.target).value)" data-testid="event-end-date" />
          </label>
        </div>

        <label class="mb-4 block text-sm text-[var(--color-text-secondary)]">Color
          <span class="mt-1 flex gap-2">
            <input type="color" class="h-10 w-14" [value]="color()" (input)="color.set($any($event.target).value)" />
            <input class="flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 uppercase text-[var(--color-text-primary)]" [value]="color()" (input)="color.set($any($event.target).value.toUpperCase())" pattern="^#[0-9A-Fa-f]{6}$" />
          </span>
        </label>

        <div class="mb-4 max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Modules &amp; tasks</p>
          <app-module-task-picker
            moduleMode="live"
            [modules]="modules()"
            [selectedTaskIds]="selectedTaskIds()"
            [selectedObjectiveIds]="selectedObjectiveIds()"
            (selectedTaskIdsChange)="selectedTaskIds.set($event)"
            (selectedObjectiveIdsChange)="selectedObjectiveIds.set($event)"
          />
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
  readonly cancel = output<void>();
  readonly save = output<CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto>();

  readonly name = signal('');
  readonly color = signal('#2563EB');
  readonly startDate = signal('');
  readonly endDate = signal('');
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
      this.selectedObjectiveIds.set(new Set(event?.objectiveIds ?? []));
      this.selectedTaskIds.set(new Set(event?.taskIds ?? []));
      this.error.set(null);
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
      taskIds: [...this.selectedTaskIds()]
    });
  }
}
