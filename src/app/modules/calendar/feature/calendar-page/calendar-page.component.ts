import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CalendarEventResponse, RecurrenceEditScope } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { CalendarDayViewComponent } from '../calendar-day-view/calendar-day-view.component';
import { CalendarAgendaViewComponent } from '../calendar-agenda-view/calendar-agenda-view.component';
import {
  CalendarEventFormModalComponent, CalendarEventFormSubmission, RespondToCalendarEventPayload
} from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const jsDay = d.getDay();
  const daysBackToMonday = jsDay === 0 ? 6 : jsDay - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBackToMonday);
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarWeekViewComponent,
    CalendarDayViewComponent, CalendarAgendaViewComponent, CalendarEventFormModalComponent
  ],
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  readonly store = inject(CalendarEventStore);

  readonly view = signal<CalendarView>('day');
  readonly cursor = signal(new Date());
  readonly formOpen = signal(false);
  readonly editingEvent = signal<CalendarEventResponse | null>(null);
  readonly prefillStart = signal<string | null>(null);

  readonly year = computed(() => this.cursor().getFullYear());
  readonly month = computed(() => this.cursor().getMonth() + 1);
  readonly weekStart = computed(() => toDateString(startOfWeek(this.cursor())));
  readonly dayDate = computed(() => toDateString(this.cursor()));

  readonly viewLabel = computed(() => {
    const c = this.cursor();
    switch (this.view()) {
      case 'month': return c.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'week': return `Week of ${this.weekStart()}`;
      case 'day': return this.dayDate();
      case 'agenda': return 'Agenda';
    }
  });

  private readonly rangeEffect = effect(() => {
    const { from, to } = this.currentRange();
    this.store.loadEvents(from, to);
  });

  constructor() {
    this.store.loadMyTimezone();
  }

  private currentRange(): { from: string; to: string } {
    switch (this.view()) {
      case 'month': {
        const grid = buildMonthGrid(this.year(), this.month());
        return { from: `${grid[0].date}T00:00:00Z`, to: `${grid[grid.length - 1].date}T23:59:59Z` };
      }
      case 'week': {
        const start = this.weekStart();
        const startDate = new Date(`${start}T00:00:00`);
        const end = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
        return { from: `${start}T00:00:00Z`, to: `${toDateString(end)}T00:00:00Z` };
      }
      case 'day': {
        const date = this.dayDate();
        return { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` };
      }
      case 'agenda': {
        const start = toDateString(this.cursor());
        const end = new Date(this.cursor());
        end.setDate(end.getDate() + 30);
        return { from: `${start}T00:00:00Z`, to: `${toDateString(end)}T23:59:59Z` };
      }
    }
  }

  setView(view: CalendarView): void {
    this.view.set(view);
  }

  previous(): void {
    this.step(-1);
  }

  next(): void {
    this.step(1);
  }

  private step(direction: 1 | -1): void {
    const d = this.cursor();
    switch (this.view()) {
      case 'month':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth() + direction, 1));
        break;
      case 'week':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction * 7));
        break;
      case 'day':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction));
        break;
      case 'agenda':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction * 30));
        break;
    }
  }

  goToToday(): void {
    this.cursor.set(new Date());
  }

  openCreate(prefillDate?: string): void {
    this.editingEvent.set(null);
    this.prefillStart.set(prefillDate ?? null);
    this.formOpen.set(true);
  }

  onSlotClick(slot: { date: string; hour: number }): void {
    this.openCreate(`${slot.date}T${String(slot.hour).padStart(2, '0')}:00`);
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    this.editingEvent.set(found);
    this.prefillStart.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
    this.prefillStart.set(null);
    this.store.clearConflicts();
    this.store.clearEligibleNominees();
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    const editing = this.editingEvent();
    let ok: boolean;

    if ('update' in submission && editing) {
      if (submission.scope && editing.recurrenceMasterId) {
        const { from, to } = this.currentRange();
        ok = await this.store.editOccurrence(
          editing.recurrenceMasterId,
          { originalStart: editing.originalStart!, scope: submission.scope, ...submission.update },
          from, to
        );
      } else {
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
      await this.store.deleteEvent(editing.recurrenceMasterId);
      await this.store.loadEvents(from, to);
    } else {
      await this.store.deleteEvent(editing.id);
    }
    this.closeForm();
  }

  onCheckConflicts(payload: { participantEmployeeIds: readonly string[]; startDate: string; endDate: string }): void {
    this.store.checkConflicts(payload.participantEmployeeIds, payload.startDate, payload.endDate);
  }

  async onRespond(payload: RespondToCalendarEventPayload): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const eventId = editing.recurrenceMasterId ?? editing.id;
    const { from, to } = this.currentRange();
    const ok = await this.store.respondToEvent(eventId, payload.status, from, to, payload.reason, payload.nomineeEmployeeId);
    if (ok) this.closeForm();
  }

  onLoadEligibleNominees(): void {
    const editing = this.editingEvent();
    if (!editing) return;
    const eventId = editing.recurrenceMasterId ?? editing.id;
    this.store.loadEligibleNominees(eventId);
  }
}
