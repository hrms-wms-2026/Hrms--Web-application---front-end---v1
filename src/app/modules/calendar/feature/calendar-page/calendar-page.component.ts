import { MeetingCreatedEvent, drawerKeyForCreated } from '../../../work/meetings/utils/meeting-created-drawer.util';
import { TemplatePortal } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, DestroyRef, TemplateRef, ViewContainerRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { MeetingFormModalComponent } from '../../../work/meetings/ui/meeting-form-modal/meeting-form-modal.component';
import { MeetingDelegatesModalComponent } from '../../ui/meeting-delegates-modal/meeting-delegates-modal.component';
import { MeetingPrincipalsStore } from '../../../work/meetings/state/meeting-principals.store';
import { MeetingsAvailabilityService } from '../../../work/meetings/state/meetings-availability.service';
import { MeetingOccurrenceDrawerComponent } from '../../../work/meetings/feature/meeting-occurrence-drawer/meeting-occurrence-drawer.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { NavigationStateService } from '../../../../layouts/main-layout/nav/navigation-state.service';
import { CalendarEventResponse, MeetingProvider, RecurrenceEditScope } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { CalendarDayViewComponent } from '../calendar-day-view/calendar-day-view.component';
import {
  CalendarEventFormModalComponent, CalendarEventFormSubmission, RespondToCalendarEventPayload
} from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { PlannerCreatePopoverComponent } from '../../ui/planner-create-popover/planner-create-popover.component';
import { EventTabComponent } from '../../ui/planner-create-popover/event-tab.component';
import { WorkItemDraft, WorkItemTabComponent, WorkItemToPlace } from '../../ui/planner-create-popover/work-item-tab.component';
import { TaskFormPrefill } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { plannerErrorMessage } from '../../../work/planner/utils/planner-error-messages';
import { TimeOffDraft, TimeOffTabComponent } from '../../ui/planner-create-popover/time-off-tab.component';
import { NewLeaveRequestWizardComponent } from '../../../leave/ui/new-leave-request-wizard/new-leave-request-wizard.component';
import { LeaveTypeStore } from '../../../leave/state/leave-type.store';
import { LeaveBalanceStore } from '../../../leave/state/leave-balance.store';
import { LeaveRequestStore } from '../../../leave/state/leave-request.store';
import { LeaveUploadedDocument, SubmitLeaveRequestRequest } from '../../../leave/models/leave-request.model';
import { WorkItemPlanFlow } from '../../state/work-item-plan-flow.service';
import { PlannerLeaveLayerStore } from '../../state/planner-leave-layer.store';
import { TeamPlannerStore } from '../../state/team-planner.store';
import { TeamPlannerComponent } from '../team-planner/team-planner.component';
import { MyTeamCapabilitiesStore } from '../../../dashboard/state/my-team-capabilities.store';
import { CREATE_TAB_ORDER, CreateSlot, CreateTab, clock } from '../../ui/planner-create-popover/planner-create-draft';
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

export type CalendarView = 'month' | 'week' | 'day';

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

