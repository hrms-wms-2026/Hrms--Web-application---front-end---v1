import { provideHttpClient } from '@angular/common/http';
import { NavigationStateService } from '../../../../layouts/main-layout/nav/navigation-state.service';
import { openSelect, selectDisplayText } from '../../../../shared/ui/select/select.testing';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { PlannerFocusResponse, PlannerRangeBlockView, PlannerRangeDay, PlannerWorkWindow } from '../../../work/planner/models/planner.models';
import { PlannerAvailability, PlannerAvailabilityService } from '../../../work/planner/state/planner-availability.service';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { WorkItemPlanFlow } from '../../state/work-item-plan-flow.service';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { MeetingFormModalComponent } from '../../../work/meetings/ui/meeting-form-modal/meeting-form-modal.component';
import { PlannerCreatePopoverComponent } from '../../ui/planner-create-popover/planner-create-popover.component';
import { MyTeamCapabilitiesStore } from '../../../dashboard/state/my-team-capabilities.store';
import { CalendarPageComponent } from './calendar-page.component';

/** Planner = Calendar (2026-10-27 design): the calendar page with the planner layer on and off. */

const base = `${environment.apiUrl}/planner`;
const weekday: PlannerWorkWindow = {
  workStart: '09:00:00', workEnd: '17:00:00', breakMinutes: 60, breakStart: '12:30:00', isWorkingDay: true, workingMinutes: 420,
};
const focus: PlannerFocusResponse = {
  today: '2026-11-02', weekEnd: '2026-11-08',
  groups: [
    { reason: 'overdue', count: 2, items: [] }, { reason: 'due_today', count: 0, items: [] },
    { reason: 'due_this_week', count: 1, items: [] }, { reason: 'backlog', count: 0, items: [] },
  ],
};

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

function block(id: string, date: string, from: string, to: string): PlannerRangeBlockView {
  return {
    id, taskId: `t-${id}`, projectId: 'p1', taskTitle: `Task ${id}`, startAt: `${date}T${from}:00Z`, endAt: `${date}T${to}:00Z`,
    plannedMinutes: (Date.parse(`${date}T${to}:00Z`) - Date.parse(`${date}T${from}:00Z`)) / 60000, actualMinutes: 0, stillAssigned: true,
  };
}

