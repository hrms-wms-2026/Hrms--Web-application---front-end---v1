import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { TeamProgressDetailApiService } from '../../data-access/team-progress-detail-api.service';
import {
  LedEmployeeProgress,
  LedEmployeeProgressPage,
  LedPeriodProgress,
  LedProgressPeriod,
  LedWeeklyCompletion
} from '../../models/team-progress-detail.model';
import { LedHourTotals, LedModuleProgress, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { ledTime, workloadRow } from '../../utils/team-progress-time.testing';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { TeamProgressDetailDialogComponent } from '../team-progress-detail-dialog/team-progress-detail-dialog.component';
import { TEAM_PROGRESS_PERIOD_STORAGE_KEY, TeamProgressCardComponent } from './team-progress-card.component';

/** The real dialog loads its own lists; the card only needs its inputs and output. */
@Component({ selector: 'app-team-progress-detail-dialog', standalone: true, template: '' })
class StubDetailDialogComponent {
  readonly open = input(false);
  readonly summary = input<LedWorkProgressResponse | null>(null);
  readonly period = input<LedProgressPeriod>('all');
  readonly periodChange = output<LedProgressPeriod>();
  readonly closed = output<void>();
}

/** Stands in for ResizeObserver so a test can report any host size. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {
    // Not used by the card.
  }

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(width: number, height: number): void {
    this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

const STUB_DIALOG = {
  remove: { imports: [TeamProgressDetailDialogComponent] },
  add: { imports: [StubDetailDialogComponent] }
};

const member = (employeeId: string, displayName: string, totalHours: number): LedEmployeeProgress => ({
  employeeId, displayName, completedHours: totalHours / 2, inProgressHours: totalHours / 2, notStartedHours: 0,
  totalHours, taskCount: totalHours > 0 ? 2 : 0, sharedTaskCount: 0, sharedHours: 0
});

const employeePage = (items: LedEmployeeProgress[]): LedEmployeeProgressPage => ({
  items, pageNumber: 1, pageSize: 5, totalCount: items.length, totalPages: 1, hasNext: false, hasPrevious: false,
  unassigned: { completedHours: 0, inProgressHours: 0, notStartedHours: 0, totalHours: 0, taskCount: 0 }
});

const periodPayload = (period: 'week' | 'month', extra: Partial<LedPeriodProgress> = {}): LedPeriodProgress => ({
  period, from: '2026-10-19', to: '2026-10-25',
  completedHours: 5, inProgressHours: 5, notStartedHours: 10, totalHours: 20,
  taskCount: 6, completedTaskCount: 1, inProgressTaskCount: 2, notStartedTaskCount: 3, unestimatedTaskCount: 0,
  ...extra
});

const weeklyPayload = (extra: Partial<LedWeeklyCompletion> = {}): LedWeeklyCompletion => ({
  weeks: Array.from({ length: 10 }, (_, i) => ({
    weekStart: `2026-08-${String(10 + i).padStart(2, '0')}`,
    weekEnd: `2026-08-${String(16 + i).padStart(2, '0')}`,
    completedHours: i * 2,
    completedTaskCount: i
  })),
  allocatedHours: 300,
  undatedCompletedHours: 0,
  undatedCompletedTaskCount: 0,
  ...extra
});

describe('TeamProgressCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let getEmployees: ReturnType<typeof vi.fn>;
  let getPeriodProgress: ReturnType<typeof vi.fn>;
  let getWeeklyCompletion: ReturnType<typeof vi.fn>;
  let getTimeProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getTimeProgress = vi.fn((period: 'week' | 'month') => of(ledTime({ period })));
    getEmployees = vi.fn(() => of(employeePage([])));
    getWeeklyCompletion = vi.fn(() => of(weeklyPayload()));
    getPeriodProgress = vi.fn((period: 'week' | 'month') => of(periodPayload(period)));
    try {
      localStorage.removeItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY);
    } catch {
      // Some runs stub storage away.
    }
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    // A fresh object per call, like a real HTTP response.
    const getLedProgress = vi.fn(() => (result === 'error' ? throwError(() => new Error('fail')) : of(structuredClone(result))));
    navigate = vi.fn();

    await TestBed.configureTestingModule({
      imports: [TeamProgressCardComponent],
      providers: [
        MyTeamLedProgressStore,
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress } },
        { provide: Router, useValue: { navigate } },
        { provide: TeamProgressDetailApiService, useValue: { getEmployees, getPeriodProgress, getWeeklyCompletion, getTimeProgress } }
      ]
    })
      .overrideComponent(TeamProgressCardComponent, STUB_DIALOG)
      .compileComponents();

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
      overdueTasks: [], overdueTotal: 0, modulesAtRisk: heads.filter((m) => m.atRisk).length, overdueHours: 0, overdueUnestimatedTaskCount: 0, overdueByProject: [],
      ...extra
    };
  };

  const layoutMode = (fixture: ComponentFixture<TeamProgressCardComponent>): string | null =>
    (fixture.nativeElement.querySelector('[data-testid="team-progress-layout"]') as HTMLElement).getAttribute('data-mode');

  const dialog = (fixture: ComponentFixture<TeamProgressCardComponent>): StubDetailDialogComponent =>
    fixture.debugElement.query(By.directive(StubDetailDialogComponent)).componentInstance as StubDetailDialogComponent;

  const text = (fixture: ComponentFixture<TeamProgressCardComponent>, testId: string): string =>
    (fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement).textContent!.replace(/\s+/g, ' ').trim();

  it('shows "you don\'t lead any active modules" when there are no projects', async () => {
    const fixture = await setup({ hours: hours(0, 0, 0, 0), projects: [], overdueTasks: [], overdueTotal: 0, modulesAtRisk: 0, overdueHours: 0, overdueUnestimatedTaskCount: 0, overdueByProject: [] });
    expect(fixture.nativeElement.textContent).toContain("You don't lead any active modules");
  });

  it('shows the empty message when led modules have no hours and no tasks', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(0, 0, 0, 0))]));
    expect(fixture.nativeElement.textContent).toContain('No hours allocated or tasks in the modules you lead');
  });

  it('shows the allocation split into completed, in progress, not started and not-yet-tasked hours', async () => {
    // 200 h allocated: 40 done, 30 in progress, 70 not started, 60 not given to any task yet.
    const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));

    expect(text(fixture, 'team-progress-total')).toBe('200 h Allocated');
    expect(text(fixture, 'team-progress-legend-completed')).toBe('40 h');
    expect(text(fixture, 'team-progress-legend-in-progress')).toBe('30 h');
    expect(text(fixture, 'team-progress-legend-not-started')).toBe('70 h');
    expect(text(fixture, 'team-progress-legend-untasked')).toBe('60 h');
    expect(text(fixture, 'team-progress-legend-completed-percent')).toBe('(20%)');
    expect(text(fixture, 'team-progress-legend-in-progress-percent')).toBe('(15%)');
    expect(text(fixture, 'team-progress-legend-not-started-percent')).toBe('(35%)');
    expect(text(fixture, 'team-progress-legend-untasked-percent')).toBe('(30%)');
    expect(text(fixture, 'team-progress-completion')).toBe('20%');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="donut-segment"]').length).toBe(4);
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-over-tasked"]')).toBeNull();
  });

  it('labels the donut with every status, its hours and its share', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
    const svg: SVGElement = fixture.nativeElement.querySelector('[data-testid="team-progress-donut"] svg');
    expect(svg.getAttribute('role')).toBe('img');
    const label = svg.getAttribute('aria-label')!;
    expect(label).toContain('200 h allocated');
    for (const part of ['Completed 40 h (20%)', 'In progress 30 h (15%)', 'Not started 70 h (35%)', 'Not yet tasked 60 h (30%)']) {
      expect(label).toContain(part);
    }
  });

  it('never shows a non-zero share as 0% and separates thousands', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(20_200, 100, 0, 0))]));
    expect(text(fixture, 'team-progress-total')).toBe('20,200 h Allocated');
    expect(text(fixture, 'team-progress-completion')).toBe('0.5%');
    expect(text(fixture, 'team-progress-legend-completed')).toBe('100 h');
    expect(text(fixture, 'team-progress-legend-completed-percent')).toBe('(0.5%)');
    expect(text(fixture, 'team-progress-legend-untasked')).toBe('20,100 h');
    expect(text(fixture, 'team-progress-legend-untasked-percent')).toBe('(99.5%)');
    expect(text(fixture, 'team-progress-legend-in-progress-percent')).toBe('(0%)');
  });

  it('takes shares against the task estimates when nothing is allocated', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(0, 10, 30, 0))]));
    expect(text(fixture, 'team-progress-completion')).toBe('25%');
    expect(text(fixture, 'team-progress-legend-in-progress-percent')).toBe('(75%)');
  });

  it('flags tasks beyond the allocation and tasks without an estimate', async () => {
    const fixture = await setup(response([module('o1', 'Payments', hours(10, 4, 4, 4.5, { unestimatedTaskCount: 2 }))]));
    expect(text(fixture, 'team-progress-legend-untasked')).toBe('0 h');
    expect(text(fixture, 'team-progress-over-tasked')).toContain('2.5 h');
    expect(text(fixture, 'team-progress-unestimated')).toBe('2 tasks have no estimate');
  });

  it('shows the error state with retry on failure', async () => {
    const fixture = await setup('error');
    expect(fixture.nativeElement.textContent).toContain("Couldn't load team progress");
  });

  it('starts in the small layout when ResizeObserver is not available', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
    expect(layoutMode(fixture)).toBe('small');
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-donut"]')).not.toBeNull();
  });

  describe('size-adaptive layout', () => {
    let rafQueue: FrameRequestCallback[];

    beforeEach(() => {
      FakeResizeObserver.instances = [];
      rafQueue = [];
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });

    function flushFrames(): void {
      const queued = rafQueue;
      rafQueue = [];
      for (const cb of queued) cb(0);
    }

    /** Reports a host size and runs the queued animation frame. */
    function resize(fixture: ComponentFixture<TeamProgressCardComponent>, width: number, height: number): void {
      FakeResizeObserver.instances[FakeResizeObserver.instances.length - 1].trigger(width, height);
      flushFrames();
      fixture.detectChanges();
    }

    const has = (fixture: ComponentFixture<TeamProgressCardComponent>, testId: string): boolean =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) !== null;

    const sample = (): LedWorkProgressResponse =>
      response([
        module('o1', 'Payments', hours(200, 40, 30, 70), { atRisk: true }),
        module('o2', 'Billing', hours(100, 50, 0, 10))
      ], {
        overdueTasks: [{
          taskId: 't1', shortId: 'CP-1', title: 'Ship it', projectId: 'p1', objectiveId: 'o1', dueDate: '2026-10-01',
          daysOverdue: 3, estimatedHours: null, assignees: [{ employeeId: 'e1', displayName: 'Kajaa Tharan' }]
        }],
        overdueTotal: 1
      });

    it('observes the card host', async () => {
      const fixture = await setup(sample());
      expect(FakeResizeObserver.instances).toHaveLength(1);
      expect(FakeResizeObserver.instances[0].observed).toEqual([fixture.nativeElement]);
    });

    const LEGEND = ['completed', 'in-progress', 'not-started', 'untasked'];
    const cases: [string, number, number, string, string[], string[]][] = [
      ['3x3', 315, 312, 'xs',
        ['team-progress-donut', 'team-progress-completion'],
        ['team-progress-legend', 'team-progress-metrics', 'team-progress-modules', 'team-progress-view-details', 'team-progress-period']],
      ['3x4', 315, 420, 'xs', ['team-progress-donut', 'team-progress-legend'], ['team-progress-metrics', 'team-progress-period']],
      ['3x5', 315, 528, 'xs',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-metrics', 'team-progress-view-details'],
        ['team-progress-modules']],
      ['4x3', 424, 312, 'small',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-completion', 'team-progress-metrics'],
        ['team-progress-modules', 'team-progress-view-details', 'team-progress-weekly']],
      ['4x5', 424, 528, 'small', ['team-progress-donut', 'team-progress-legend', 'team-progress-view-details'], ['team-progress-modules']],
      ['6x3', 642, 312, 'wide', ['team-progress-donut', 'team-progress-legend', 'team-progress-metrics'], ['team-progress-modules']],
      ['6x4', 642, 420, 'medium',
        ['team-progress-total', 'team-progress-status-bar', 'team-progress-tiles', 'team-progress-metrics', 'team-progress-view-details'],
        ['team-progress-donut', 'team-progress-modules']],
      ['6x5', 642, 528, 'medium',
        ['team-progress-status-bar', 'team-progress-tiles', 'team-progress-modules', 'team-progress-overdue'],
        ['team-progress-donut', 'team-progress-view-details']],
      ['8x4', 860, 420, 'wide',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-metrics', 'team-progress-modules', 'team-progress-overdue'],
        ['team-progress-weekly', 'team-progress-top-members']],
      ['12x4', 1296, 420, 'wide', ['team-progress-donut', 'team-progress-metrics'], ['team-progress-projects', 'team-progress-weekly']],
      ['4x6', 424, 636, 'tall',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-weekly', 'team-progress-view-details'],
        ['team-progress-metrics', 'team-progress-projects']],
      ['mobile', 343, 636, 'tall', ['team-progress-donut', 'team-progress-legend', 'team-progress-weekly'], ['team-progress-metrics']],
      ['4x8', 424, 852, 'tall', ['team-progress-weekly', 'team-progress-modules', 'team-progress-view-details'], ['team-progress-metrics']],
      ['8x6', 860, 636, 'large',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-metrics', 'team-progress-weekly', 'team-progress-modules', 'team-progress-overdue'],
        ['team-progress-projects', 'team-progress-view-details']],
      ['12x8', 1296, 852, 'maximum',
        ['team-progress-donut', 'team-progress-legend', 'team-progress-metrics', 'team-progress-weekly', 'team-progress-projects', 'team-progress-modules', 'team-progress-overdue'],
        ['team-progress-status-bar']]
    ];

    it('small view: KPI cards fill the space under the donut, in progress and overdue first', async () => {
      const fixture = await setup(sample());
      resize(fixture, 424, 312);
      expect(text(fixture, 'team-progress-kpi-in-progress')).toMatch(/h\s*In progress · \d+%/);
      expect(text(fixture, 'team-progress-kpi-overdue')).toContain('Overdue · 1 task');
      expect(has(fixture, 'team-progress-kpi-tasks')).toBe(false);
      resize(fixture, 424, 420);
      expect(has(fixture, 'team-progress-kpi-tasks')).toBe(true);
      expect(text(fixture, 'team-progress-kpi-at-risk')).toContain('Module at risk');
    });

    for (const [name, width, height, mode, present, absent] of cases) {
      it(`${name} (${width}x${height}) renders the ${mode} layout`, async () => {
        const fixture = await setup(sample());
        resize(fixture, width, height);
        expect(layoutMode(fixture)).toBe(mode);
        for (const id of present) expect(has(fixture, id), `${id} should be shown`).toBe(true);
        for (const id of absent) expect(has(fixture, id), `${id} should be hidden`).toBe(false);
        // Every status is listed with hours and a share wherever a legend or status tiles show.
        if (has(fixture, 'team-progress-legend') || has(fixture, 'team-progress-tiles')) {
          for (const key of LEGEND) {
            expect(text(fixture, `team-progress-legend-${key}`)).toMatch(/ h$/);
            expect(text(fixture, `team-progress-legend-${key}-percent`)).toMatch(/%\)?$/);
          }
        }
        expect(text(fixture, 'team-progress-completion')).toBe('30%');
      });
    }

    it('keeps the donut centre text at one fixed size in every view', async () => {
      const fixture = await setup(sample());
      for (const [w, h] of [[315, 312], [424, 312], [860, 420], [424, 636], [860, 636], [1296, 852]]) {
        resize(fixture, w, h);
        const center = fixture.nativeElement.querySelector('[data-testid="team-progress-total"] span') as HTMLElement;
        expect(center.style.fontSize).toBe('17px');
      }
    });

    it('shows three metric tiles in the wide layout and four from 1000px', async () => {
      const fixture = await setup(sample());
      const tiles = (): number => fixture.nativeElement.querySelectorAll('[data-testid="team-progress-metrics"] .tp-tile').length;
      resize(fixture, 900, 420);
      expect(tiles()).toBe(3);
      expect(has(fixture, 'team-progress-at-risk')).toBe(false);
      resize(fixture, 1300, 420);
      expect(tiles()).toBe(4);
      expect(text(fixture, 'team-progress-at-risk')).toBe('1');
    });

    it('coalesces several size reports into one frame and uses the last one', async () => {
      const fixture = await setup(sample());
      const observer = FakeResizeObserver.instances[0];
      const setMode = vi.spyOn(fixture.componentInstance.mode, 'set');
      observer.trigger(900, 420);
      observer.trigger(650, 420);
      observer.trigger(1300, 852);
      expect(setMode).not.toHaveBeenCalled();
      flushFrames();
      expect(setMode).toHaveBeenCalledOnce();
      expect(setMode).toHaveBeenCalledWith('maximum');
      fixture.detectChanges();
      expect(layoutMode(fixture)).toBe('maximum');
    });

    it('loads the top team members only in the large and maximum layouts, once per data load', async () => {
      getEmployees = vi.fn(() => of(employeePage([member('e1', 'Asha Perera', 40), member('e2', 'Ravi Kumar', 0)])));
      const fixture = await setup(sample());
      resize(fixture, 650, 420);
      expect(getEmployees).not.toHaveBeenCalled();

      resize(fixture, 900, 636);
      expect(getEmployees).toHaveBeenCalledOnce();
      expect(getEmployees).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 5, sort: 'totalHours', direction: 'desc' });
      fixture.detectChanges();
      // Zero-hour people are left out; the panel sits beside the weekly chart.
      expect(fixture.nativeElement.querySelectorAll('[data-testid="team-progress-top-member"]').length).toBe(1);
      expect(has(fixture, 'team-progress-weekly')).toBe(true);

      resize(fixture, 1300, 852);
      resize(fixture, 900, 636);
      expect(getEmployees).toHaveBeenCalledOnce();
    });

    it('reloads the top team members for the selected period', async () => {
      getEmployees = vi.fn(() => of(employeePage([member('e1', 'Asha Perera', 40)])));
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      expect(getEmployees).toHaveBeenCalledOnce();
      expect(getEmployees.mock.calls[0][0]).not.toHaveProperty('period');

      fixture.componentInstance.setPeriod('week');
      fixture.detectChanges();
      expect(getEmployees).toHaveBeenCalledTimes(2);
      expect(getEmployees.mock.calls[1][0]).toMatchObject({ period: 'week', pageSize: 5 });

      // Resizing within the large layouts does not refetch for the same period.
      resize(fixture, 1300, 852);
      expect(getEmployees).toHaveBeenCalledTimes(2);
    });

    it('the overdue panel shows the total overdue hours on top and each task hours', async () => {
      const data = sample();
      data.overdueTasks[0].estimatedHours = 4;
      data.overdueHours = 12;
      const fixture = await setup(data);
      resize(fixture, 900, 636);
      expect(text(fixture, 'team-progress-overdue-hours')).toBe('12 h');
      expect(text(fixture, 'team-progress-overdue-task-hours')).toBe('4 h');
    });

    it('an overdue task without an estimate shows "—", never 0 h', async () => {
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      expect(text(fixture, 'team-progress-overdue-task-hours')).toBe('—');
    });

    it('keeps the large layout working when the top team members fail to load', async () => {
      getEmployees = vi.fn(() => throwError(() => new Error('fail')));
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      expect(has(fixture, 'team-progress-top-members')).toBe(false);
      expect(has(fixture, 'team-progress-overdue')).toBe(true);
    });

    it('2x2 shows the mini view: the full-size donut with the completion in it, no period switch', async () => {
      const fixture = await setup(sample());
      resize(fixture, 206, 204);
      expect(layoutMode(fixture)).toBe('mini');
      expect(has(fixture, 'team-progress-mini')).toBe(true);
      const donut = fixture.nativeElement.querySelector('[data-testid="team-progress-donut"]') as HTMLElement;
      expect(donut.style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
      expect(has(fixture, 'team-progress-period')).toBe(false);
      expect(has(fixture, 'team-progress-legend')).toBe(false);
      expect(has(fixture, 'team-progress-status-bar')).toBe(false);
      expect(text(fixture, 'team-progress-completion')).toBe('30%');
      expect(has(fixture, 'team-progress-total')).toBe(false);

      // A little wider, the total sits beside the donut.
      resize(fixture, 292, 204);
      expect(has(fixture, 'team-progress-donut')).toBe(true);
      expect(has(fixture, 'team-progress-total')).toBe(true);

      // Stretched sideways (2 rows), the stacked status bar and its legend replace the donut.
      resize(fixture, 860, 204);
      expect(layoutMode(fixture)).toBe('mini');
      expect(has(fixture, 'team-progress-status-bar')).toBe(true);
      expect(has(fixture, 'team-progress-donut')).toBe(false);
      for (const key of ['completed', 'in-progress', 'not-started', 'untasked']) {
        expect(text(fixture, `team-progress-legend-${key}`)).toMatch(/ h$/);
      }
    });

    it('the donut is the shared dashboard size in every view that shows it', async () => {
      const fixture = await setup(sample());
      for (const [w, h] of [[315, 312], [424, 420], [642, 312], [500, 636], [900, 636], [1296, 852]]) {
        resize(fixture, w, h);
        const donut = fixture.nativeElement.querySelector('[data-testid="team-progress-donut"]') as HTMLElement;
        expect(donut.style.width).toBe(`${DASHBOARD_DONUT_PX}px`);
        expect(donut.style.height).toBe(`${DASHBOARD_DONUT_PX}px`);
      }
    });

    it('a 2-column card with height keeps the donut (xs), its legend without the share column', async () => {
      const fixture = await setup(sample());
      resize(fixture, 282, 420);
      expect(layoutMode(fixture)).toBe('xs');
      expect(has(fixture, 'team-progress-donut')).toBe(true);
      expect(has(fixture, 'team-progress-mini')).toBe(false);
      const body = fixture.nativeElement.querySelector('[data-testid="team-progress-layout"]') as HTMLElement;
      expect(body.classList).toContain('tp-body--narrow');

      resize(fixture, 424, 420);
      expect(body.classList).not.toContain('tp-body--narrow');
    });

    it('never fetches because of a size change', async () => {
      const { fixture, getLedProgress } = await setupWithApi(sample());
      expect(getLedProgress).toHaveBeenCalledTimes(1);
      resize(fixture, 650, 420);
      resize(fixture, 1300, 852);
      resize(fixture, 320, 420);
      expect(getLedProgress).toHaveBeenCalledTimes(1);
    });

    it('lists led modules at-risk first, then least complete', async () => {
      const fixture = await setup(response([
        module('healthy', 'Healthy', hours(10, 9, 1, 0)),
        module('slow', 'Slow', hours(10, 1, 0, 0)),
        module('late', 'Late', hours(10, 2, 0, 3), { atRisk: true }),
        module('late-child', 'Late child', hours(5, 0, 0, 3), { parentObjectiveId: 'late', depth: 1, atRisk: true })
      ]));
      // 10 rows: at 8 the bucket chart takes the third list row's height (2026-11-02 design match).
      resize(fixture, 900, 1068);
      expect(text(fixture, 'team-progress-at-risk')).toBe('1');
      expect(text(fixture, 'team-progress-toggle')).toBe('View all (3)');
      const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="team-progress-module"]') as NodeListOf<HTMLElement>);
      expect(rows.map((row) => row.querySelector('button span span')!.textContent!.trim())).toEqual(['Late', 'Slow', 'Healthy']);
      expect(rows[0].textContent).toContain('At risk');
      expect(rows[1].querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('10');
    });

    it('shows only the rows that fit and a "+N more" link that opens the dialog', async () => {
      const many = Array.from({ length: 12 }, (_, i) => module(`m${i}`, `Module ${i}`, hours(10, i % 10, 0, 0)));
      const fixture = await setup(response(many));
      resize(fixture, 450, 852);
      const shown = fixture.nativeElement.querySelectorAll('[data-testid="team-progress-module"]').length;
      expect(shown).toBeGreaterThan(0);
      expect(shown).toBeLessThan(12);
      expect(text(fixture, 'team-progress-more')).toBe(`+${12 - shown} more`);

      (fixture.nativeElement.querySelector('[data-testid="team-progress-more"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(true);

      resize(fixture, 450, 1100);
      expect(fixture.nativeElement.querySelectorAll('[data-testid="team-progress-module"]').length).toBeGreaterThan(shown);
    });

    it('names the assignees on each overdue task', async () => {
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      expect(text(fixture, 'team-progress-overdue')).toContain('Kajaa Tharan');
    });

    it('lists each project with its completion', async () => {
      const fixture = await setup(sample());
      resize(fixture, 1300, 852);
      const projects = fixture.nativeElement.querySelectorAll('[data-testid="team-progress-project"]') as NodeListOf<HTMLElement>;
      expect(projects).toHaveLength(1);
      expect(projects[0].textContent).toContain('Core Platform');
      expect(projects[0].textContent).toContain('90 / 300 h');
      expect(projects[0].textContent).toContain('30%');
    });

    it('navigates to the module tree on a module click without opening the dialog', async () => {
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      (fixture.nativeElement.querySelector('[data-testid="team-progress-module"] button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'tree']);
      expect(dialog(fixture).open()).toBe(false);
    });

    it('navigates to the task board with a highlight on overdue task click', async () => {
      const fixture = await setup(sample());
      resize(fixture, 900, 636);
      (fixture.nativeElement.querySelector('[data-testid="team-progress-overdue"] button') as HTMLButtonElement).click();
      expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], {
        queryParams: { highlightTaskId: 't1' }
      });
    });

    describe('weekly completion', () => {
      it('is fetched only in the tall, large and maximum views, once per data load', async () => {
        const fixture = await setup(sample());
        for (const [w, h] of [[315, 312], [424, 312], [642, 420], [860, 420]]) resize(fixture, w, h);
        expect(getWeeklyCompletion).not.toHaveBeenCalled();

        resize(fixture, 424, 636);
        expect(getWeeklyCompletion).toHaveBeenCalledOnce();
        expect(getWeeklyCompletion).toHaveBeenCalledWith(10);
        expect(text(fixture, 'team-progress-weekly')).toContain('Weekly completion · last 10 weeks');
        expect(fixture.nativeElement.querySelectorAll('[data-testid="weekly-completion-bar"]').length).toBe(10);

        // Resizing between (and out of and back into) the weekly views never refetches.
        resize(fixture, 860, 636);
        resize(fixture, 1296, 852);
        resize(fixture, 424, 312);
        resize(fixture, 424, 636);
        expect(getWeeklyCompletion).toHaveBeenCalledOnce();
      });

      it('is not tied to the period switch', async () => {
        const fixture = await setup(sample());
        resize(fixture, 860, 636);
        fixture.componentInstance.setPeriod('week');
        fixture.detectChanges();
        fixture.componentInstance.setPeriod('month');
        fixture.detectChanges();
        expect(getWeeklyCompletion).toHaveBeenCalledOnce();
      });

      it('reloads with a refresh', async () => {
        const { fixture, getLedProgress } = await setupWithApi(sample());
        resize(fixture, 424, 636);
        (fixture.nativeElement.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
        await fixture.whenStable();
        fixture.detectChanges();
        expect(getLedProgress).toHaveBeenCalledTimes(2);
        expect(getWeeklyCompletion).toHaveBeenCalledTimes(2);
      });

      it('shows a skeleton while loading', async () => {
        const pending = new Subject<LedWeeklyCompletion>();
        getWeeklyCompletion = vi.fn(() => pending.asObservable());
        const fixture = await setup(sample());
        resize(fixture, 424, 636);
        expect(has(fixture, 'team-progress-weekly-loading')).toBe(true);
        pending.next(weeklyPayload());
        fixture.detectChanges();
        expect(has(fixture, 'team-progress-weekly-loading')).toBe(false);
        expect(has(fixture, 'weekly-completion-chart')).toBe(true);
      });

      it('notes completed hours without a date', async () => {
        getWeeklyCompletion = vi.fn(() => of(weeklyPayload({ undatedCompletedHours: 12.5, undatedCompletedTaskCount: 3 })));
        const fixture = await setup(sample());
        resize(fixture, 860, 636);
        expect(text(fixture, 'team-progress-weekly-undated')).toBe('12.5 h completed without a date');
      });

      it('has no footnote when every completed task has a date', async () => {
        const fixture = await setup(sample());
        resize(fixture, 860, 636);
        expect(has(fixture, 'team-progress-weekly-undated')).toBe(false);
      });

      it('hides the section on failure and gives its space to the lists', async () => {
        getWeeklyCompletion = vi.fn(() => throwError(() => new Error('404')));
        const fixture = await setup(sample());
        resize(fixture, 424, 636);
        expect(has(fixture, 'team-progress-weekly')).toBe(false);
        expect(has(fixture, 'team-progress-modules')).toBe(true);
        expect(has(fixture, 'team-progress-view-details')).toBe(true);
      });
    });

    it('disconnects the observer on destroy', async () => {
      const fixture = await setup(sample());
      const observer = FakeResizeObserver.instances[0];
      fixture.destroy();
      expect(observer.disconnected).toBe(true);
    });
  });

  describe('detail dialog', () => {
    it('is closed at first and receives the loaded summary', async () => {
      const payload = response([module('o1', 'Payments', hours(200, 40, 30, 70))]);
      const fixture = await setup(payload);
      expect(dialog(fixture).open()).toBe(false);
      expect(dialog(fixture).summary()).toEqual(payload);
    });

    it('opens from the header expand button', async () => {
      const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      (fixture.nativeElement.querySelector('[data-testid="popout-expand"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(true);
    });

    it('opens from "View details" and closes when the dialog emits closed', async () => {
      FakeResizeObserver.instances = [];
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('requestAnimationFrame', undefined);
      const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      FakeResizeObserver.instances[0].trigger(450, 636);
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="team-progress-view-details"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(true);

      dialog(fixture).closed.emit();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(false);
    });

    it('opens on a click anywhere on the card', async () => {
      const fixture = await setup(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      (fixture.nativeElement.querySelector('[data-testid="team-progress-legend"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(true);
    });

    it('does not open while there is no data', async () => {
      const fixture = await setup('error');
      (fixture.nativeElement.querySelector('[data-testid="team-progress-card"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(dialog(fixture).open()).toBe(false);
    });

    it('refresh reloads without opening the dialog', async () => {
      const { fixture, getLedProgress } = await setupWithApi(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      (fixture.nativeElement.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(getLedProgress).toHaveBeenCalledTimes(2);
      expect(dialog(fixture).open()).toBe(false);
    });
  });

  const EMPTY: LedWorkProgressResponse = { hours: hours(0, 0, 0, 0), projects: [], overdueTasks: [], overdueTotal: 0, modulesAtRisk: 0, overdueHours: 0, overdueUnestimatedTaskCount: 0, overdueByProject: [] };

  it('does not poll on a timer', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { getLedProgress } = await setupWithApi(EMPTY);
    expect(getLedProgress).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(180_000);
    expect(getLedProgress).toHaveBeenCalledTimes(1);
  });

  it('refetches once when the tab becomes visible again', async () => {
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
    expect(getLedProgress).toHaveBeenCalledTimes(2);
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
          { provide: TeamProgressDetailApiService, useValue: { getEmployees, getPeriodProgress, getWeeklyCompletion, getTimeProgress } },
          widget.provider
        ]
      })
        .overrideComponent(TeamProgressCardComponent, STUB_DIALOG)
        .compileComponents();
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
      expect(text(fixture, 'team-progress-total')).toBe('200 h Allocated');
      // The shared root store (also read by the action center) holds the same led-progress data.
      expect(store.data()).toEqual(payload);
      expect(store.loading()).toBe(false);
      expect(store.error()).toBeNull();
      expect(store.loadedAt()).toBeInstanceOf(Date);
    });

    it('falls_back_to_own_api_outside_dashboard', async () => {
      const { fixture, getLedProgress } = await setupWithApi(response([module('o1', 'Payments', hours(200, 40, 30, 70))]));
      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(text(fixture, 'team-progress-total')).toBe('200 h Allocated');
    });

    it('falls back to its own api, with its own error state, when the bootstrap state is an error', async () => {
      const { fixture, getLedProgress } = await setupInFrame(fakeWidgetData('error'), 'error');
      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.textContent).toContain("Couldn't load team progress");
    });

    it('reloads through the widget context when the tab becomes visible again and feeds the result into the store', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
      const widget = fakeWidgetData('success', EMPTY);
      const { fixture, getLedProgress, store } = await setupInFrame(widget, EMPTY);

      document.dispatchEvent(new Event('visibilitychange'));
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

      document.dispatchEvent(new Event('visibilitychange'));
      widget.fail();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(getLedProgress).toHaveBeenCalledOnce();
      expect(store.data()).toEqual(next);
    });
  });

  describe('period switch', () => {
    const payload = (): LedWorkProgressResponse => response([module('o1', 'Payments', hours(200, 40, 30, 70))]);

    // The card has no dropdown any more: the period comes from the popup (setPeriod is what its periodChange calls).
    function choose(fixture: ComponentFixture<TeamProgressCardComponent>, value: string): void {
      fixture.componentInstance.setPeriod(value as LedProgressPeriod);
      fixture.detectChanges();
      fixture.detectChanges();
    }

    const has = (fixture: ComponentFixture<TeamProgressCardComponent>, testId: string): boolean =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) !== null;

    it('starts on All time without calling the period endpoint', async () => {
      const fixture = await setup(payload());
      expect(fixture.componentInstance.period()).toBe('all');
      expect(has(fixture, 'team-progress-period')).toBe(false);
      expect(getPeriodProgress).not.toHaveBeenCalled();
    });

    it('fetches the week, hides not yet tasked and takes shares against the hours due', async () => {
      const fixture = await setup(payload());
      choose(fixture, 'week');

      expect(getPeriodProgress).toHaveBeenCalledOnce();
      expect(getPeriodProgress).toHaveBeenCalledWith('week');
      expect(text(fixture, 'team-progress-total')).toBe('20 h Due this week');
      expect(text(fixture, 'team-progress-legend-completed')).toBe('5 h');
      expect(text(fixture, 'team-progress-legend-completed-percent')).toBe('(25%)');
      expect(text(fixture, 'team-progress-legend-not-started-percent')).toBe('(50%)');
      expect(has(fixture, 'team-progress-legend-untasked')).toBe(false);
      expect(text(fixture, 'team-progress-completion')).toBe('25%');
      expect(fixture.nativeElement.querySelectorAll('[data-testid="donut-segment"]').length).toBe(3);
      expect(localStorage.getItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY)).toBe('week');
    });

    it('hides the over-tasked note in a period', async () => {
      const fixture = await setup(response([module('o1', 'Payments', hours(10, 4, 4, 4.5))]));
      expect(has(fixture, 'team-progress-over-tasked')).toBe(true);
      choose(fixture, 'month');
      expect(has(fixture, 'team-progress-over-tasked')).toBe(false);
      expect(text(fixture, 'team-progress-total')).toBe('20 h Due this month');
    });

    it('caches each period per data load: switching back and forth never refetches anything', async () => {
      const { fixture, getLedProgress } = await setupWithApi(payload());
      choose(fixture, 'week');
      choose(fixture, 'all');
      choose(fixture, 'week');
      choose(fixture, 'month');
      choose(fixture, 'week');
      expect(getPeriodProgress).toHaveBeenCalledTimes(2);
      expect(getPeriodProgress.mock.calls.map((c) => c[0])).toEqual(['week', 'month']);
      expect(getLedProgress).toHaveBeenCalledOnce();
    });

    it('a refresh reloads led-progress and the selected period', async () => {
      const { fixture, getLedProgress } = await setupWithApi(payload());
      choose(fixture, 'week');
      getPeriodProgress.mockReturnValue(of(periodPayload('week', { completedHours: 10, totalHours: 40 })));
      (fixture.nativeElement.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      fixture.detectChanges();
      expect(getLedProgress).toHaveBeenCalledTimes(2);
      expect(getPeriodProgress).toHaveBeenCalledTimes(2);
      expect(text(fixture, 'team-progress-total')).toBe('40 h Due this week');
    });

    it('does not refetch the period because of a size change', async () => {
      FakeResizeObserver.instances = [];
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('requestAnimationFrame', undefined);
      const fixture = await setup(payload());
      choose(fixture, 'month');
      for (const [w, h] of [[650, 420], [900, 636], [1300, 852], [320, 420]]) {
        FakeResizeObserver.instances[0].trigger(w, h);
        fixture.detectChanges();
      }
      expect(getPeriodProgress).toHaveBeenCalledOnce();
    });

    it('says when nothing is due in the period', async () => {
      getPeriodProgress = vi.fn(() => of(periodPayload('week', { completedHours: 0, inProgressHours: 0, notStartedHours: 0, totalHours: 0, taskCount: 0 })));
      const fixture = await setup(payload());
      choose(fixture, 'week');
      expect(text(fixture, 'team-progress-period-empty')).toBe('No tasks due this week');
      expect(has(fixture, 'team-progress-donut')).toBe(false);
    });

    it('shows a retry when the period fails to load', async () => {
      getPeriodProgress = vi.fn(() => throwError(() => new Error('fail')));
      const fixture = await setup(payload());
      choose(fixture, 'month');
      expect(text(fixture, 'team-progress-period-error')).toContain("Couldn't load this month");

      getPeriodProgress.mockReturnValue(of(periodPayload('month')));
      (fixture.nativeElement.querySelector('[data-testid="team-progress-period-error"] button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(text(fixture, 'team-progress-total')).toBe('20 h Due this month');
    });

    it('remembers the period per viewer', async () => {
      localStorage.setItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY, 'month');
      const fixture = await setup(payload());
      expect(fixture.componentInstance.period()).toBe('month');
      expect(getPeriodProgress).toHaveBeenCalledWith('month');
    });

    it('ignores an unknown stored value', async () => {
      localStorage.setItem(TEAM_PROGRESS_PERIOD_STORAGE_KEY, 'year');
      const fixture = await setup(payload());
      expect(fixture.componentInstance.period()).toBe('all');
    });

    it('works when storage throws', async () => {
      const throwing = {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); },
        removeItem: () => { throw new Error('blocked'); }
      };
      vi.stubGlobal('localStorage', throwing);
      const fixture = await setup(payload());
      expect(fixture.componentInstance.period()).toBe('all');
      expect(() => choose(fixture, 'week')).not.toThrow();
      expect(fixture.componentInstance.period()).toBe('week');
      expect(text(fixture, 'team-progress-total')).toBe('20 h Due this week');
    });

    it('passes the period to the dialog and follows its periodChange', async () => {
      const fixture = await setup(payload());
      choose(fixture, 'week');
      expect(dialog(fixture).period()).toBe('week');

      dialog(fixture).periodChange.emit('month');
      fixture.detectChanges();
      expect(fixture.componentInstance.period()).toBe('month');
      expect(getPeriodProgress).toHaveBeenLastCalledWith('month');
    });

  });
  describe('planned vs worked time', () => {
    const payload = (): LedWorkProgressResponse => response([module('o1', 'Payments', hours(200, 40, 30, 70))]);
    const weekTime = ledTime({
      period: 'week', plannedMinutes: 600, clockedMinutes: 540, scheduledMinutes: 360, outsideSlotMinutes: 60, noPlanMinutes: 120,
      coveragePercent: 80, peopleWithUnscheduledWork: 2, previous: { plannedMinutes: 400, clockedMinutes: 300, coveragePercent: 74 },
      workload: [workloadRow({ displayName: 'Ada', rank: 1, plannedMinutes: 600, utilizationPercent: 125, expectedMinutes: 480 })]
    });
    const monthTime = ledTime({
      period: 'month', plannedMinutes: 2400, coveragePercent: 50,
      workload: [
        workloadRow({ displayName: 'Bob', rank: 1, plannedMinutes: 2000 }),
        workloadRow({ displayName: 'Ada', rank: 2, plannedMinutes: 400 })
      ]
    });

    async function sized(width: number, height: number, time = (period: 'week' | 'month') => (period === 'week' ? weekTime : monthTime)) {
      FakeResizeObserver.instances = [];
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('requestAnimationFrame', undefined);
      getTimeProgress = vi.fn((period: 'week' | 'month') => of(time(period)));
      const { fixture } = await setupWithApi(payload());
      FakeResizeObserver.instances[0].trigger(width, height);
      fixture.detectChanges();
      return fixture;
    }

    const gridRows = (n: number) => n * 96 + (n - 1) * 12;

    const el = (fixture: ComponentFixture<TeamProgressCardComponent>, testId: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

    function choose(fixture: ComponentFixture<TeamProgressCardComponent>, value: string): void {
      fixture.componentInstance.setPeriod(value as LedProgressPeriod);
      fixture.detectChanges();
      fixture.detectChanges();
    }

    it('loads the week with the card (All time reads the week)', async () => {
      await sized(1300, 1176);
      expect(getTimeProgress).toHaveBeenCalledWith('week');
    });

    it('maximum shows the bucket chart (not the band) with coverage and its change, and the workload with utilization over 100% kept', async () => {
      const fixture = await sized(1300, 1176);

      expect(el(fixture, 'tpt-band')).toBeNull();
      expect(el(fixture, 'tpt-chart')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('app-planned-actual-week-chart')).not.toBeNull();
      expect(el(fixture, 'tpt-coverage')!.textContent!.trim()).toBe('80% covered');
      expect(el(fixture, 'tpt-chart')!.textContent).toContain('↑ 6 pp vs last week');
      expect(el(fixture, 'tpt-util')!.textContent!.trim()).toBe('125%');
      expect(el(fixture, 'tpt-workload')!.getAttribute('title')).toBe('More workload is not better performance.');
    });

    it('Week to Month refetches the time figures and changes the ranking, not just the label', async () => {
      const fixture = await sized(1300, 1176);
      const names = () => [...fixture.nativeElement.querySelectorAll('[data-testid="tpt-workload-row"] .tpt-name')].map((n: Element) => n.textContent);
      expect(names()).toEqual(['Ada']);

      choose(fixture, 'month');

      expect(getTimeProgress).toHaveBeenLastCalledWith('month');
      expect(names()).toEqual(['Bob', 'Ada']);
    });

    it('the all-time allocation figures do not change with the time figures', async () => {
      const fixture = await sized(1300, 1176);
      const allocation = el(fixture, 'team-progress-completion')!.textContent;

      TestBed.inject(MyTeamLedProgressStore).loadTime('month');
      fixture.detectChanges();

      expect(el(fixture, 'team-progress-completion')!.textContent).toBe(allocation);
    });

    it('status tiles carry an icon badge on the right, with hours, label and %', async () => {
      const fixture = await sized(642, 420);
      const tiles = [...fixture.nativeElement.querySelectorAll('[data-testid="team-progress-tiles"] .tp-status-tile')] as HTMLElement[];
      expect(tiles.length).toBeGreaterThan(0);
      for (const tile of tiles) {
        expect(tile.lastElementChild!.classList.contains('tp-status-tile-icon')).toBe(true);
        expect(tile.querySelector('app-icon')).not.toBeNull();
      }
    });

    it('tall view shows bucket chart instead of band', async () => {
      const fixture = await sized(500, gridRows(10));
      expect(el(fixture, 'tpt-chart')).not.toBeNull();
      expect(el(fixture, 'tpt-band')).toBeNull();
    });

    it('a view too short for the chart keeps the band', async () => {
      const fixture = await sized(500, gridRows(9));
      expect(el(fixture, 'tpt-band')).not.toBeNull();
      expect(el(fixture, 'tpt-chart')).toBeNull();
    });

    it('unscheduled panel lists top 3 by unscheduled time, with bars', async () => {
      const fixture = await sized(900, gridRows(5), () =>
        ledTime({
          ...weekTime,
          workload: [
            workloadRow({ displayName: 'Ada', unscheduledMinutes: 30 }),
            workloadRow({ displayName: 'Bob', unscheduledMinutes: 240 }),
            workloadRow({ displayName: 'Cat', unscheduledMinutes: 0 }),
            workloadRow({ displayName: 'Dan', unscheduledMinutes: 120 }),
            workloadRow({ displayName: 'Eve', unscheduledMinutes: 60 }),
          ],
        }),
      );
      const names = [...fixture.nativeElement.querySelectorAll('[data-testid="tpt-unscheduled-row"] .tpt-name')].map(
        (n: Element) => n.textContent!.trim(),
      );
      expect(names).toEqual(['Bob', 'Dan', 'Eve']);
      expect(el(fixture, 'tpt-callout')!.textContent).toContain('3h');
    });

    it('coverage is "—" when nothing is planned', async () => {
      const fixture = await sized(1300, 1176, () => ledTime({ clockedMinutes: 90, noPlanMinutes: 90 }));
      expect(el(fixture, 'tpt-coverage')!.textContent!.trim()).toBe('— covered');
    });

    it('Planner off: the note replaces the band, clocked time still shown', async () => {
      const fixture = await sized(1300, 1176, () => ledTime({ plannerEnabled: false, clockedMinutes: 120 }));

      expect(el(fixture, 'tpt-band')).toBeNull();
      expect(el(fixture, 'tpt-planner-off')!.textContent).toContain('2h clocked');
    });

    it('a failed time load leaves the allocation card working', async () => {
      FakeResizeObserver.instances = [];
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
      vi.stubGlobal('requestAnimationFrame', undefined);
      getTimeProgress = vi.fn(() => throwError(() => new Error('x')));
      const { fixture } = await setupWithApi(payload());
      FakeResizeObserver.instances[0].trigger(1300, 1176);
      fixture.detectChanges();

      expect(el(fixture, 'tpt-error')).not.toBeNull();
      expect(el(fixture, 'team-progress-completion')).not.toBeNull();
    });
  });
});
