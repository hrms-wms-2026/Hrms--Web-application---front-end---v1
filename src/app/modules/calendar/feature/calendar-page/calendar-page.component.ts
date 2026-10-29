import { MeetingCreatedEvent, drawerKeyForCreated } from '../../../work/meetings/utils/meeting-created-drawer.util';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { MeetingFormModalComponent, MeetingPrefill } from '../../../work/meetings/ui/meeting-form-modal/meeting-form-modal.component';
import { MeetingsAvailabilityService } from '../../../work/meetings/state/meetings-availability.service';
import { MeetingOccurrenceDrawerComponent } from '../../../work/meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CalendarEventResponse, MeetingProvider, RecurrenceEditScope } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { CalendarDayViewComponent } from '../calendar-day-view/calendar-day-view.component';
import { CalendarAgendaViewComponent } from '../calendar-agenda-view/calendar-agenda-view.component';
import {
  CalendarEventFormModalComponent, CalendarEventFormSubmission, RespondToCalendarEventPayload
} from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { localPartsToUtcIso } from '../../../../shared/utils/timezone.util';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import {
  PlannerDayResponse, PlannerFocusItem, PlannerRangeBlockView, PlannerRangeDay
} from '../../../work/planner/models/planner.models';
import { PlannerLayerStore } from '../../state/planner-layer.store';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { PlannerDayLoad } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { PlannerFocusPanelComponent } from '../../ui/planner-focus-panel/planner-focus-panel.component';
import { PlannerBlockPickerComponent } from '../../ui/planner-block-picker/planner-block-picker.component';
import { PlannerMonthSummary } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { MinuteRange, blockRange, busyIntervals, dayLoad, moveAfterSlot, windowMinutes } from '../../utils/planner-grid.util';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const jsDay = d.getDay();
  const daysBackToMonday = jsDay === 0 ? 6 : jsDay - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBackToMonday);
}

/** h/m text: "1h 30m", "7h", "45m". */
function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page only.
  }
}

