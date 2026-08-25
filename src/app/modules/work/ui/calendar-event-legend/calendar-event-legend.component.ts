import { Component, input, output } from '@angular/core';
import { CalendarEventDto } from '../../models/dto/calendar.dto';

@Component({
  selector: 'app-calendar-event-legend',
  standalone: true,
  template: `
    <aside class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3" aria-label="Calendar events">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold text-[var(--color-text-primary)]">Events</h2>
        <span class="text-xs text-[var(--color-text-secondary)]">{{ events().length }}</span>
      </div>
      @for (event of events(); track event.id) {
        <div class="flex items-center gap-2 border-t border-[var(--color-border)] py-2 text-sm">
          <span class="h-3 w-3 rounded-full" [style.backgroundColor]="event.color" aria-hidden="true"></span>
          <span class="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{{ event.name }}</span>
          <button type="button" class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" [attr.aria-label]="'Edit ' + event.name" (click)="edit.emit(event)">Edit</button>
          <button type="button" class="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-danger)]" [attr.aria-label]="'Close ' + event.name" (click)="close.emit(event.id)">Close</button>
        </div>
      } @empty {
        <p class="text-xs text-[var(--color-text-secondary)]">No active events yet.</p>
      }
    </aside>
  `
})
export class CalendarEventLegendComponent {
  readonly events = input.required<readonly CalendarEventDto[]>();
  readonly edit = output<CalendarEventDto>();
  readonly close = output<string>();
}
