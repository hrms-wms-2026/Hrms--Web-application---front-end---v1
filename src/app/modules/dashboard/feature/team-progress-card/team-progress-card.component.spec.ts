import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { LedHourTotals, LedModuleProgress, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { TeamProgressCardComponent } from './team-progress-card.component';

describe('TeamProgressCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(
    result: LedWorkProgressResponse | 'error'
  ): Promise<ComponentFixture<TeamProgressCardComponent>> {
    const { fixture } = await setupWithApi(result);
    return fixture;
  }

  async function setupWithApi(
    result: LedWorkProgressResponse | 'error'
  ): Promise<{ fixture: ComponentFixture<TeamProgressCardComponent>; getLedProgress: ReturnType<typeof vi.fn> }> {
    const getLedProgress = vi.fn(() => (result === 'error' ? throwError(() => new Error('fail')) : of(result)));
    navigate = vi.fn();

    await TestBed.configureTestingModule({
      imports: [TeamProgressCardComponent],
      providers: [
        MyTeamLedProgressStore,
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } },
        { provide: Router, useValue: { navigate } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TeamProgressCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getLedProgress };
  }

  const hours = (allocated: number, completed: number, inProgress: number, notStarted: number, extra: Partial<LedHourTotals> = {}): LedHourTotals => {
    const tasked = completed + inProgress + notStarted;
    return {
      allocatedHours: allocated, completedHours: completed, inProgressHours: inProgress, notStartedHours: notStarted,
      untaskedHours: Math.max(0, allocated - tasked), overTaskedHours: Math.max(0, tasked - allocated),
      taskCount: tasked > 0 ? 1 : 0, unestimatedTaskCount: 0, ...extra
    };
  };

  const module = (objectiveId: string, title: string, h: LedHourTotals, extra: Partial<LedModuleProgress> = {}): LedModuleProgress => ({
    objectiveId, title, isRootModule: false, endDate: '2026-12-01', parentObjectiveId: null, depth: 0, atRisk: false, hours: h, ...extra
  });

  const response = (modules: LedModuleProgress[], extra: Partial<LedWorkProgressResponse> = {}): LedWorkProgressResponse => {
    const heads = modules.filter((m) => m.depth === 0);
    const total = heads.reduce<LedHourTotals>((sum, m) => ({
      allocatedHours: sum.allocatedHours + m.hours.allocatedHours,
      completedHours: sum.completedHours + m.hours.completedHours,
      inProgressHours: sum.inProgressHours + m.hours.inProgressHours,
      notStartedHours: sum.notStartedHours + m.hours.notStartedHours,
      untaskedHours: sum.untaskedHours + m.hours.untaskedHours,
      overTaskedHours: sum.overTaskedHours + m.hours.overTaskedHours,
      taskCount: sum.taskCount + m.hours.taskCount,
      unestimatedTaskCount: sum.unestimatedTaskCount + m.hours.unestimatedTaskCount
    }), hours(0, 0, 0, 0));
    return {
      hours: total,
      projects: [{ projectId: 'p1', projectName: 'Core Platform', identifier: 'CP', hours: total, modules }],
      overdueTasks: [], overdueTotal: 0, modulesAtRisk: heads.filter((m) => m.atRisk).length,
      ...extra
    };
  };

  const text = (fixture: ComponentFixture<TeamProgressCardComponent>, testId: string): string =>
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement).textContent!.trim();

  it('shows "you don\'t lead any active modules" when there are no projects', async () => {
    const fixture = await setup({ hours: hours(0, 0, 0, 0), projects: [], overdueTasks: [], overdueTotal: 0, modulesAtRisk: 0 });
    expect(fixture.nativeElement.textContent).toContain("You don't lead any active modules");
  });

  it('shows the empty message when led modules have no hours and no tasks', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(0, 0, 0, 0))]));
    expect(fixture.nativeElement.textContent).toContain('No hours allocated or tasks in the modules you lead');
  });

  it('shows the allocation split into completed, in progress, not started and not-yet-tasked hours', async () => {
    // 200 h allocated: 40 done, 30 in progress, 70 not started, 60 not given to any task yet.
    const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));

    expect(text(fixture, 'team-progress-total')).toBe('200 h allocated');
    expect(text(fixture, 'team-progress-legend-completed')).toBe('40 h');
    expect(text(fixture, 'team-progress-legend-in-progress')).toBe('30 h');
    expect(text(fixture, 'team-progress-legend-not-started')).toBe('70 h');
    expect(text(fixture, 'team-progress-legend-untasked')).toBe('60 h');
    expect(text(fixture, 'team-progress-completion')).toBe('20%');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="pie-slice"]').length).toBe(4);
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-over-tasked"]')).toBeNull();
  });

  it('flags tasks beyond the allocation and tasks without an estimate', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(10, 4, 4, 4.5, { unestimatedTaskCount: 2 }))]));
    expect(text(fixture, 'team-progress-legend-untasked')).toBe('0 h');
    expect(text(fixture, 'team-progress-over-tasked')).toContain('2.5 h');
    expect(text(fixture, 'team-progress-unestimated')).toBe('2 tasks have no estimate');
  });

  it('lists led modules at-risk first, then least complete, with child modules indented below their parent', async () => {
    const fixture = await setup(response([
      module('healthy', 'Healthy', hours(10, 9, 1, 0)),
      module('slow', 'Slow', hours(10, 1, 0, 0)),
      module('late', 'Late', hours(10, 2, 0, 3), { atRisk: true }),
      module('late-child', 'Late child', hours(5, 0, 0, 3), { parentObjectiveId: 'late', depth: 1, atRisk: true })
    ]));
    expect(text(fixture, 'team-progress-at-risk')).toBe('1');
    expect(text(fixture, 'team-progress-toggle')).toBe('View all (3)');

    const el = openAll(fixture);
    const rows = Array.from(el.querySelectorAll('[data-testid="team-progress-module"]') as NodeListOf<HTMLElement>);
    expect(rows.map((row) => row.querySelector('button p')!.textContent!.trim().replace(/^↳\s*/, ''))).toEqual(
      ['Late', 'Late child', 'Slow', 'Healthy']
    );
    expect(rows.map((row) => row.getAttribute('data-depth'))).toEqual(['0', '1', '0', '0']);
    expect(rows[0].textContent).toContain('5 h not tasked');
    expect(rows[0].textContent).toContain('Overdue work');
  });

  it('names the assignees on each overdue task', async () => {
    const fixture = await setup(response([module('o1', 'Platform', hours(5, 0, 0, 1), { atRisk: true })], {
      overdueTasks: [{
        taskId: 't1', shortId: 'PL-1', title: 'Ship it', projectId: 'p1', objectiveId: 'o1', dueDate: '2026-10-01',
        daysOverdue: 6, assignees: [{ employeeId: 'e1', displayName: 'Kajaa Tharan' }]
      }],
      overdueTotal: 1
    }));
    expect(openAll(fixture).querySelector('[data-testid="team-progress-overdue"]')!.textContent).toContain('Kajaa Tharan');
  });

  /** Opens the pop-out (module breakdown + overdue tasks) via the card's "View all". */
  function openAll(fixture: ComponentFixture<TeamProgressCardComponent>): HTMLElement {
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="team-progress-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    return el;
  }

  it('shows the error state with retry on failure', async () => {
    const fixture = await setup('error');
    expect(fixture.nativeElement.textContent).toContain("Couldn't load team progress");
  });

  it('navigates to the module tree on a module or child-module click', async () => {
    const fixture = await setup(response([
      module('o1', 'Payments', hours(10, 0, 1, 0)),
      module('o2', 'Refunds', hours(4, 0, 1, 0), { parentObjectiveId: 'o1', depth: 1 })
    ]));
    const buttons = openAll(fixture).querySelectorAll('[data-testid="team-progress-projects"] button') as NodeListOf<HTMLButtonElement>;
    buttons[1].click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o2', 'tree']);
  });

  it('navigates to the task board with a highlight on overdue task click', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(5, 0, 0, 1), { atRisk: true })], {
      overdueTasks: [{
        taskId: 't1', shortId: 'CP-9', title: 'Fix login bug', projectId: 'p1', objectiveId: 'o1',
        dueDate: '2026-09-25', daysOverdue: 5, assignees: []
      }],
      overdueTotal: 1
    }));
    const taskButton: HTMLButtonElement = openAll(fixture).querySelector('[data-testid="team-progress-overdue"] button')!;
    taskButton.click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], {
      queryParams: { highlightTaskId: 't1' }
    });
  });

  const EMPTY: LedWorkProgressResponse = { hours: hours(0, 0, 0, 0), projects: [], overdueTasks: [], overdueTotal: 0, modulesAtRisk: 0 };

  it('polls every 60 seconds while the document is visible', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { getLedProgress } = await setupWithApi(EMPTY);
    expect(getLedProgress).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getLedProgress).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getLedProgress).toHaveBeenCalledTimes(3);
  });

  it('stops polling while hidden and refetches immediately when visible again', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { getLedProgress } = await setupWithApi(EMPTY);
    expect(getLedProgress).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(getLedProgress).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getLedProgress).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getLedProgress).toHaveBeenCalledTimes(3);
  });

  it('removes the visibilitychange listener and clears the interval on destroy', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { fixture, getLedProgress } = await setupWithApi(EMPTY);

    fixture.destroy();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    await vi.advanceTimersByTimeAsync(120_000);
    expect(getLedProgress).toHaveBeenCalledTimes(1);
  });
  describe('inside a dashboard frame', () => {
    async function setupInFrame(widget: ReturnType<typeof fakeWidgetData>, result: LedWorkProgressResponse | 'error') {
      const getLedProgress = vi.fn(() => (result === 'error' ? throwError(() => new Error('fail')) : of(result)));
      navigate = vi.fn();
      await TestBed.configureTestingModule({
        imports: [TeamProgressCardComponent],
        providers: [
          MyTeamLedProgressStore,
          { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } },
          { provide: Router, useValue: { navigate } },
          widget.provider
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(TeamProgressCardComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, getLedProgress, store: TestBed.inject(MyTeamLedProgressStore) };
    }

    it('uses_bootstrap_payload_without_calling_its_api', async () => {
      const payload = response([module('o1', 'Payments', hours(200, 40, 30, 70))]);
      const widget = fakeWidgetData('success', payload);
      const { fixture, getLedProgress, store } = await setupInFrame(widget, EMPTY);

      expect(getLedProgress).not.toHaveBeenCalled();
      expect(widget.refresh).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('200 h allocated');
      // The shared root store (also read by the action center) holds the same led-progress data.
      expect(store.data()).toEqual(payload);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.loadedAt()).toBeInstanceOf(Date);
    });

    it('falls_back_to_own_api_outside_dashboard', async () => {
      const { fixture, getLedProgress } = await setupWithApi(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.textContent).toContain('200 h allocated');
    });

    it('falls back to its own api, with its own error state, when the bootstrap state is an error', async () => {
      const { fixture, getLedProgress } = await setupInFrame(fakeWidgetData('error'), 'error');
      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.textContent).toContain("Couldn't load team progress");
    });

    it('polls through the widget context every 60 seconds and feeds the result into the store', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
      const widget = fakeWidgetData('success', EMPTY);
      const { fixture, getLedProgress, store } = await setupInFrame(widget, EMPTY);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(widget.refresh).toHaveBeenCalledOnce();
      expect(getLedProgress).not.toHaveBeenCalled();
      expect(store.loading()).toBe(true);

      const next = response([module('o2', 'Billing', hours(10, 5, 0, 0))]);
      widget.resolve(next);
      fixture.detectChanges();
      expect(store.data()).toEqual(next);
      expect(store.loading()).toBe(false);
    });

    it('falls back to its own api when a context refresh fails', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
      const widget = fakeWidgetData('success', EMPTY);
      const next = response([module('o3', 'Ledger', hours(10, 5, 0, 0))]);
      const { fixture, getLedProgress, store } = await setupInFrame(widget, next);

      await vi.advanceTimersByTimeAsync(60_000);
      widget.fail();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(store.data()).toEqual(next);
    });
  });
});