/** Where the layout shows its sub-sidebar. */
const WIDE_SCREEN = '(min-width: 769px)';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarWeekViewComponent,
    CalendarDayViewComponent, CalendarEventFormModalComponent, MeetingFormModalComponent,
    MeetingOccurrenceDrawerComponent, PlannerFocusPanelComponent, PlannerBlockPickerComponent, TaskFormModalComponent, DatePickerComponent,
    PlannerCreatePopoverComponent, EventTabComponent, WorkItemTabComponent, TimeOffTabComponent, NewLeaveRequestWizardComponent,
    TeamPlannerComponent, SelectComponent, MeetingDelegatesModalComponent
  ],
  // The planner layer belongs to this page: it loads with the visible range and goes away with the page.
  providers: [PlannerLayerStore, WorkItemPlanFlow, PlannerLeaveLayerStore, TeamPlannerStore],
  // A real height on wide screens, so the Task list sub-sidebar can fill the column.
  host: { class: 'block md:h-full' },
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  /** The "Meeting delegates" dialog: who may run the caller's meetings. */
  protected readonly meetingDelegatesOpen = signal(false);
  /** The people whose meetings the caller may run; the "whose calendar" selector shows only when there is one. */
  readonly principals = inject(MeetingPrincipalsStore);
  /** A principal's calendar shown to their meeting delegate; null = the caller's own. Their days are read-only here:
   * a delegate schedules meetings for them, nothing else. */
  readonly viewingFor = signal<string | null>(null);
  readonly viewingForOptions = computed<readonly SelectOption[]>(() => [
    { value: '', label: 'My calendar' },
    ...this.principals.principals().map((p) => ({ value: p.employeeId, label: `${p.name}'s calendar` })),
  ]);
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
  readonly submitting = signal(false);
  readonly meetingsAvailability = inject(MeetingsAvailabilityService);
  readonly openMeeting = signal<{ seriesId: string; originalStart: string } | null>(null);

  // --- Planner layer (2026-10-27 Planner = Calendar design). Inert while the planner is off. ---
  readonly planner = inject(PlannerLayerStore);
  private readonly plannerApi = inject(PlannerApiService);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(PermissionService);
  readonly employeeId = computed(() => this.auth.employeeId());
  readonly showWeekend = signal(readFlag('planner.showWeekend', false));
  readonly plannerDay = signal<PlannerDayResponse | null>(null);
  readonly pickerItem = signal<PlannerFocusItem | PlannerRangeBlockView | null>(null);

  /** The Task list goes with the planner; the team view has its own controls. */
  readonly taskListOn = computed(() => this.planner.active() && !this.teamMode() && !this.viewingFor());
  /** The layout hides its sub-sidebar on a phone, so the page shows the Task list itself there. */
  readonly wideScreen = signal(typeof window !== 'undefined' && !!window.matchMedia?.(WIDE_SCREEN).matches);
  private readonly navState = inject(NavigationStateService);
  private readonly taskListTemplate = viewChild.required<TemplateRef<unknown>>('taskList');
  private readonly taskListActionsTemplate = viewChild.required<TemplateRef<unknown>>('taskListActions');
  /** Opened from the sub-sidebar header; the Task list shows the field. */
  readonly taskSearchOpen = signal(false);
  private readonly viewContainer = inject(ViewContainerRef);
  /** Rendered by the layout's sub-sidebar but declared here, so the Task list keeps this page's stores and handlers. */
  private readonly taskListEffect = effect(() => {
    const shown = this.taskListOn() && this.wideScreen();
    this.navState.pageSubSidebar.set(shown ? new TemplatePortal(this.taskListTemplate(), this.viewContainer) : null);
    this.navState.pageSubSidebarActions.set(shown ? new TemplatePortal(this.taskListActionsTemplate(), this.viewContainer) : null);
  });

  /** The view list; the planner's Week is the working days until Show weekend is on. */
  readonly viewOptions = computed<readonly SelectOption[]>(() => [
    { value: 'month', label: 'Month' },
    { value: 'week', label: this.planner.active() && !this.showWeekend() ? 'Work week' : 'Week' },
    { value: 'day', label: 'Day' }
  ]);

  readonly plannerBlocks = computed(() => new Map([...this.planner.dayByDate()].map(([date, day]) => [date, day.blocks])));
  readonly plannerWindows = computed(() => new Map([...this.planner.dayByDate()].map(([date, day]) => [date, day.workWindow])));
  readonly plannerEditable = computed(() => this.viewingFor()
    ? new Set<string>()
    : new Set([...this.planner.dayByDate().values()].filter((d) => d.editable).map((d) => d.date)));
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
    }
  });

  private readonly rangeEffect = effect(() => {
    const { from, to } = this.currentRange();
    this.store.loadEvents(from, to, this.viewingFor());
  });

  /** Separate from createTabs: that also depends on the planner's editable days, so reading it here would make every
   * planner response reload the planner. */
  private readonly canRequestTimeOff = computed(() =>
    this.permissions.hasModule('leave') && this.permissions.hasPermission('leave:read-own'));

  private readonly plannerRangeEffect = effect(() => {
    const { from, to } = this.plannerRange();
    const forEmployeeId = this.viewingFor();
    void this.planner.load(from, to, forEmployeeId);
    // Your own leave on the Planner (2026-11-03): only while the Planner is on, and where you can ask for it - not on a
    // principal's calendar.
    if (this.planner.active() && this.canRequestTimeOff() && !forEmployeeId) {
      void untracked(() => this.leaveLayer.load(from, to));
      untracked(() => this.leaveLayer.startAutoRefresh());
    } else {
      untracked(() => this.leaveLayer.stopAutoRefresh());
    }
  });

  /** Day view's actual minutes and attendance come from the day read. */
  private readonly plannerDayEffect = effect(() => {
    const date = this.dayDate();
    // The day read is the caller's own day: a principal's Day view has no totals.
    if (this.view() !== 'day' || !this.planner.active() || this.viewingFor()) {
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
    const media = typeof window !== 'undefined' ? window.matchMedia?.(WIDE_SCREEN) : undefined;
    const onScreenChange = (event: MediaQueryListEvent) => this.wideScreen.set(event.matches);
    media?.addEventListener?.('change', onScreenChange);
    inject(DestroyRef).onDestroy(() => {
      media?.removeEventListener?.('change', onScreenChange);
      this.navState.pageSubSidebar.set(null);
      this.navState.pageSubSidebarActions.set(null);
    });
    this.store.loadMyTimezone();
    this.store.loadMeetingConnectionStatus();
    // Read again on each visit: a principal may have added or removed the caller since.
    void this.principals.load(true);
    this.handleCalendarConnectionRedirect();
    this.applyTeamParams();
  }

  // --- Me / My team (team planner, Phase A, 2026-11-03) ---

  readonly teamPlanner = inject(TeamPlannerStore);
  private readonly myTeam = inject(MyTeamCapabilitiesStore);
  readonly scope = signal<'me' | 'team'>('me');
  /** My team is offered while the planner is on to someone with a direct report. */
  readonly canViewTeam = computed(() =>
    this.planner.active() && !this.viewingFor() && this.myTeam.capabilities()?.canViewTeamPlan === true);
  /** The team view shows only while it is offered; a deep link waits for the capability check. */
  readonly teamMode = computed(() => this.scope() === 'team' && this.canViewTeam());

  /** Shows a principal's calendar (their meeting delegate only), or the caller's own with null. */
  viewFor(employeeId: string | null): void {
    this.closeCreate();
    this.scope.set('me');
    this.viewingFor.set(employeeId || null);
  }

  setScope(scope: 'me' | 'team'): void {
    this.closeCreate();
    this.scope.set(scope);
  }

  /** ?scope=team&teamView=day|week&date=YYYY-MM-DD&person=<id>, as the My Team widget links. */
  private applyTeamParams(): void {
    if (!this.myTeam.loaded() && !this.myTeam.loading()) void this.myTeam.loadCapabilities();
    const params = this.route.snapshot.queryParamMap;
    if (params.get('scope') !== 'team') return;
    this.scope.set('team');
    const view = params.get('teamView');
    if (view === 'day' || view === 'week') this.teamPlanner.mode.set(view);
    const date = params.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.teamPlanner.setDate(date);
    const person = params.get('person');
    if (person) void this.teamPlanner.openPerson(person);
  }

  /** Keeps the URL on the team view's state while it shows, so a refresh or a shared link reopens it. */
  private readonly teamUrlEffect = effect(() => {
    const team = this.teamMode();
    const mode = this.teamPlanner.mode();
    const date = this.teamPlanner.date();
    const person = this.teamPlanner.person()?.employeeId ?? null;
    untracked(() => {
      const current = this.route.snapshot.queryParamMap;
      if (!team && current.get('scope') !== 'team') return;
      void this.router.navigate([], {
        relativeTo: this.route, replaceUrl: true, queryParamsHandling: 'merge',
        queryParams: team ? { scope: 'team', teamView: mode, date, person } : { scope: null, teamView: null, date: null, person: null },
      });
    });
  });

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
    }
  }

  setView(view: CalendarView): void {
    this.closeCreate();
    this.view.set(view);
  }

  openDay(date: string): void {
    this.closeCreate();
    const [y, m, d] = date.split('-').map(Number);
    this.cursor.set(new Date(y, m - 1, d));
    this.view.set('day');
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
    void this.planner.load(from, to, this.viewingFor());
    const range = this.currentRange();
    this.store.loadEvents(range.from, range.to, this.viewingFor());
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
    this.closeCreate();
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
    }
  }

  goToToday(): void {
    this.closeCreate();
    this.cursor.set(new Date());
  }

  /** The period label's date picker: the view moves to the period that holds the picked date ('YYYY-MM-DD', local). */
  readonly periodPickerOpen = signal(false);

  jumpTo(date: string): void {
    const [y, m, d] = date.split('-').map(Number);
    this.closeCreate();
    if (y && m && d) this.cursor.set(new Date(y, m - 1, d));
    this.periodPickerOpen.set(false);
  }

  /** A meeting may have been edited, moved or cancelled in its drawer: refresh the calendar. */
  async onMeetingDrawerClosed(): Promise<void> {
    this.openMeeting.set(null);
    await this.reloadEvents();
  }

  /** A meeting work item was created (or sent for approval): close the form and show it on the calendar. */
  async onMeetingSaved(event?: MeetingCreatedEvent): Promise<void> {
    await this.reloadEvents();
    // A new meeting opens in its drawer; a request sent for approval has nothing to open yet.
    const key = event ? drawerKeyForCreated(event) : null;
    if (key) this.openMeeting.set(key);
  }

  onSlotClick(slot: { date: string; hour: number }): void {
    this.openCreatePopover(slot.date, slot.hour * 60, Math.min(slot.hour * 60 + 60, 24 * 60));
  }

  onSlotRange(range: { date: string; startMinutes: number; endMinutes: number }): void {
    this.openCreatePopover(range.date, range.startMinutes, range.endMinutes);
  }

  // --- Planner create popover (2026-11-03 design) ---

  /** The picked time while the create popover is open; null when closed. */
  readonly createSlot = signal<CreateSlot | null>(null);
  readonly createTabs = computed<readonly CreateTab[]>(() => CREATE_TAB_ORDER.filter((tab) => {
    // On a principal's calendar a delegate schedules meetings for them, and nothing else.
    if (this.viewingFor()) return tab === 'meeting' && this.meetingsAvailability.canCreate();
    // A work item is planned on the spot: it needs the planner, and a picked slot must be on a day that can be planned.
    if (tab === 'workItem') {
      const slot = this.createSlot();
      return this.planner.active() && (!slot || !!slot.isDefault || this.canPlan(slot.date));
    }
    if (tab === 'meeting') return this.meetingsAvailability.canCreate();
    if (tab === 'timeOff') return this.canRequestTimeOff();
    return true;
  }));

  /** Past days, days beyond the planning horizon and a switched-off planner can't take a planned block. */
  private canPlan(date: string): boolean {
    return this.planner.active() && this.plannerEditable().has(date);
  }

  private openCreatePopover(date: string, startMinutes: number, endMinutes: number, isDefault = false): void {
    // A new popover is a new work item: the last one's state (created, refused, pending) stays with it.
    this.planFlow.reset();
    this.createSlot.set({ date, startMinutes, endMinutes, startIso: this.toIso(date, startMinutes), endIso: this.toIso(date, endMinutes), isDefault });
  }

  /** New event: the popover at the next half hour today (planner zone), for an hour; late at night, the day's last hour. */
  onNewEvent(): void {
    const zone = this.plannerZone();
    const now = utcIsoToLocalParts(new Date().toISOString(), zone);
    const [h, m] = now.time.split(':').map(Number);
    const start = Math.min(Math.ceil((h * 60 + m + 1) / 30) * 30, 23 * 60);
    this.openCreatePopover(now.date, start, start + 60, true);
  }

  closeCreate(): void {
    this.createSlot.set(null);
  }

  /** The planner's zone: the grid's wall-clock times and every tab's slot are in it. */
  readonly plannerZone = computed(() => this.planner.range()?.timezone ?? this.store.myTimezone());

  /** A tab created its item: close the popover and show it. */
  onCreateDone(): void {
    this.closeCreate();
    void this.reloadEvents();
    const { from, to } = this.plannerRange();
    void this.planner.load(from, to, this.viewingFor());
  }

  readonly clockOf = clock;

  // --- Time off tab ---
  readonly leaveLayer = inject(PlannerLeaveLayerStore);
  /** My leave on the grid: a Planner layer, so nothing while the Planner is off. */
  readonly plannerLeaves = computed(() => (this.planner.active() ? this.leaveLayer.leaves() : []));
  readonly leaveTypes = inject(LeaveTypeStore);
  readonly leaveBalances = inject(LeaveBalanceStore);
  readonly leaveRequests = inject(LeaveRequestStore);
  /** "More options" on the Time off tab: the full leave request form, filled with what the tab held. */
  readonly leaveWizard = signal<{ leaveTypeId: string; startDate: string; startTime: string; endDate: string; endTime: string;
    reason: string | null } | null>(null);
  readonly leaveDocuments = signal<LeaveUploadedDocument[]>([]);

  onTimeOffSubmitted(): void {
    this.closeCreate();
    this.notificationService.success('Leave request sent for approval.');
    const { from, to } = this.plannerRange();
    void this.leaveLayer.load(from, to);
  }

  async onTimeOffMoreOptions(draft: TimeOffDraft): Promise<void> {
    this.closeCreate();
    if (this.leaveTypes.items().length === 0) void this.leaveTypes.load();
    // Wait for the work window: converting with the planner's zone first would show other clock times.
    await this.leaveBalances.loadWorkWindow();
    // The leave form works in the work-window zone; the slot's instants are shown there.
    const zone = this.leaveBalances.workWindow()?.timezone ?? this.plannerZone();
    const start = utcIsoToLocalParts(draft.startIso, zone);
    const end = utcIsoToLocalParts(draft.endIso, zone);
    this.leaveWizard.set({ leaveTypeId: draft.leaveTypeId, startDate: start.date, startTime: start.time, endDate: end.date,
      endTime: end.time, reason: draft.reason });
  }

  async onLeaveWizardSubmit(payload: SubmitLeaveRequestRequest): Promise<void> {
    if (await this.leaveRequests.submit(payload)) {
      this.closeLeaveWizard();
      this.onTimeOffSubmitted();
    }
  }

  async onLeaveDocumentSelected(file: File): Promise<void> {
    const uploaded = await this.leaveRequests.uploadDocument(file);
    if (uploaded) this.leaveDocuments.update((docs) => [...docs, uploaded]);
  }

  closeLeaveWizard(): void {
    this.leaveWizard.set(null);
    this.leaveDocuments.set([]);
    this.leaveRequests.clearPreview();
  }

  /** "More options" on the Work item tab: the full Create work item form, filled, then the created item is planned. */
  readonly workItemForm = signal<{ projectId: string; objectiveId: string; prefill: TaskFormPrefill; slot: CreateSlot | null; continuation: readonly CreateSlot[]; planned: boolean } | null>(null);
  private readonly planFlow = inject(WorkItemPlanFlow);

  async onWorkItemMoreOptions(draft: WorkItemDraft): Promise<void> {
    if (!draft.projectId) {
      this.notificationService.warning('Choose a project first.');
      return;
    }
    // The task form reads its project from ProjectDetailStore (as openTask does).
    await this.projects.loadProject(draft.projectId);
    await this.projects.loadMyMilestones(draft.projectId);
    this.closeCreate();
    this.workItemForm.set({
      projectId: draft.projectId, objectiveId: draft.objectiveId ?? '', slot: draft.slot, continuation: draft.continuation, planned: false,
      prefill: { title: draft.title, description: draft.description, categoryId: draft.categoryId, priority: draft.priority, estimatedHours: draft.estimatedHours,
        dueDate: draft.dueDate, assigneeEmployeeId: this.employeeId() },
    });
  }

  /** The full form created an item: plan the first one it created directly ('' = sent for approval: nothing to plan). */
  async onWorkItemFormCreated(taskId: string): Promise<void> {
    const form = this.workItemForm();
    if (!taskId || !form?.slot || form.planned) return;
    this.workItemForm.set({ ...form, planned: true });
    await this.planFlow.planExisting(taskId, '', form.slot, form.continuation);
    const state = this.planFlow.state();
    if (state.kind === 'notPlanned') {
      const reason = state.reason === plannerErrorMessage('planner_task_not_plannable') ? 'assigned to someone else' : state.reason;
      this.notificationService.warning(`Created, not planned: ${reason}`);
      // The popover's Retry/Pick another time is gone here: open the block picker for the created item.
      this.onPickAnotherTime({ taskId, shortId: '', projectId: form.projectId, title: form.prefill.title ?? '',
        estimatedMinutes: Math.round((form.prefill.estimatedHours ?? 0) * 60) });
    }
  }

  /** A work item was created but its block was refused: place it with the block picker instead. */
  onPickAnotherTime(item: WorkItemToPlace): void {
    this.closeCreate();
    void this.planner.load(this.plannerRange().from, this.plannerRange().to, this.viewingFor());
    this.pickerItem.set({
      taskId: item.taskId, projectId: item.projectId, projectName: '', title: item.title, priority: 'medium', dueDate: null,
      estimatedMinutes: item.estimatedMinutes, loggedMinutes: 0, remainingMinutes: item.estimatedMinutes, plannedAheadMinutes: 0,
      firstPlannedDate: null, plannedDayCount: 0, fullyPlanned: false, reason: 'backlog',
    });
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    // A task meeting opens its own drawer by series + original start (it may not be materialized yet, so it has no
    // task id); it never goes through the legacy /calendar/{id} event actions.
    if (found?.itemKind === 'meeting' && found.meetingSeriesId) {
      this.openMeeting.set({ seriesId: found.meetingSeriesId, originalStart: found.originalStart ?? found.startDate });
      return;
    }
    // A delegate runs a principal's meetings only: the principal's own events stay theirs to change.
    if (this.viewingFor()) return;
    this.editingEvent.set(found);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
    this.store.clearEligibleNominees();
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    // One save at a time: a second click must not send the update twice.
    if (this.submitting()) return;
    this.submitting.set(true);
    try {
      const editing = this.editingEvent();
      if (!editing) return;
      let ok: boolean;

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
    return this.store.loadEvents(from, to, this.viewingFor());
  }

  async onDelete(scope: RecurrenceEditScope | null): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const { from, to } = this.currentRange();

    if (scope === 'ThisEventOnly' && editing.recurrenceMasterId) {
      await this.store.cancelOccurrence(editing.recurrenceMasterId, editing.originalStart!, from, to);
    } else if (scope === 'AllEvents' && editing.recurrenceMasterId) {
      await this.store.deleteEvent(editing.recurrenceMasterId);
      await this.store.loadEvents(from, to, this.viewingFor());
    } else {
      await this.store.deleteEvent(editing.id);
    }
    this.closeForm();
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