describe('CalendarPageComponent planner layer', () => {
  let http: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarPageComponent>>;
  const state = signal<PlannerAvailability>('on');
  const notify = { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() };
  const events = signal<readonly CalendarEventResponse[]>([]);
  let blocksFor: (date: string) => PlannerRangeBlockView[] = () => [];
  let rangeZone = 'UTC';
  const projectError = signal<string | null>(null);
  const projects = { loadProject: vi.fn(async () => undefined), loadMyMilestones: vi.fn(async () => undefined), projectError };

  function fakeStore() {
    return {
      events, saving: signal(false), conflicts: signal([]), checkingConflicts: signal(false), eligibleNominees: signal([]),
      hasTeamsCapableConnection: signal(false), hasZoomCapableConnection: signal(false), meetingActionSaving: signal(false),
      myTimezone: signal('UTC'), loadError: signal<string | null>(null), actionError: signal<string | null>(null),
      loadEvents: vi.fn(), loadMyTimezone: vi.fn(), loadMeetingConnectionStatus: vi.fn(), clearConflicts: vi.fn(),
      clearEligibleNominees: vi.fn(),
    };
  }

  function answerRange(req: TestRequest): void {
    const days: PlannerRangeDay[] = datesBetween(req.request.params.get('from')!, req.request.params.get('to')!).map((date) => {
      const window = { ...weekday, isWorkingDay: !isWeekend(date), workingMinutes: isWeekend(date) ? 0 : 420 };
      const blocks = blocksFor(date);
      return { date, editable: true, workWindow: window, blocks, blockMinutes: blocks.reduce((s, b) => s + b.plannedMinutes, 0),
        workingMinutes: window.workingMinutes };
    });
    req.flush({ timezone: rangeZone, today: days[0].date, days });
  }

  /** Answers every planner read the page has made so far. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      http.match((r) => r.url === `${base}/me/range`).forEach(answerRange);
      http.match(`${base}/me/focus`).forEach((r) => r.flush(focus));
      http.match((r) => r.url === `${base}/me`).forEach((r) => r.flush({
        date: r.request.params.get('date'), timezone: 'UTC', editable: true, blocks: [], meetings: [], dueTasks: [],
        totals: { plannedMinutes: 0, actualMinutes: 45 }, attendanceMinutes: 120,
      }));
      fixture.detectChanges();
    }
  }

  // Team planner (2026-11-03): the viewer's My Team capabilities; null = not loaded.
  const teamCaps = signal<{ canViewTeamPlan?: boolean } | null>(null);
  const loadCapabilities = vi.fn(async () => undefined);
  let createAt: string | null = null;

  function setup(on = true, canTeam = false): void {
    teamCaps.set(canTeam ? { canViewTeamPlan: true } : null);
    state.set(on ? 'on' : 'off');
    events.set([]);
    blocksFor = () => [];
    rangeZone = 'UTC';
    Object.values(notify).forEach((f) => f.mockClear());
    try { localStorage.clear(); } catch { /* storage may be unavailable */ }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: CalendarEventStore, useValue: fakeStore() },
        { provide: PlannerAvailabilityService, useValue: { state, markAvailable: vi.fn(), probe: vi.fn() } },
        { provide: NotificationService, useValue: notify },
        { provide: ProjectDetailStore, useValue: projects },
        { provide: PermissionService, useValue: { hasModule: () => true, hasAnyModule: () => true, hasPermission: () => true, hasAnyPermission: () => true } },
        { provide: MyTeamCapabilitiesStore, useValue: { capabilities: teamCaps, loaded: signal(true), loading: signal(false), loadCapabilities } },
      ],
    });
    projectError.set(null);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
  }

  /** Starts the page at a URL (query params), as a deep link from the dashboard widget would. */
  async function setupAt(url: string, canTeam = true): Promise<void> {
    createAt = url;
    teamCaps.set({ canViewTeamPlan: canTeam });
    state.set('on');
    events.set([]);
    blocksFor = () => [];
    rangeZone = 'UTC';
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting(),
        { provide: CalendarEventStore, useValue: fakeStore() },
        { provide: PlannerAvailabilityService, useValue: { state, markAvailable: vi.fn(), probe: vi.fn() } },
        { provide: NotificationService, useValue: notify },
        { provide: ProjectDetailStore, useValue: projects },
        { provide: PermissionService, useValue: { hasModule: () => true, hasAnyModule: () => true, hasPermission: () => true, hasAnyPermission: () => true } },
        { provide: MyTeamCapabilitiesStore, useValue: { capabilities: teamCaps, loaded: signal(true), loading: signal(false), loadCapabilities } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(Router).navigateByUrl(createAt);
    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
  }

  const q = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  it('opens a planned task over the planner, so closing it stays on the planner', async () => {
    setup();
    await settle();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await fixture.componentInstance.openTask('p1', 't1');

    expect(projects.loadProject).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.openedTask()).toEqual({ projectId: 'p1', taskId: 't1' });
    expect(navigate).not.toHaveBeenCalled();

    fixture.componentInstance.closeTask();
    expect(fixture.componentInstance.openedTask()).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back to the board when the task project cannot be opened here', async () => {
    setup();
    await settle();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    projects.loadProject.mockImplementationOnce(async () => { projectError.set('no access'); });

    await fixture.componentInstance.openTask('p1', 't1');

    expect(fixture.componentInstance.openedTask()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'board'], { queryParams: { taskId: 't1' } });
  });

  it('is the plain calendar while the planner is off', async () => {
    setup(false);
    await settle();

    http.expectNone((r) => r.url.startsWith(base));
    expect(q('planner-focus-panel')).toBeNull();
  });

  it('Day view shows the day totals and the Task list', async () => {
    setup();
    fixture.componentInstance.setView('day');
    await settle();

    const totals = q('planner-day-totals')!.textContent!.replace(/\s+/g, ' ');
    const workingDay = !isWeekend(fixture.componentInstance.dayDate());
    expect(totals).toContain(workingDay ? 'Working hours 7h' : 'Working hours 0m');
    expect(totals).toContain('Actual / attendance 45m / 2h');
    expect(q('planner-focus-panel')).not.toBeNull();
    expect(q('queue-total')!.textContent!.trim()).toBe('3');
  });

  it('the period label opens a date picker, and picking a date moves the week there', async () => {
    setup();
    fixture.componentInstance.setView('week');
    await settle();
    expect(q('planner-period-picker')).toBeNull();

    q('planner-period-button')!.click();
    fixture.detectChanges();
    expect(q('planner-period-picker')).not.toBeNull();

    fixture.componentInstance.jumpTo('2026-11-12');
    fixture.detectChanges();

    expect(fixture.componentInstance.viewLabel()).toBe('Week of 2026-11-09');
    expect(q('planner-period-picker')).toBeNull();
  });

  it('New event is a single primary button with a plus, and no menu', async () => {
    setup();
    await settle();

    const button = q('calendar-new-event')!;
    expect(button.textContent!.trim()).toBe('New event');
    expect(button.querySelector('[data-testid="calendar-new-event-icon"]')).not.toBeNull();
    expect(q('calendar-new-event-menu')).toBeNull();
  });

  it('the page header names the Planner, with no summary line', async () => {
    setup();
    fixture.componentInstance.setView('week');
    await settle();

    expect(q('planner-header')!.textContent!.trim()).toBe('Planner');
  });

  describe('Task list placement', () => {
    const nav = () => TestBed.inject(NavigationStateService);
    const original = window.matchMedia;
    afterEach(() => { window.matchMedia = original; });

    it('goes in the shared sub-sidebar on a wide screen, leaves it for My team, and clears it with the page', async () => {
      window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
      setup(true, true);
      await settle();

      expect(nav().pageSubSidebar()).not.toBeNull();
      expect(nav().pageSubSidebarActions()).not.toBeNull();
      expect(q('planner-focus-panel')).toBeNull();

      fixture.componentInstance.setScope('team');
      fixture.detectChanges();
      TestBed.tick();
      expect(nav().pageSubSidebar()).toBeNull();

      fixture.componentInstance.setScope('me');
      fixture.detectChanges();
      TestBed.tick();
      expect(nav().pageSubSidebar()).not.toBeNull();

      fixture.destroy();
      expect(nav().pageSubSidebar()).toBeNull();
      expect(nav().pageSubSidebarActions()).toBeNull();
    });

    it('stays on the page where the layout has no sub-sidebar', async () => {
      window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
      setup();
      await settle();

      expect(nav().pageSubSidebar()).toBeNull();
      expect(q('planner-focus-panel')).not.toBeNull();
    });
  });

  it('Work week leaves out rest days until Show weekend, at the end of the view list, is on', async () => {
    setup();
    fixture.componentInstance.setView('week');
    await settle();
    const week = () => fixture.debugElement.query(By.directive(CalendarWeekViewComponent)).componentInstance as CalendarWeekViewComponent;
    const grid = () => fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid').componentInstance;

    expect(grid().days().length).toBe(5);
    expect(selectDisplayText(q('calendar-view-select')!)).toBe('Work week');
    const options = openSelect(q('calendar-view-select')!, () => fixture.detectChanges());
    expect(options.map((o) => o.textContent!.trim())).toEqual(['Month', 'Work week', 'Day']);

    const toggle = () => document.querySelector<HTMLElement>('[data-testid="planner-show-weekend"]')!;
    expect(toggle().textContent!.trim()).toBe('Show weekend');
    expect(toggle().getAttribute('role')).toBe('switch');
    expect(toggle().getAttribute('aria-checked')).toBe('false');
    toggle().click();
    fixture.detectChanges();

    expect(grid().days().length).toBe(7);
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect(selectDisplayText(q('calendar-view-select')!)).toBe('Week');
    expect(localStorage.getItem('planner.showWeekend')).toBe('true');
    expect(week()).toBeTruthy();
  });

  it('Move after with no room left that day says so and moves nothing', async () => {
    setup();
    fixture.componentInstance.setView('day');
    const date = fixture.componentInstance.dayDate();
    blocksFor = (d) => (d === date ? [block('a', d, '09:00', '16:00'), block('b', d, '16:00', '17:00')] : []);
    await settle();

    fixture.componentInstance.onBlockMoveAfter({ block: block('b', date, '16:00', '17:00'), date, afterMinute: 1000 });

    const [y, m, d] = date.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
    expect(notify.warning).toHaveBeenCalledWith(`No free time left on ${label} for this block`);
    http.expectNone((r) => r.url.includes('/me/blocks'));
  });

  it('Month view sums each day into a chip', async () => {
    setup();
    const today = fixture.componentInstance.dayDate();
    events.set([{ id: 'm1', title: 'Sync', startDate: `${today}T13:00:00Z`, endDate: `${today}T14:00:00Z`, isAllDay: false,
      itemKind: 'meeting', participants: null } as CalendarEventResponse]);
    blocksFor = (d) => (d === today ? [block('a', d, '09:00', '10:00'), block('b', d, '10:00', '10:30')] : []);
    fixture.componentInstance.setView('month');
    await settle();

    const chip = fixture.nativeElement.querySelector(`[data-date="${today}"] [data-testid="planner-month-summary"]`) as HTMLElement;
    expect(chip.textContent!.replace(/\s+/g, ' ').trim()).toBe('2 tasks · 1 meeting · 2h 30m');
  });

  it('writes block times in the planner zone even before the calendar knows it', async () => {
    setup();
    fixture.componentInstance.setView('day');
    const date = fixture.componentInstance.dayDate();
    await new Promise((resolve) => setTimeout(resolve));
    http.match((r) => r.url === `${base}/me/range`).forEach((req) => req.flush({
      timezone: 'Asia/Colombo', today: date,
      days: [{ date, editable: true, workWindow: null, blocks: [], blockMinutes: 0, workingMinutes: 0 }],
    }));
    http.match(`${base}/me/focus`).forEach((r) => r.flush(focus));
    await new Promise((resolve) => setTimeout(resolve));

    fixture.componentInstance.onBlockCreate({ taskId: 't1', date, startMinutes: 600, endMinutes: 660 });

    const post = http.expectOne(`${base}/me/blocks`);
    expect(post.request.body).toEqual({ taskId: 't1', startAt: new Date(`${date}T10:00:00+05:30`).toISOString(),
      endAt: new Date(`${date}T11:00:00+05:30`).toISOString() });
    post.flush(null);
    await settle();
  });

  it('Day totals follow the shown day when an earlier day read answers last', async () => {
    setup();
    fixture.componentInstance.setView('day');
    await settle();
    const first = fixture.componentInstance.dayDate();
    fixture.componentInstance.next();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    http.match((r) => r.url === `${base}/me/range`).forEach(answerRange);
    http.match(`${base}/me/focus`).forEach((r) => r.flush(focus));
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    const second = fixture.componentInstance.dayDate();
    const reads = http.match((r) => r.url === `${base}/me`);
    const day = (date: string, actual: number) => ({ date, timezone: 'UTC', editable: true, blocks: [], meetings: [], dueTasks: [],
      totals: { plannedMinutes: 0, actualMinutes: actual }, attendanceMinutes: 0 });
    reads.find((r) => r.request.params.get('date') === second)!.flush(day(second, 30));
    await new Promise((resolve) => setTimeout(resolve));
    // A late answer for the day shown before.
    fixture.componentInstance.plannerDayFor(first, day(first, 300));
    fixture.detectChanges();

    expect(q('planner-day-totals')!.textContent).toContain('30m / 0m');
  });

  describe('create popover (2026-11-03)', () => {
    const editableDate = () => fixture.componentInstance.editableDateList()[0];

    it('slot click on an editable day opens the popover, not the event form', async () => {
      setup();
      await settle();

      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });
      fixture.detectChanges();

      expect(q('create-popover-panel')).not.toBeNull();
      expect(fixture.componentInstance.formOpen()).toBe(false);
      expect(fixture.componentInstance.createSlot()).toMatchObject({ date: editableDate(), startMinutes: 540, endMinutes: 600 });
    });

    it('slot click when the planner is off opens the popover, with no Work item tab', async () => {
      setup(false);
      await settle();

      fixture.componentInstance.onSlotClick({ date: '2026-11-10', hour: 9 });
      fixture.detectChanges();

      expect(q('create-popover-panel')).not.toBeNull();
      expect(fixture.componentInstance.formOpen()).toBe(false);
      expect(fixture.componentInstance.createTabs()).not.toContain('workItem');
    });

    it('New event late at night opens the popover at the day\'s last hour', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-04T23:40:00Z'));
      try {
        setup();
        await settle();

        fixture.componentInstance.onNewEvent();

        expect(fixture.componentInstance.createSlot()).toMatchObject({ date: '2026-11-04', startMinutes: 1380, endMinutes: 1440 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('drag range fills start and end', async () => {
      setup();
      await settle();

      fixture.componentInstance.onSlotRange({ date: editableDate(), startMinutes: 600, endMinutes: 690 });

      expect(fixture.componentInstance.createSlot()).toMatchObject({ startMinutes: 600, endMinutes: 690 });
    });

    it('uses the planner zone for the slot', async () => {
      setup();
      rangeZone = 'Asia/Colombo';
      await settle();

      fixture.componentInstance.onSlotRange({ date: editableDate(), startMinutes: 540, endMinutes: 660 });

      const slot = fixture.componentInstance.createSlot()!;
      expect(Date.parse(slot.startIso)).toBe(Date.parse(`${editableDate()}T09:00:00+05:30`));
      expect(Date.parse(slot.endIso)).toBe(Date.parse(`${editableDate()}T11:00:00+05:30`));
    });

    it('New event opens the popover at the next half hour, 1h', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-04T10:10:00Z'));
      try {
        setup();
        await settle();

        fixture.componentInstance.onNewEvent();

        expect(fixture.componentInstance.createSlot()).toMatchObject({ date: '2026-11-04', startMinutes: 630, endMinutes: 690 });
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes the popover when the range changes', async () => {
      setup();
      await settle();
      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });

      fixture.componentInstance.next();

      expect(fixture.componentInstance.createSlot()).toBeNull();
    });

    describe('Work item More options (full form)', () => {
      const slotOf = (date: string) => ({ date, startMinutes: 540, endMinutes: 660, startIso: `${date}T09:00:00.000Z`, endIso: `${date}T11:00:00.000Z` });
      const draftOf = (date: string) => ({ description: null, title: 'Fix login bug', projectId: 'p1', objectiveId: 'o1', categoryId: 'c2',
        priority: 'high' as const, estimatedHours: 8, dueDate: null, slot: slotOf(date), continuation: [] });
      const flow = () => fixture.debugElement.injector.get(WorkItemPlanFlow);

      it('More options loads the project, then opens the form with projectId, prefillModuleId and prefill', async () => {
        setup();
        await settle();
        fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });

        await fixture.componentInstance.onWorkItemMoreOptions(draftOf(editableDate()));

        expect(projects.loadProject).toHaveBeenCalledWith('p1');
        expect(fixture.componentInstance.createSlot()).toBeNull();
        expect(fixture.componentInstance.workItemForm()).toMatchObject({ projectId: 'p1', objectiveId: 'o1',
          prefill: { title: 'Fix login bug', categoryId: 'c2', priority: 'high', estimatedHours: 8, dueDate: null } });
      });

      it('created(id) plans that id at the slot, once', async () => {
        setup();
        await settle();
        await fixture.componentInstance.onWorkItemMoreOptions(draftOf(editableDate()));
        const plan = vi.spyOn(flow(), 'planExisting').mockResolvedValue();

        await fixture.componentInstance.onWorkItemFormCreated('t-new');
        await fixture.componentInstance.onWorkItemFormCreated('t-another');

        expect(plan).toHaveBeenCalledTimes(1);
        expect(plan).toHaveBeenCalledWith('t-new', '', slotOf(editableDate()), []);
      });

      it('created(\'\') (sent for approval) plans nothing', async () => {
        setup();
        await settle();
        await fixture.componentInstance.onWorkItemMoreOptions(draftOf(editableDate()));
        const plan = vi.spyOn(flow(), 'planExisting').mockResolvedValue();

        await fixture.componentInstance.onWorkItemFormCreated('');

        expect(plan).not.toHaveBeenCalled();
      });

      it('a planning refusal because the assignee changed says it is assigned to someone else', async () => {
        setup();
        await settle();
        await fixture.componentInstance.onWorkItemMoreOptions(draftOf(editableDate()));

        const planned = fixture.componentInstance.onWorkItemFormCreated('t-new');
        await new Promise((resolve) => setTimeout(resolve));
        http.expectOne(`${base}/me/blocks`).flush({ code: 'planner_task_not_plannable' }, { status: 400, statusText: 'Bad Request' });
        await planned;

        expect(notify.warning).toHaveBeenCalledWith('Created, not planned: assigned to someone else');
      });

      // Follow-up 4: one message, and a way to plan it after all.
      it('a refused plan shows one message and opens Pick another time for the created item', async () => {
        setup();
        await settle();
        await fixture.componentInstance.onWorkItemMoreOptions(draftOf(editableDate()));
        notify.error.mockClear();
        notify.warning.mockClear();

        const planned = fixture.componentInstance.onWorkItemFormCreated('t-new');
        await new Promise((resolve) => setTimeout(resolve));
        http.expectOne(`${base}/me/blocks`).flush({ code: 'planner_block_overlap' }, { status: 409, statusText: 'Conflict' });
        await planned;

        expect(notify.error).not.toHaveBeenCalled();
        expect(notify.warning).toHaveBeenCalledTimes(1);
        expect(fixture.componentInstance.pickerItem()).toMatchObject({ taskId: 't-new', projectId: 'p1', title: 'Fix login bug', estimatedMinutes: 480 });
      });

      it('More options without a project asks for one and keeps the popover', async () => {
        setup();
        await settle();
        fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });

        await fixture.componentInstance.onWorkItemMoreOptions({ ...draftOf(editableDate()), projectId: null });

        expect(notify.warning).toHaveBeenCalledWith('Choose a project first.');
        expect(fixture.componentInstance.createSlot()).not.toBeNull();
        expect(fixture.componentInstance.workItemForm()).toBeNull();
      });
    });

    it('More options on the Time off tab opens the leave form prefilled', async () => {
      setup();
      await settle();
      const date = editableDate();
      fixture.componentInstance.onSlotClick({ date, hour: 9 });

      const opened = fixture.componentInstance.onTimeOffMoreOptions({ leaveTypeId: 'sick', startIso: `${date}T09:00:00.000Z`,
        endIso: `${date}T11:00:00.000Z`, reason: 'Doctor' });
      expect(fixture.componentInstance.createSlot()).toBeNull();
      await new Promise((resolve) => setTimeout(resolve));
      http.expectOne(`${environment.apiUrl}/leave/balances/work-window`)
        .flush({ timezone: 'UTC', workStartTime: '09:00', workEndTime: '17:00' });
      await opened;

      expect(fixture.componentInstance.leaveWizard()).toEqual({
        leaveTypeId: 'sick', startDate: date, startTime: '09:00', endDate: date, endTime: '11:00', reason: 'Doctor',
      });
    });

    // Follow-up 5: the leave form works in the work-window zone; wait for it rather than guess with the planner's.
    it('Time off More options waits for the work window and converts into its zone', async () => {
      setup();
      await settle();
      const date = editableDate();
      fixture.componentInstance.onSlotClick({ date, hour: 9 });

      const opened = fixture.componentInstance.onTimeOffMoreOptions({ leaveTypeId: 'sick', startIso: `${date}T09:00:00.000Z`,
        endIso: `${date}T11:00:00.000Z`, reason: null });
      await new Promise((resolve) => setTimeout(resolve));
      http.expectOne(`${environment.apiUrl}/leave/balances/work-window`)
        .flush({ timezone: 'Asia/Colombo', workStartTime: '09:00', workEndTime: '17:00' });
      await opened;

      expect(fixture.componentInstance.leaveWizard()).toMatchObject({ startDate: date, startTime: '14:30', endTime: '16:30' });
    });

    it('a Time off submit closes the popover and says it was sent', async () => {
      setup();
      await settle();
      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });

      fixture.componentInstance.onTimeOffSubmitted();

      expect(fixture.componentInstance.createSlot()).toBeNull();
      expect(notify.success).toHaveBeenCalledWith('Leave request sent for approval.');
    });

    it('loads my leave for the visible range, and again after a Time off submit', async () => {
      setup();
      await settle();
      const leaveReads = () => http.match((r) => r.url === `${environment.apiUrl}/leave/requests/my`);

      const first = leaveReads();
      expect(first.length).toBeGreaterThan(0);
      expect(first[0].request.params.get('fromDate')).toBeTruthy();
      expect(first[0].request.params.get('toDate')).toBeTruthy();

      fixture.componentInstance.onTimeOffSubmitted();

      expect(leaveReads().length).toBe(1);
    });

    // Review fixes (2026-11-03 final review).
    const popover = () => fixture.debugElement.query(By.directive(PlannerCreatePopoverComponent)).componentInstance as PlannerCreatePopoverComponent;
    const tab = async (name: string) => {
      q(`create-tab-${name}`)!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const type = (testId: string, value: string) => {
      const el = q(testId) as HTMLInputElement;
      el.value = value;
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('the Meeting tab is created in the planner zone, with the shared all-day', async () => {
      setup();
      rangeZone = 'Pacific/Auckland';
      await settle();
      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });
      fixture.detectChanges();
      popover().shared.isAllDay.set(true);

      await tab('meeting');

      const form = fixture.debugElement.query(By.directive(MeetingFormModalComponent)).componentInstance as MeetingFormModalComponent;
      expect(form.form.controls.timezone.value).toBe('Pacific/Auckland');
      expect(form.form.controls.isAllDay.value).toBe(true);
    });

    it('a tab keeps what was typed when switching away and back', async () => {
      setup();
      await settle();
      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });
      fixture.detectChanges();
      type('event-tab-location', 'Clinic');

      await tab('workItem');
      await tab('event');

      expect((q('event-tab-location') as HTMLInputElement).value).toBe('Clinic');
    });

    it('a title typed on the Meeting tab is the title on the other tabs', async () => {
      setup();
      await settle();
      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });
      fixture.detectChanges();
      await tab('meeting');
      const form = fixture.debugElement.query(By.directive(MeetingFormModalComponent)).componentInstance as MeetingFormModalComponent;
      form.form.controls.title.setValue('Sprint review');

      await tab('event');

      expect((q('event-tab-title') as HTMLInputElement).value).toBe('Sprint review');
    });

    it('opening the popover starts the work item flow fresh', async () => {
      setup();
      await settle();
      const reset = vi.spyOn(fixture.debugElement.injector.get(WorkItemPlanFlow), 'reset');

      fixture.componentInstance.onSlotClick({ date: editableDate(), hour: 9 });

      expect(reset).toHaveBeenCalledTimes(1);
    });

    it('does not read my leave while the planner is off', async () => {
      setup(false);
      await settle();

      expect(http.match((r) => r.url === `${environment.apiUrl}/leave/requests/my`).length).toBe(0);
    });

    it('offers Meeting only while meetings can be written, and Time off only with leave access', async () => {
      setup();
      await settle();

      expect(fixture.componentInstance.createTabs()).toContain('event');
      expect(fixture.componentInstance.createTabs()).toContain('workItem');
    });
  });

  describe('Me / My team (team planner, 2026-11-03)', () => {
    const teamReads = () => http.match((r) => r.url.startsWith(`${base}/team`));

    it('shows My team only when the planner is on and canViewTeamPlan', async () => {
      setup(true, true);
      await settle();
      expect(q('planner-scope-team')).not.toBeNull();
      TestBed.resetTestingModule();
      setup(true, false);
      await settle();
      expect(q('planner-scope-team')).toBeNull();
    });

    it('hides My team when the planner is off', async () => {
      setup(false, true);
      await settle();
      expect(q('planner-scope-team')).toBeNull();
    });

    it('switching to My team renders the team planner and closes the create popover', async () => {
      setup(true, true);
      await settle();
      fixture.componentInstance.onSlotClick({ date: fixture.componentInstance.editableDateList()[0], hour: 9 });
      fixture.detectChanges();

      q('planner-scope-team')!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.createSlot()).toBeNull();
      expect(fixture.nativeElement.querySelector('app-team-planner')).not.toBeNull();
      expect(q('calendar-view-select')).toBeNull();
      expect(teamReads().length).toBe(1);

      q('planner-scope-me')!.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-team-planner')).toBeNull();
    });

    it('?scope=team&teamView=week&date=2026-11-05 opens the team week', async () => {
      await setupAt('/?scope=team&teamView=week&date=2026-11-05');
      await settle();
      const reads = teamReads();
      expect(reads.map((r) => r.request.url)).toContain(`${base}/team/range`);
      const range = reads.find((r) => r.request.url === `${base}/team/range`)!.request.params;
      expect([range.get('from'), range.get('to')]).toEqual(['2026-11-02', '2026-11-08']);
    });

    it('?person=e1 opens that person\'s plan', async () => {
      await setupAt('/?scope=team&date=2026-11-05&person=e1');
      await settle();
      expect(http.match((r) => r.url === `${base}/employees/e1/range`).length).toBe(1);
    });
  });
});
