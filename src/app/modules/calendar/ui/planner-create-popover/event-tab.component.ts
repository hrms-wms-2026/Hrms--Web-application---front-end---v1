import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { EventDraft, eventCreateRequest } from '../../utils/event-draft';
import { RecurrenceFrequency } from '../../utils/recurrence-rule.util';
import { CreateSlot, SharedCreateDraft, clock } from './planner-create-draft';
import { TEXT_LIMITS } from '../../../../shared/constants/text-limits';
import { CharCounterComponent } from '../../../../shared/ui/char-counter/char-counter.component';

/** Event tab of the Planner create popover: a personal time block (no people or link; those make it a meeting). */
@Component({
  selector: 'app-planner-event-tab',
  standalone: true,
  imports: [CharCounterComponent, DatePickerComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 text-sm">
      <input data-testid="event-tab-title" class="ui-input" placeholder="Add title" [value]="shared().title()"
        (input)="shared().title.set($any($event.target).value)" />
      <!-- Date, start → end on one line; the time inputs share what's left. -->
      <div data-testid="event-tab-when" class="flex items-center gap-2">
        <app-date-picker class="w-[9.5rem] shrink-0" data-testid="event-tab-date" size="sm" ariaLabel="Date" [showClear]="false"
          [value]="dateShown()" (valueChange)="date.set($event)" />
        @if (!shared().isAllDay()) {
          <input type="time" data-testid="event-tab-start" class="ui-input ui-input--sm flex-1" [value]="startShown()" (input)="start.set($any($event.target).value)" />
          <span class="shrink-0">→</span>
          <input type="time" data-testid="event-tab-end" class="ui-input ui-input--sm flex-1" [value]="endShown()" (input)="end.set($any($event.target).value)" />
        }
      </div>
      <div class="ev-options">
        <label class="ev-check"><input type="checkbox" data-testid="event-tab-all-day" [checked]="shared().isAllDay()"
          (change)="shared().isAllDay.set($any($event.target).checked)" /> All day</label>
        <app-select class="ev-link" data-testid="event-tab-repeat" icon="repeat" ariaLabel="Repeat" placeholder="Repeat" [searchable]="false"
          [options]="repeats" [value]="repeat() === 'none' ? null : repeat()" (valueChange)="setRepeat($event)" />
        <app-select class="ev-link" data-testid="event-tab-timezone" icon="globe" ariaLabel="Time zone" searchPlaceholder="Search time zones"
          [options]="timezoneOptions()" [value]="zone()" (valueChange)="pickedZone.set($event)" />
      </div>
      <input data-testid="event-tab-location" class="ui-input" placeholder="Add location" [value]="location()"
        (input)="location.set($any($event.target).value)" />
      <textarea data-testid="event-tab-description" class="ui-input" rows="2" placeholder="Add description" [value]="description()"
        [attr.maxlength]="limits.calendarEventDescription" (input)="description.set($any($event.target).value)"></textarea>
      <app-char-counter [length]="description().length" [max]="limits.calendarEventDescription" />
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" data-testid="event-tab-save" class="rounded-md bg-[var(--color-accent)] px-3 py-1 text-[var(--color-text-on-solid)]"
          [disabled]="!canSave()" (click)="save()">Save</button>
      </div>
    </div>
  `,
  styles: [`
    /* All day, Repeat and Time zone: the same row as the Meeting tab. */
    .ev-options { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
    .ev-check { display: inline-flex; align-items: center; gap: 7px; height: 2.125rem; padding: 0 8px; border-radius: var(--field-radius); font-size: 13px;
      white-space: nowrap; cursor: pointer; transition: background-color 140ms ease; }
    .ev-check:hover { background: var(--color-surface-secondary); }
    .ev-check input { width: 16px; height: 16px; accent-color: var(--color-accent); cursor: pointer; }
    .ev-link { display: inline-block; flex: none; width: auto; }
    .ev-link ::ng-deep .ui-field { position: relative; height: 2.125rem; padding: 0 8px; border: 0; background: transparent; box-shadow: none; cursor: pointer; }
    .ev-link ::ng-deep .ui-field:hover, .ev-link ::ng-deep .ui-field:focus-within { background: var(--color-surface-secondary); }
    .ev-link ::ng-deep .ui-field__addon { min-width: 0; padding: 0; border-right: 0; color: var(--color-text-primary); }
    .ev-link ::ng-deep .app-select__trigger { padding: 0 0 0 6px; font-size: 13px; }
    .ev-link ::ng-deep .app-select__trigger > svg { display: none; }
    .ev-link ::ng-deep .app-select__value { max-width: 9rem; color: var(--color-text-primary); }
    /* The whole pill opens the list, icon included: the icon sits outside the select's button. */
    .ev-link ::ng-deep .app-select__trigger::before { content: ''; position: absolute; inset: 0; }
  `],
})
export class EventTabComponent {
  readonly limits = TEXT_LIMITS;
  private readonly events = inject(CalendarEventStore);

  readonly slot = input.required<CreateSlot>();
  readonly shared = input.required<SharedCreateDraft>();
  /** The planner's zone: the slot's wall-clock times are in it. */
  readonly timezone = input.required<string>();
  readonly created = output<void>();

  readonly repeats: readonly SelectOption[] = [
    { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' },
  ];
  readonly date = signal('');
  /** A zone picked here; empty keeps the planner's. */
  readonly pickedZone = signal('');
  readonly zone = computed(() => this.pickedZone() || this.timezone());
  /** Every zone the browser knows, plus the current one in case it is an older alias. */
  readonly timezoneOptions = computed<readonly SelectOption[]>(() =>
    [...new Set([...Intl.supportedValuesOf('timeZone'), this.zone()])].sort().map((z) => ({ value: z, label: z })));
  readonly start = signal('');
  readonly end = signal('');
  readonly repeat = signal<RecurrenceFrequency>('none');
  readonly location = signal('');
  readonly description = signal('');
  private readonly saving = signal(false);

  /** The picked (dragged) date and time until the user changes them. */
  readonly dateShown = computed(() => this.date() || this.slot().date);
  readonly startShown = computed(() => this.start() || clock(this.slot().startMinutes));
  readonly endShown = computed(() => this.end() || clock(Math.min(this.slot().endMinutes, 24 * 60 - 1)));

  readonly draft = computed<EventDraft>(() => {
    const date = this.dateShown();
    return {
      title: this.shared().title().trim(), description: this.description().trim() || null,
      start: `${date}T${this.startShown()}`,
      end: `${date}T${this.endShown()}`,
      isAllDay: this.shared().isAllDay(), timezone: this.zone(), repeat: this.repeat(), location: this.location().trim() || null,
    };
  });
  readonly canSave = computed(() => !this.saving() && this.shared().title().trim() !== '');

  setRepeat(value: string): void {
    this.repeat.set(value as RecurrenceFrequency);
  }

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
