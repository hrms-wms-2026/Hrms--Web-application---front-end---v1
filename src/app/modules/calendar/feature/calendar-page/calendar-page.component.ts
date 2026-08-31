import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CalendarEventResponse, RecurrenceEditScope } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarEventFormModalComponent, CalendarEventFormSubmission } from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarEventFormModalComponent],
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  readonly store = inject(CalendarEventStore);

  readonly view = signal<'month'>('month'); // wired for future week/day/agenda views - only 'month' is ever set in R1
  readonly cursor = signal(new Date());
  readonly formOpen = signal(false);
  readonly editingEvent = signal<CalendarEventResponse | null>(null);

  readonly year = computed(() => this.cursor().getFullYear());
  readonly month = computed(() => this.cursor().getMonth() + 1);

  private readonly rangeEffect = effect(() => {
    const grid = buildMonthGrid(this.year(), this.month());
    const from = `${grid[0].date}T00:00:00Z`;
    const to = `${grid[grid.length - 1].date}T23:59:59Z`;
    this.store.loadEvents(from, to);
  });

  previousMonth(): void {
    const d = this.cursor();
    this.cursor.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.cursor();
    this.cursor.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  goToToday(): void {
    this.cursor.set(new Date());
  }

  openCreate(): void {
    this.editingEvent.set(null);
    this.formOpen.set(true);
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    this.editingEvent.set(found);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
  }

  private currentRange(): { from: string; to: string } {
    const grid = buildMonthGrid(this.year(), this.month());
    return { from: `${grid[0].date}T00:00:00Z`, to: `${grid[grid.length - 1].date}T23:59:59Z` };
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    const editing = this.editingEvent();
    let ok: boolean;

    if ('update' in submission && editing) {
      if (submission.scope && editing.recurrenceMasterId) {
        // scope is 'ThisEventOnly' or 'AllEvents', chosen via the form's own two buttons - both
        // route through the occurrence endpoint, which is the only one that understands scope.
        const { from, to } = this.currentRange();
        ok = await this.store.editOccurrence(
          editing.recurrenceMasterId,
          { originalStart: editing.originalStart!, scope: submission.scope, ...submission.update },
          from, to
        );
      } else {
        // scope is null: a plain manual event, or an already-detached occurrence edited by its own id.
        ok = await this.store.updateEvent(editing.id, submission.update);
      }
    } else if ('create' in submission) {
      ok = await this.store.createEvent(submission.create);
    } else {
      ok = false;
    }

    if (ok) this.closeForm();
  }

  async onDelete(scope: RecurrenceEditScope | null): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const { from, to } = this.currentRange();

    if (scope === 'ThisEventOnly' && editing.recurrenceMasterId) {
      await this.store.cancelOccurrence(editing.recurrenceMasterId, editing.originalStart!, from, to);
    } else if (scope === 'AllEvents' && editing.recurrenceMasterId) {
      // Deleting the master's own id (never itself present in store.events()) leaves the now-gone
      // virtual occurrences stranded in local state until reloaded - reload explicitly afterward
      // rather than relying on deleteEvent's plain id-filter, which can't match a master's id.
      await this.store.deleteEvent(editing.recurrenceMasterId);
      await this.store.loadEvents(from, to);
    } else {
      await this.store.deleteEvent(editing.id);
    }
    this.closeForm();
  }
}