const CONNECTED_PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Calendar',
  microsoft: 'Outlook'
};

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarWeekViewComponent,
    CalendarDayViewComponent, CalendarAgendaViewComponent, CalendarEventFormModalComponent, MeetingFormModalComponent,
    MeetingOccurrenceDrawerComponent, PlannerFocusPanelComponent, PlannerBlockPickerComponent, TaskFormModalComponent, DatePickerComponent
  ],
  // The planner layer belongs to this page: it loads with the visible range and goes away with the page.
  providers: [PlannerLayerStore],
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  readonly store = inject(CalendarEventStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projects = inject(ProjectDetailStore);
  /** A task opened from a block or a Focus card: shown over the planner, so closing it stays here. */
  readonly openedTask = signal<{ projectId: string; taskId: string } | null>(null);
  private readonly notificationService = inject(NotificationService);

  readonly view = signal<CalendarView>('week');
  readonly cursor = signal(new Date());
  readonly formOpen = signal(false);
  readonly editingEvent = signal<CalendarEventResponse | null>(null);
  readonly prefillStart = signal<string | null>(null);
  readonly prefillEnd = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly meetingFormOpen = signal(false);
  /** Set when a new calendar event with people is handed over to the meeting form. */
  readonly meetingPrefill = signal<MeetingPrefill | null>(null);
  readonly meetingsAvailability = inject(MeetingsAvailabilityService);
  readonly openMeeting = signal<{ seriesId: string; originalStart: string } | null>(null);

  // --- Planner layer (2026-10-27 Planner = Calendar design). Inert while the planner is off. ---
  readonly planner = inject(PlannerLayerStore);
  private readonly plannerApi = inject(PlannerApiService);
  private readonly auth = inject(AuthStore);
  readonly employeeId = computed(() => this.auth.employeeId());
  /** Week view's Focus panel; Day view always shows it. */
  readonly focusOpen = signal(readFlag('planner.focusOpen', true));
  /** Month and Agenda show the panel only when asked. */
  readonly focusOpenElsewhere = signal(false);
  readonly showWeekend = signal(readFlag('planner.showWeekend', false));
  readonly plannerDay = signal<PlannerDayResponse | null>(null);
  readonly pickerItem = signal<PlannerFocusItem | PlannerRangeBlockView | null>(null);

  readonly showPanel = computed(() => {
    if (!this.planner.active()) return false;
    switch (this.view()) {
      case 'day': return true;
      case 'week': return this.focusOpen();
      default: return this.focusOpenElsewhere();
    }
  });

  readonly plannerBlocks = computed(() => new Map([...this.planner.dayByDate()].map(([date, day]) => [date, day.blocks])));
  readonly plannerWindows = computed(() => new Map([...this.planner.dayByDate()].map(([date, day]) => [date, day.workWindow])));
  readonly plannerEditable = computed(() => new Set([...this.planner.dayByDate().values()].filter((d) => d.editable).map((d) => d.date)));
  readonly editableDateList = computed(() => [...this.plannerEditable()].sort());

  /** Each day's load: blocks and busy calendar items, overlapping time counted once (design call C2). */
  readonly plannerLoads = computed(() => {
    const loads = new Map<string, PlannerDayLoad & { readonly blockCount: number; readonly meetingCount: number }>();
    const timezone = this.store.myTimezone();
    for (const day of this.planner.dayByDate().values()) {
      const busy = busyIntervals(this.store.events(), this.employeeId(), day.date, timezone);
      const load = dayLoad(day.blocks.map((b) => blockRange(b, day.date, timezone)), busy, day.workingMinutes);
      const meetingIds = new Set(this.store.events().filter((e) => e.itemKind === 'meeting').map((e) => e.id));
      loads.set(day.date, {
        plannedMinutes: load.plannedMinutes, workingMinutes: day.workingMinutes, over: load.over,
        blockCount: day.blocks.length, meetingCount: busy.filter((b) => meetingIds.has(b.eventId)).length,
      });
    }
    return loads;
  });

  /** The header load bar, for days with working hours. */
  readonly gridLoads = computed(() => new Map([...this.plannerLoads()].filter(([, l]) => l.workingMinutes > 0)));

  readonly monthSummaries = computed(() => new Map<string, PlannerMonthSummary>([...this.plannerLoads()]
    .filter(([, l]) => l.blockCount > 0 || l.meetingCount > 0)
    .map(([date, l]) => [date, { tasks: l.blockCount, meetings: l.meetingCount, plannedMinutes: l.plannedMinutes }])));

  readonly agendaBlocks = computed(() => [...this.planner.dayByDate().values()].flatMap((d) => d.blocks));

  /** Week view: the legal entity's working days unless "Show weekend" is on (all seven when the schedule is unknown). */
  readonly weekDays = computed<readonly string[] | null>(() => {
    if (!this.planner.active() || this.showWeekend()) return null;
    const all = Array.from({ length: 7 }, (_, i) => addDays(this.weekStart(), i));
    return all.filter((date) => this.planner.dayByDate().get(date)?.workWindow?.isWorkingDay !== false);
  });

  readonly dayTotals = computed(() => {
    const day = this.planner.dayByDate().get(this.dayDate());
    if (!day) return null;
    const load = this.plannerLoads().get(day.date);
    const planned = load?.plannedMinutes ?? 0;
    const actual = this.plannerDay();
    return {
      working: day.workWindow ? duration(day.workingMinutes) : null,
      planned: duration(planned),
      free: duration(Math.max(0, day.workingMinutes - planned)),
      actual: actual ? `${duration(actual.totals.actualMinutes)} / ${duration(actual.attendanceMinutes)}` : null,
    };
  });

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

  private readonly plannerRangeEffect = effect(() => {
    const { from, to } = this.plannerRange();
    void this.planner.load(from, to);
  });

  /** Day view's actual minutes and attendance come from the day read. */
  private readonly plannerDayEffect = effect(() => {
    const date = this.dayDate();
    if (this.view() !== 'day' || !this.planner.active()) {
      this.plannerDay.set(null);
      return;
    }
    // The day shown before keeps no numbers on this one while its own read is on the way.
    untracked(() => this.plannerDay.set(null));
    firstValueFrom(this.plannerApi.getMyDay(date))
      .then((day) => this.plannerDayFor(date, day))
      .catch(() => this.plannerDayFor(date, null));
  });

  /** A day read lands only if that day is still the one shown. */
  plannerDayFor(date: string, day: PlannerDayResponse | null): void {
    if (date === this.dayDate()) this.plannerDay.set(day);
  }

  // actionError was already tracked in store state but never surfaced anywhere - a failed
  // create/update/delete/respond/meeting action silently did nothing visible. NotificationService
  // already dedupes a repeated identical message, so this can't spam on unrelated re-renders.
  private readonly actionErrorEffect = effect(() => {
    const error = this.store.actionError();
    if (error) this.notificationService.error(error);
  });

  constructor() {
    this.store.loadMyTimezone();
    this.store.loadMeetingConnectionStatus();
    this.handleCalendarConnectionRedirect();
  }

  /**
   * The backend's OAuth callback (CalendarOAuthCallbackController) redirects the browser straight
   * back to /calendar?connected={provider} or ?connectionError=1 once the connection completes -
   * there is no dedicated frontend callback route. Surface the result as a toast once, then strip
   * the query params so a refresh doesn't re-show it.
   */
  private handleCalendarConnectionRedirect(): void {
    const params = this.route.snapshot.queryParamMap;
    const connected = params.get('connected');
    const hasError = params.has('connectionError');
    if (!connected && !hasError) {
      return;
    }

    if (connected) {
      const label = CONNECTED_PROVIDER_LABELS[connected] ?? connected;
      this.notificationService.success(`${label} connected.`);
    } else {
      this.notificationService.error('Could not connect the calendar. Please try again.');
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true
    });
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

  /** The planner's dates for the visible range (a month grid is at most 42 days). */
  private plannerRange(): { from: string; to: string } {
    switch (this.view()) {
      case 'month': {
        const grid = buildMonthGrid(this.year(), this.month());
        return { from: grid[0].date, to: grid[Math.min(grid.length, 42) - 1].date };
      }
      case 'week':
        return { from: this.weekStart(), to: addDays(this.weekStart(), 6) };
      case 'day':
        return { from: this.dayDate(), to: this.dayDate() };
      case 'agenda': {
        const start = toDateString(this.cursor());
        return { from: start, to: addDays(start, 30) };
      }
    }
  }

  setView(view: CalendarView): void {
    this.view.set(view);
  }

  openDay(date: string): void {
    const [y, m, d] = date.split('-').map(Number);
    this.cursor.set(new Date(y, m - 1, d));
    this.view.set('day');
  }

  toggleFocus(): void {
    if (this.view() === 'week') {
      this.focusOpen.update((open) => !open);
      writeFlag('planner.focusOpen', this.focusOpen());
    } else if (this.view() !== 'day') {
      this.focusOpenElsewhere.update((open) => !open);
    }
  }

  closeFocus(): void {
    if (this.view() === 'week') {
      this.focusOpen.set(false);
      writeFlag('planner.focusOpen', false);
    } else {
      this.focusOpenElsewhere.set(false);
    }
  }

  toggleWeekend(): void {
    this.showWeekend.update((show) => !show);
    writeFlag('planner.showWeekend', this.showWeekend());
  }

  onBlockCreate(e: { taskId: string; date: string; startMinutes: number; endMinutes: number }): void {
    void this.planner.createBlock(e.taskId, this.toIso(e.date, e.startMinutes), this.toIso(e.date, e.endMinutes));
  }

  onBlockMove(e: { blockId: string; date: string; startMinutes: number; endMinutes: number }): void {
    void this.planner.moveBlock(e.blockId, this.toIso(e.date, e.startMinutes), this.toIso(e.date, e.endMinutes));
  }

  onBlockRemove(blockId: string): void {
    void this.planner.removeBlock(blockId);
  }

  /** "Move after": the first free slot of the same length after the meeting, inside working hours, clear of everything. */
  onBlockMoveAfter(e: { block: PlannerRangeBlockView; date: string; afterMinute: number }): void {
    const timezone = this.store.myTimezone();
    const day: PlannerRangeDay | undefined = this.planner.dayByDate().get(e.date);
    const own = blockRange(e.block, e.date, timezone);
    const taken: MinuteRange[] = [
      ...(day?.blocks ?? []).filter((b) => b.id !== e.block.id).map((b) => blockRange(b, e.date, timezone)),
      ...busyIntervals(this.store.events(), this.employeeId(), e.date, timezone),
    ];
    const window = day?.workWindow ? windowMinutes(day.workWindow) : null;
    const start = moveAfterSlot(own.end - own.start, e.afterMinute, taken, window);
    if (start === null) {
      const [y, m, d] = e.date.split('-').map(Number);
      const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
      this.notificationService.warning(`No free time left on ${label} for this block`);
      return;
    }
    void this.planner.moveBlock(e.block.id, this.toIso(e.date, start), this.toIso(e.date, start + own.end - own.start));
  }

  async openTask(projectId: string, taskId: string): Promise<void> {
    // The task form reads its project from ProjectDetailStore (as the people drill-down does).
    await this.projects.loadProject(projectId);
    if (this.projects.projectError()) {
      void this.router.navigate(['/work', projectId, 'board'], { queryParams: { taskId } });
      return;
    }
    await this.projects.loadMyMilestones(projectId);
    this.openedTask.set({ projectId, taskId });
  }

  closeTask(): void {
    this.openedTask.set(null);
  }

  /** A saved task may change its estimate, due date or title: refresh the Focus list, blocks and events. */
  onTaskSaved(): void {
    const { from, to } = this.plannerRange();
    void this.planner.load(from, to);
    const range = this.currentRange();
    this.store.loadEvents(range.from, range.to);
  }

  onPickerSubmitted(e: { date: string; startMinutes: number; minutes: number }): void {
    const item = this.pickerItem();
    this.pickerItem.set(null);
    if (!item) return;
    const start = this.toIso(e.date, e.startMinutes);
    const end = this.toIso(e.date, Math.min(e.startMinutes + e.minutes, 24 * 60));
    if ('id' in item) void this.planner.moveBlock(item.id, start, end);
    else void this.planner.createBlock(item.taskId, start, end);
  }

  /** Minutes from local midnight of `date` as an instant; 24:00 is the next day's midnight. */
  private toIso(date: string, minutes: number): string {
    const day = minutes >= 24 * 60 ? addDays(date, 1) : date;
    const m = minutes % (24 * 60);
    const clock = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    // The planner's own zone: the calendar's may still be its UTC default for a moment after the page opens.
    return localPartsToUtcIso(day, clock, this.planner.range()?.timezone ?? this.store.myTimezone());
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

  /** The period label's date picker: the view moves to the period that holds the picked date ('YYYY-MM-DD', local). */
  readonly periodPickerOpen = signal(false);

  jumpTo(date: string): void {
    const [y, m, d] = date.split('-').map(Number);
    if (y && m && d) this.cursor.set(new Date(y, m - 1, d));
    this.periodPickerOpen.set(false);
  }

  /** A meeting may have been edited, moved or cancelled in its drawer: refresh the calendar. */
  async onMeetingDrawerClosed(): Promise<void> {
    this.openMeeting.set(null);
    await this.reloadEvents();
  }

  /** A meeting work item was created (or sent for approval): close the form and show it on the calendar. */
  /** Meetings-as-tasks: a new event that would have people or a link becomes a Meeting work item instead. */
  onConvertToMeeting(prefill: MeetingPrefill): void {
    this.formOpen.set(false);
    this.meetingPrefill.set(prefill);
    this.meetingFormOpen.set(true);
  }

  async onMeetingSaved(event?: MeetingCreatedEvent): Promise<void> {
    this.meetingFormOpen.set(false);
    await this.reloadEvents();
    // A new meeting opens in its drawer; a request sent for approval has nothing to open yet.
    const key = event ? drawerKeyForCreated(event) : null;
    if (key) this.openMeeting.set(key);
  }

  openCreate(prefillStart?: string, prefillEnd?: string): void {
    this.editingEvent.set(null);
    this.prefillStart.set(prefillStart ?? null);
    this.prefillEnd.set(prefillEnd ?? null);
    this.formOpen.set(true);
  }

  onSlotClick(slot: { date: string; hour: number }): void {
    this.openCreate(`${slot.date}T${String(slot.hour).padStart(2, '0')}:00`);
  }

  onSlotRange(range: { date: string; startMinutes: number; endMinutes: number }): void {
    const hhmm = (minutes: number) =>
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    this.openCreate(`${range.date}T${hhmm(range.startMinutes)}`, `${range.date}T${hhmm(range.endMinutes)}`);
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    // A task meeting opens its own drawer by series + original start (it may not be materialized yet, so it has no
    // task id); it never goes through the legacy /calendar/{id} event actions.
    if (found?.itemKind === 'meeting' && found.meetingSeriesId) {
      this.openMeeting.set({ seriesId: found.meetingSeriesId, originalStart: found.originalStart ?? found.startDate });
      return;
    }
    this.editingEvent.set(found);
    this.prefillStart.set(null);
    this.prefillEnd.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
    this.prefillStart.set(null);
    this.prefillEnd.set(null);
    this.store.clearConflicts();
    this.store.clearEligibleNominees();
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    // store.saving ends after the event POST, so the follow-up meeting call left Create clickable and a 2nd click duplicated the event.
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
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
          if (ok) await this.reloadEvents();
        }
      } else if ('create' in submission) {
        const created = await this.store.createEvent(submission.create);
        ok = !!created;
        if (created && submission.meetingProvider) {
          // The event was created with this meeting pending, so its invites were held back for the link: a failed
          // link keeps the event and sends them without one; the store's actionError explains what happened (P1-5).
          await this.store.createMeeting(created.id, submission.meetingProvider, true);
        }
        if (created) await this.reloadEvents();
      } else {
        ok = false;
      }

      if (ok) this.closeForm();
    } finally {
      this.submitting.set(false);
    }
  }

  async onMeetingStatusChanged(): Promise<void> {
    const editing = this.editingEvent();
    await this.reloadEvents();
    if (editing) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  /** The create/update responses carry no participants, organizer or conflict flags, so the saved event is re-read from the server. */
  private reloadEvents(): Promise<void> {
    const { from, to } = this.currentRange();
    return this.store.loadEvents(from, to);
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

  onCheckConflicts(payload: {
    participantEmployeeIds: readonly string[]; startDate: string; endDate: string; isAllDay?: boolean; timeZone?: string;
  }): void {
    this.store.checkConflicts(payload.participantEmployeeIds, payload.startDate, payload.endDate,
      { isAllDay: payload.isAllDay, timeZone: payload.timeZone });
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

  async onAddMeeting(provider: MeetingProvider): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.createMeeting(editing.id, provider);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  async onRemoveMeeting(): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.removeMeeting(editing.id);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  async onAddParticipantsToEvent(employeeIds: readonly string[]): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.addParticipants(editing.id, employeeIds);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  async onRemoveExistingParticipant(employeeId: string): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.removeParticipant(editing.id, employeeId);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  async onAddGuestsToEvent(emails: readonly string[]): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.addGuests(editing.id, emails);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }

  async onRemoveExistingGuest(email: string): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const ok = await this.store.removeGuest(editing.id, email);
    if (ok) this.editingEvent.set(this.store.events().find((e) => e.id === editing.id) ?? null);
  }
}
