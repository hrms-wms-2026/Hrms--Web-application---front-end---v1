import { Component, effect, input, output, signal } from '@angular/core';
import {
  CalendarEventDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarItemDto,
  UpdateCalendarEventRequestDto
} from '../../models/dto/calendar.dto';

@Component({
  selector: 'app-calendar-event-modal',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" (click)="cancel.emit()">
      <section class="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title" (click)="$event.stopPropagation()">
        <div class="mb-4 flex items-center justify-between">
          <h2 id="calendar-event-title" class="text-lg font-semibold text-[var(--color-text-primary)]">{{ event() ? 'Edit event' : 'Create event' }}</h2>
          <button type="button" class="text-[var(--color-text-secondary)]" aria-label="Close" (click)="cancel.emit()">×</button>
        </div>
        <label class="mb-3 block text-sm text-[var(--color-text-secondary)]">Name
          <input class="mt-1 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-[var(--color-text-primary)]" [value]="name()" (input)="name.set($any($event.target).value)" maxlength="255" />
        </label>
        <label class="mb-4 block text-sm text-[var(--color-text-secondary)]">Color
          <span class="mt-1 flex gap-2">
            <input type="color" class="h-10 w-14" [value]="color()" (input)="color.set($any($event.target).value)" />
            <input class="flex-1 rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 uppercase text-[var(--color-text-primary)]" [value]="color()" (input)="color.set($any($event.target).value.toUpperCase())" pattern="^#[0-9A-Fa-f]{6}$" />
          </span>
        </label>
        <div class="mb-4 max-h-56 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Objectives</p>
          @for (item of items(); track item.objectiveId) {
            <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-surface-muted)]">
              <input type="checkbox" [checked]="selectedIds().has(item.objectiveId)" (change)="toggle(item.objectiveId)" />
              <span class="truncate text-[var(--color-text-primary)]">{{ item.title }}</span>
              @if (item.isAchieved) { <span class="text-xs text-[var(--color-text-secondary)]">Achieved</span> }
            </label>
          } @empty {
            <p class="text-sm text-[var(--color-text-secondary)]">No objectives are visible.</p>
          }
        </div>
        @if (error()) { <p class="mb-3 text-sm text-[var(--color-danger)]" role="alert">{{ error() }}</p> }
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md px-3 py-2 text-sm text-[var(--color-text-secondary)]" (click)="cancel.emit()">Cancel</button>
          <button type="button" class="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" [disabled]="!valid()" (click)="submit()">Save event</button>
        </div>
      </section>
    </div>
  `
})
export class CalendarEventModalComponent {
  readonly event = input<CalendarEventDto | null>(null);
  readonly items = input.required<readonly ProjectCalendarItemDto[]>();
  readonly cancel = output<void>();
  readonly save = output<CreateCalendarEventRequestDto | UpdateCalendarEventRequestDto>();

  readonly name = signal('');
  readonly color = signal('#2563EB');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly error = signal<string | null>(null);
  readonly valid = () => this.name().trim().length > 0 && /^#[0-9A-Fa-f]{6}$/.test(this.color()) && this.selectedIds().size > 0;

  constructor() {
    effect(() => {
      const event = this.event();
      this.name.set(event?.name ?? '');
      this.color.set(event?.color ?? '#2563EB');
      this.selectedIds.set(new Set(event?.objectiveIds ?? []));
      this.error.set(null);
    });
  }

  toggle(objectiveId: string): void {
    const next = new Set(this.selectedIds());
    next.has(objectiveId) ? next.delete(objectiveId) : next.add(objectiveId);
    this.selectedIds.set(next);
  }

  submit(): void {
    if (!this.valid()) {
      this.error.set('Enter a name, choose a valid #RRGGBB color, and select at least one objective.');
      return;
    }
    const payload = { name: this.name().trim(), color: this.color().toUpperCase(), objectiveIds: [...this.selectedIds()] };
    this.save.emit(payload);
  }
}
