import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { EventDraft, eventCreateRequest } from '../../utils/event-draft';
import { RecurrenceFrequency } from '../../utils/recurrence-rule.util';
import { CreateSlot, SharedCreateDraft, clock } from './planner-create-draft';

/** Event tab of the Planner create popover: a personal time block (no people or link; those make it a meeting). */
@Component({
  selector: 'app-planner-event-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 text-sm">
      <input data-testid="event-tab-title" class="ui-input" placeholder="Add title" [value]="shared().title()"
        (input)="shared().title.set($any($event.target).value)" />
      <div class="flex flex-wrap items-center gap-2">
        <span>{{ slot().date }}</span>
        @if (!shared().isAllDay()) {
          <input type="time" data-testid="event-tab-start" class="ui-input ui-input--sm" [value]="startShown()" (input)="start.set($any($event.target).value)" />
          <span>→</span>
          <input type="time" data-testid="event-tab-end" class="ui-input ui-input--sm" [value]="endShown()" (input)="end.set($any($event.target).value)" />
        }
      </div>
      <div class="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <label class="flex items-center gap-1"><input type="checkbox" data-testid="event-tab-all-day" [checked]="shared().isAllDay()"
          (change)="shared().isAllDay.set($any($event.target).checked)" /> All day</label>
        <span data-testid="event-tab-timezone">{{ timezone() }}</span>
        <select data-testid="event-tab-repeat" aria-label="Repeat" [value]="repeat()" (change)="repeat.set($any($event.target).value)">
          @for (r of repeats; track r.value) { <option [value]="r.value" [selected]="r.value === repeat()">{{ r.label }}</option> }
        </select>
      </div>
      <input data-testid="event-tab-location" class="ui-input" placeholder="Add location" [value]="location()"
        (input)="location.set($any($event.target).value)" />
      <textarea data-testid="event-tab-description" class="ui-input" rows="2" placeholder="Add description" [value]="description()"
        (input)="description.set($any($event.target).value)"></textarea>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" data-testid="event-tab-more" class="rounded-md border px-3 py-1" (click)="moreOptions.emit(draft())">More options</button>
        <button type="button" data-testid="event-tab-save" class="rounded-md bg-[var(--color-accent)] px-3 py-1 text-white"
          [disabled]="!canSave()" (click)="save()">Save</button>
      </div>
    </div>
  `,
})
export class EventTabComponent {
  private readonly events = inject(CalendarEventStore);

  readonly slot = input.required<CreateSlot>();
  readonly shared = input.required<SharedCreateDraft>();
  /** The planner's zone: the slot's wall-clock times are in it. */
  readonly timezone = input.required<string>();
  readonly created = output<void>();
  readonly moreOptions = output<EventDraft>();

  readonly repeats: readonly { value: RecurrenceFrequency; label: string }[] = [
    { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' },
  ];
  readonly start = signal('');
  readonly end = signal('');
  readonly repeat = signal<RecurrenceFrequency>('none');
  readonly location = signal('');
  readonly description = signal('');
  private readonly saving = signal(false);

  /** The picked (dragged) time until the user changes it. */
  readonly startShown = computed(() => this.start() || clock(this.slot().startMinutes));
  readonly endShown = computed(() => this.end() || clock(Math.min(this.slot().endMinutes, 24 * 60 - 1)));

  readonly draft = computed<EventDraft>(() => {
    const date = this.slot().date;
    return {
      title: this.shared().title().trim(), description: this.description().trim() || null,
      start: `${date}T${this.startShown()}`,
      end: `${date}T${this.endShown()}`,
      isAllDay: this.shared().isAllDay(), timezone: this.timezone(), repeat: this.repeat(), location: this.location().trim() || null,
    };
  });
  readonly canSave = computed(() => !this.saving() && this.shared().title().trim() !== '');

  async save(): Promise<void> {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      const created = await this.events.createEvent(eventCreateRequest(this.draft()));
      if (created) this.created.emit();
    } finally {
      this.saving.set(false);
    }
  }
}
