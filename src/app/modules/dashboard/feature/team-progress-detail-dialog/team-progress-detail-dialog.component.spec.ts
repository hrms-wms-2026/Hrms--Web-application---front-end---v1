import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ledTime, workloadRow } from '../../utils/team-progress-time.testing';
import { environment } from '../../../../../environments/environment';
import { pickSelectOption } from '../../../../shared/ui/select/select.testing';
import { LedHourTotals, LedModuleProgress, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { LedEmployeeProgressPage, LedPeriodProgress, LedProgressPeriod, LedWeeklyCompletion } from '../../models/team-progress-detail.model';
import { TeamProgressDetailDialogComponent } from './team-progress-detail-dialog.component';

const BASE = `${environment.apiUrl}/work/led-progress`;

const hours = (allocated: number, completed: number, inProgress: number, notStarted: number, extra: Partial<LedHourTotals> = {}): LedHourTotals => {
  const tasked = completed + inProgress + notStarted;
  return {
    allocatedHours: allocated, completedHours: completed, inProgressHours: inProgress, notStartedHours: notStarted,
    untaskedHours: Math.max(0, allocated - tasked), overTaskedHours: Math.max(0, tasked - allocated),
    taskCount: 4, unestimatedTaskCount: 0, ...extra
  };
};

const mod = (objectiveId: string, title: string, h: LedHourTotals, extra: Partial<LedModuleProgress> = {}): LedModuleProgress => ({
  objectiveId, title, isRootModule: false, endDate: '2026-12-01', parentObjectiveId: null, depth: 0, atRisk: false, hours: h, ...extra
});

function summary(extra: Partial<LedWorkProgressResponse> = {}): LedWorkProgressResponse {
  return {
    hours: hours(200, 50, 30, 20, { overTaskedHours: 5, unestimatedTaskCount: 2 }),
    projects: [
      {
        projectId: 'p1', projectName: 'Apollo', identifier: 'APO', hours: hours(120, 40, 20, 10),
        modules: [
          mod('m1', 'Backend', hours(120, 40, 20, 10), { atRisk: true }),
          mod('m1a', 'Payments', hours(40, 10, 10, 0), { depth: 1, parentObjectiveId: 'm1' })
        ]
      },
      {
        projectId: 'p2', projectName: 'Zeus', identifier: 'ZEU', hours: hours(80, 10, 10, 10),
        modules: [mod('m2', 'Frontend', hours(80, 10, 10, 10))]
      }
    ],
    overdueTasks: [
      { taskId: 't1', shortId: 'APO-1', title: 'Fix login', projectId: 'p1', objectiveId: 'm1a', dueDate: '2026-01-10', daysOverdue: 3, assignees: [{ employeeId: 'e1', displayName: 'Ann Lee' }] },
      { taskId: 't2', shortId: 'ZEU-7', title: 'Polish header', projectId: 'p2', objectiveId: 'm2', dueDate: '2026-01-12', daysOverdue: 1, assignees: [] }
    ],
    overdueTotal: 9,
    modulesAtRisk: 1,
    ...extra
  };
}

function employeePage(extra: Partial<LedEmployeeProgressPage> = {}): LedEmployeeProgressPage {
  return {
    items: [
      { employeeId: 'e1', displayName: 'Ann Lee', completedHours: 10, inProgressHours: 5, notStartedHours: 9, totalHours: 24, taskCount: 4, sharedTaskCount: 3, sharedHours: 24 },
      { employeeId: 'e2', displayName: 'Bo Chen', completedHours: 2, inProgressHours: 0, notStartedHours: 0, totalHours: 2, taskCount: 1, sharedTaskCount: 0, sharedHours: 0 }
    ],
    pageNumber: 1, pageSize: 5, totalCount: 45, totalPages: 9, hasNext: true, hasPrevious: false,
    unassigned: { completedHours: 1, inProgressHours: 2, notStartedHours: 3, totalHours: 6, taskCount: 2 },
    ...extra
  };
}

function periodSummary(period: 'week' | 'month', extra: Partial<LedPeriodProgress> = {}): LedPeriodProgress {
  return {
    period, from: '2026-01-05', to: '2026-01-11',
    completedHours: 6, inProgressHours: 4, notStartedHours: 10, totalHours: 20,
    taskCount: 7, completedTaskCount: 2, inProgressTaskCount: 1, notStartedTaskCount: 3, unestimatedTaskCount: 1,
    ...extra
  };
}

/** Ten fixed ISO weeks (no dependency on today's date). */
function weekly(extra: Partial<LedWeeklyCompletion> = {}): LedWeeklyCompletion {
  const weeks = Array.from({ length: 10 }, (_, i) => {
    const day = String(5 + i * 7 - (i >= 4 ? 28 : 0)).padStart(2, '0');
    const month = i >= 4 ? '02' : '01';
    return { weekStart: `2026-${month}-${day}`, weekEnd: `2026-${month}-${day}`, completedHours: i * 2, completedTaskCount: i };
  });
  return { weeks, allocatedHours: 200, undatedCompletedHours: 0, undatedCompletedTaskCount: 0, ...extra };
}

describe('TeamProgressDetailDialogComponent', () => {
  let fixture: ComponentFixture<TeamProgressDetailDialogComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.fn>;
  let closedCount: number;
  let periodChanges: LedProgressPeriod[];

  beforeEach(async () => {
    navigate = vi.fn(() => Promise.resolve(true));
    await TestBed.configureTestingModule({
      imports: [TeamProgressDetailDialogComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { navigate } }]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamProgressDetailDialogComponent);
    closedCount = 0;
    periodChanges = [];
    fixture.componentInstance.closed.subscribe(() => closedCount++);
    fixture.componentInstance.periodChange.subscribe((p) => periodChanges.push(p));
  });

  afterEach(() => {
    // The planned-vs-worked call is covered by its own tests below; the older tests answer it here.
    http.match(isTime).forEach((r) => {
      if (!r.cancelled) r.flush(ledTime());
    });
    http.verify();
    vi.useRealTimers();
    TestBed.resetTestingModule();
    document.querySelectorAll('.cdk-overlay-container').forEach((el) => el.replaceChildren());
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (testId: string): HTMLElement | null => el().querySelector(`[data-testid="${testId}"]`);
  const render = (): void => {
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };

  const isEmployees = (r: { url: string }): boolean => r.url === `${BASE}/employees`;
  const isWeekly = (r: { url: string }): boolean => r.url === `${BASE}/weekly-completion`;
  const isPeriod = (r: { url: string }): boolean => r.url === `${BASE}/period`;
  const isTime = (r: { url: string }): boolean => r.url === `${BASE}/time`;
  const expectEmployees = (): TestRequest => http.expectOne(isEmployees);
  const expectWeekly = (): TestRequest => http.expectOne(isWeekly);
  const expectPeriod = (): TestRequest => http.expectOne(isPeriod);

  /** Opens the dialog and answers its Employee Breakdown and weekly chart requests (when there's a summary). */
  function openWith(data: LedWorkProgressResponse | null = summary(), period: LedProgressPeriod = 'all', week: LedWeeklyCompletion = weekly()): void {
    fixture.componentRef.setInput('summary', data);
    fixture.componentRef.setInput('period', period);
    fixture.componentRef.setInput('open', true);
    render();
    if (data) {
      expectEmployees().flush(employeePage());
      expectWeekly().flush(week);
      render();
    }
  }

  const retryIn = (container: HTMLElement | null): HTMLButtonElement | undefined =>
    Array.from(container?.querySelectorAll<HTMLButtonElement>('[role="alert"] button') ?? []).find((b) => b.textContent?.trim() === 'Retry');

  it('renders nothing and fetches nothing while closed', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('period', 'week');
    fixture.componentRef.setInput('open', false);
    render();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
    http.expectNone((r) => !isTime(r));
  });

  it('is Overview only: no tabs, no project/module status panel, no task list', () => {
    openWith();
    expect(el().querySelector('[role="tablist"]')).toBeNull();
    expect(el().querySelector('[role="tab"]')).toBeNull();
    expect(el().querySelector('[role="tabpanel"]')).toBeNull();
    expect(q('tp-breakdown')).toBeNull();
    expect(el().textContent).not.toContain('By Employee');
    expect(el().textContent).not.toContain('Task List');
    expect(el().textContent).not.toContain('Status by Project');
  });

  it('renders the overview from the summary: tiles, donut, notes, three panels and overdue tasks', () => {
    openWith();
    expect(el().querySelector('[role="dialog"]')).not.toBeNull();
    expect(el().textContent).toContain('Team Progress');
    expect(q('tp-tile-allocated')?.textContent).toContain('200');
    expect(q('tp-tile-completed')?.textContent).toContain('50');
    expect(q('tp-tile-completed')?.textContent).toContain('25%');
    expect(q('tp-tile-untasked')?.textContent).toContain('100');
    expect(q('tp-completion')?.textContent?.trim()).toBe('25%');
    expect(q('tp-donut')?.getAttribute('role')).toBe('img');
    expect(q('tp-donut')?.getAttribute('aria-label')).toContain('Completed 50 h');
    expect(q('tp-note-overtasked')?.textContent).toContain('5 h');
    expect(q('tp-note-unestimated')?.textContent).toContain('2 tasks');
    expect(q('tp-note-risk')?.textContent).toContain('1');
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Total allocated');
    // Panel order: Status Distribution | Weekly completion | Employee Breakdown.
    const panels = Array.from(el().querySelectorAll('.tp-panels > section')).map((s) => s.getAttribute('data-testid'));
    expect(panels).toEqual(['tp-distribution', 'tp-weekly', 'tp-ov-employees']);
    expect(q('tp-weekly')?.textContent).toContain('Weekly completion');
    expect(q('tp-weekly-range')?.textContent?.trim()).toBe('Last 10 weeks');
    expect(q('tp-weekly')?.textContent).toContain('Allocated task hours completed per week');
    expect(q('tp-weekly-chart')?.querySelectorAll('[data-testid="weekly-completion-bar"]').length).toBe(10);
    expect(q('tp-weekly-undated')).toBeNull();
    expect(q('tp-ov-employee-e1')?.textContent).toContain('AL');
    expect(q('tp-ov-employee-e1')?.textContent).toContain('24 h');
    expect(q('tp-ov-employee-range')?.textContent?.trim()).toBe('1–2 of 45');
    expect(q('tp-overdue-count')?.textContent).toContain('2 of 9');
    expect(q('tp-overdue-t1')?.textContent).toContain('10 Jan 2026');
    http.expectNone((r) => !isTime(r));
  });

  it('hides the overdue section when nothing is overdue', () => {
    openWith(summary({ overdueTasks: [], overdueTotal: 0 }));
    expect(q('tp-overdue')).toBeNull();
    expect(el().textContent).not.toContain('Overdue tasks');
  });

  it('fetches the weekly chart once on open (10 weeks, no filters), shows a skeleton until it loads', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    expectEmployees().flush(employeePage());
    const req = expectWeekly();
    expect(req.request.params.get('weeks')).toBe('10');
    expect(req.request.params.has('projectId')).toBe(false);
    expect(req.request.params.has('objectiveId')).toBe(false);
    expect(req.request.params.has('period')).toBe(false);
    render();
    expect(q('tp-weekly-loading')).not.toBeNull();
    req.flush(weekly());
    render();
    expect(q('tp-weekly-loading')).toBeNull();
    expect(q('tp-weekly-chart')).not.toBeNull();
    // Re-rendering, closing and reopening are served from the cache.
    render();
    fixture.componentRef.setInput('open', false);
    render();
    fixture.componentRef.setInput('open', true);
    render();
    http.expectNone(isWeekly);
  });

  it('narrows the weekly chart by the project / module filters, caches each, and ignores the period', () => {
    openWith();
    fixture.componentInstance.setProject('p2');
    render();
    let req = expectWeekly();
    expect(req.request.params.get('projectId')).toBe('p2');
    expect(req.request.params.get('weeks')).toBe('10');
    req.flush(weekly({ allocatedHours: 80 }));
    expectEmployees().flush(employeePage());
    render();

    fixture.componentInstance.setProject('p1');
    fixture.componentInstance.setModule('m1a');
    render();
    req = expectWeekly();
    expect(req.request.params.get('projectId')).toBe('p1');
    expect(req.request.params.get('objectiveId')).toBe('m1a');
    req.flush(weekly());
    expectEmployees().flush(employeePage());

    // Back to no filters: cached.
    fixture.componentInstance.clearFilters();
    render();
    http.expectNone(isWeekly);
    expectEmployees().flush(employeePage());

    // The period dropdown never refetches the weekly chart.
    fixture.componentRef.setInput('period', 'month');
    render();
    http.expectNone(isWeekly);
    expectPeriod().flush(periodSummary('month'));
    expectEmployees().flush(employeePage());
  });

  it('drops the weekly cache when the card passes a new summary', () => {
    openWith();
    fixture.componentRef.setInput('summary', summary());
    render();
    expectWeekly().flush(weekly());
    http.expectNone(isEmployees);
  });

  it('cancels an in-flight weekly request when the filters change', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    expectEmployees().flush(employeePage());
    const first = expectWeekly();
    fixture.componentInstance.setProject('p1');
    render();
    const second = expectWeekly();
    expect(first.cancelled).toBe(true);
    expect(second.request.params.get('projectId')).toBe('p1');
    second.flush(weekly());
    expectEmployees().flush(employeePage());
  });

  it('shows an error with Retry when the weekly chart fails', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    expectEmployees().flush(employeePage());
    expectWeekly().flush('boom', { status: 500, statusText: 'Server Error' });
    render();
    expect(q('tp-weekly-error')).not.toBeNull();
    const retry = retryIn(q('tp-weekly'));
    expect(retry).toBeTruthy();
    retry!.click();
    render();
    expectWeekly().flush(weekly());
    render();
    expect(q('tp-weekly-error')).toBeNull();
    expect(q('tp-weekly-chart')).not.toBeNull();
  });

  it('notes completed hours that have no completion date under the weekly chart', () => {
    openWith(summary(), 'all', weekly({ undatedCompletedHours: 12.5, undatedCompletedTaskCount: 3 }));
    expect(q('tp-weekly-undated')?.textContent).toContain('12.5 h');
    expect(q('tp-weekly-undated')?.textContent).toContain('3 tasks');
  });

  it('asks the Employee Breakdown for the top 5 by total hours, without a period for All time', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    const req = expectEmployees();
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('5');
    expect(req.request.params.get('sort')).toBe('totalHours');
    expect(req.request.params.get('direction')).toBe('desc');
    expect(req.request.params.has('period')).toBe(false);
    req.flush(employeePage());
    expectWeekly().flush(weekly());
    http.expectNone(isPeriod);
  });

  it('pages and searches the Employee Breakdown; rows are not clickable', () => {
    vi.useFakeTimers();
    openWith();
    q('tp-ov-employee-next')!.click();
    render();
    let req = expectEmployees();
    expect(req.request.params.get('pageNumber')).toBe('2');
    req.flush(employeePage({ pageNumber: 2, hasPrevious: true }));
    render();
    expect(q('tp-ov-employee-range')?.textContent?.trim()).toBe('6–7 of 45');

    const input = q('tp-ov-employee-search') as HTMLInputElement;
    input.value = 'bo';
    input.dispatchEvent(new Event('input'));
    render();
    http.expectNone((r) => !isTime(r));
    vi.advanceTimersByTime(300);
    render();
    req = expectEmployees();
    expect(req.request.params.get('search')).toBe('bo');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage());
    render();

    expect(q('tp-ov-employee-e2')?.querySelector('button')).toBeNull();
    q('tp-ov-employee-e2')!.click();
    render();
    http.expectNone((r) => !isTime(r));
    expect(closedCount).toBe(0);
  });

  it('shows an error with Retry when the Employee Breakdown fails', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    expectEmployees().flush('boom', { status: 500, statusText: 'Server Error' });
    expectWeekly().flush(weekly());
    render();
    retryIn(q('tp-ov-employees'))!.click();
    render();
    expectEmployees().flush(employeePage());
    render();
    expect(q('tp-ov-employee-e1')).not.toBeNull();
  });

  it('emits periodChange from the period dropdown and leaves the value to the card', () => {
    openWith();
    pickSelectOption(q('tp-period-filter')!, 'This week', () => render());
    expect(periodChanges).toEqual(['week']);
    http.expectNone((r) => !isTime(r));
    expect(q('tp-tile-untasked')).not.toBeNull();
  });

  it('shows the period summary for This week: no Not yet tasked, totals due this week, task counts', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('period', 'week');
    fixture.componentRef.setInput('open', true);
    render();
    expect(q('tp-period-loading')).not.toBeNull();
    const req = expectPeriod();
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.has('projectId')).toBe(false);
    req.flush(periodSummary('week'));
    const emp = expectEmployees();
    expect(emp.request.params.get('period')).toBe('week');
    emp.flush(employeePage());
    expectWeekly().flush(weekly());
    render();

    expect(q('tp-tile-untasked')).toBeNull();
    expect(q('tp-tile-completed')?.textContent).toContain('6');
    expect(q('tp-tile-completed')?.textContent).toContain('30%');
    expect(q('tp-tile-count-notStarted')?.textContent).toContain('3 tasks');
    expect(q('tp-tile-allocated')?.textContent).toContain('20');
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this week');
    expect(q('tp-completion')?.textContent?.trim()).toBe('30%');
    expect(q('tp-note-overtasked')).toBeNull();
    expect(q('tp-note-unestimated')?.textContent).toContain('1 task has');
    expect(q('tp-donut')?.getAttribute('aria-label')).toContain('due this week');
    // The weekly chart is its own 10-week timeline, still shown.
    expect(q('tp-weekly-chart')).not.toBeNull();
  });

  it('caches each period summary, narrows it by the filters, and resets employee paging on a period change', () => {
    openWith();
    q('tp-ov-employee-next')!.click();
    render();
    expectEmployees().flush(employeePage({ pageNumber: 2, hasPrevious: true }));

    fixture.componentRef.setInput('period', 'week');
    render();
    expectPeriod().flush(periodSummary('week'));
    let emp = expectEmployees();
    expect(emp.request.params.get('pageNumber')).toBe('1');
    expect(emp.request.params.get('period')).toBe('week');
    emp.flush(employeePage());

    fixture.componentRef.setInput('period', 'month');
    render();
    expectPeriod().flush(periodSummary('month', { totalHours: 40 }));
    expectEmployees().flush(employeePage());
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this month');

    // Back to week: served from the cache.
    fixture.componentRef.setInput('period', 'week');
    render();
    http.expectNone(isPeriod);
    expectEmployees().flush(employeePage());
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this week');

    fixture.componentInstance.setProject('p2');
    render();
    const narrowed = expectPeriod();
    expect(narrowed.request.params.get('projectId')).toBe('p2');
    narrowed.flush(periodSummary('week'));
    emp = expectEmployees();
    expect(emp.request.params.get('projectId')).toBe('p2');
    emp.flush(employeePage());
    expectWeekly().flush(weekly());
  });

  it('shows an error with Retry when the period summary fails', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('period', 'month');
    fixture.componentRef.setInput('open', true);
    render();
    expectPeriod().flush('boom', { status: 500, statusText: 'Server Error' });
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
    render();
    const retry = Array.from(el().querySelectorAll<HTMLButtonElement>('[role="alert"] button')).find((b) => b.textContent?.trim() === 'Retry');
    expect(retry).toBeTruthy();
    retry!.click();
    render();
    expectPeriod().flush(periodSummary('month'));
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this month');
  });

  it('shows a safe empty state when the summary is null', () => {
    openWith(null);
    expect(el().textContent).toContain('No team progress yet');
    expect(q('team-progress-detail')).toBeNull();
    http.expectNone((r) => !isTime(r));
  });

  it('filters the overview client-side by project and module', () => {
    openWith();
    pickSelectOption(q('tp-project-filter')!, 'Zeus', () => render());
    expect(q('tp-tile-allocated')?.textContent).toContain('80');
    expect(q('tp-overdue-t2')).not.toBeNull();
    expect(q('tp-overdue-t1')).toBeNull();
    expect(q('tp-overdue-count')?.textContent).toContain('1 of the 2 listed match the filter');
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
    render();

    fixture.componentInstance.setProject('p1');
    fixture.componentInstance.setModule('m1a');
    render();
    expect(q('tp-tile-allocated')?.textContent).toContain('40');
    expect(q('tp-overdue-t1')).not.toBeNull();
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
    http.expectNone((r) => !isTime(r));
  });

  it('closes on Escape (from app-modal) and on the close button', () => {
    openWith();
    el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closedCount).toBe(1);
    q('tp-close')!.click();
    expect(closedCount).toBe(2);
  });

  it('overdue task link navigates to the board and closes', () => {
    openWith();
    q('tp-overdue-t2')!.click();
    expect(closedCount).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/work', 'p2', 'milestones', 'm2', 'board'], { queryParams: { highlightTaskId: 't2' } });
  });

  describe('planned vs worked sections', () => {
    it('loads the week for All time and draws planned vs worked, unscheduled work and the workload ranking', () => {
      openWith(summary(), 'all');
      const req = http.expectOne(isTime);
      expect(req.request.params.get('period')).toBe('week');
      req.flush(ledTime({
        plannedMinutes: 600, clockedMinutes: 540, scheduledMinutes: 360, outsideSlotMinutes: 60, noPlanMinutes: 120, coveragePercent: 80,
        buckets: [{ from: '2026-10-26', to: '2026-10-26', plannedMinutes: 120, scheduledMinutes: 60, unscheduledMinutes: 30 }],
        workload: [workloadRow({ displayName: 'Ada', plannedMinutes: 600, utilizationPercent: 125, expectedMinutes: 480 })],
        unscheduled: [{ employeeId: 'e1', displayName: 'Ada', taskId: 't1', shortId: 'T-1', title: 'Fix bug', start: '2026-10-26T09:00:00Z', end: '2026-10-26T10:30:00Z', minutes: 90, kind: 'no_plan' }],
        unscheduledTotal: 1
      }));
      render();

      expect(q('tptd-coverage')!.textContent).toContain('80%');
      expect(q('tptd-unscheduled')!.textContent).toContain('Worked without a matching Planner slot.');
      expect(el().querySelectorAll('[data-testid="tptd-unscheduled-row"]').length).toBe(1);
      expect(q('tptd-util')!.textContent!.trim()).toBe('125%');
    });

    it('the period select drives the time call too', () => {
      openWith(summary(), 'week');
      http.match(isPeriod).forEach((r) => r.flush({}));
      http.expectOne(isTime).flush(ledTime());
      fixture.componentRef.setInput('period', 'month');
      render();
      http.match(isEmployees).forEach((r) => r.flush(employeePage()));
      http.match(isPeriod).forEach((r) => r.flush({}));

      expect(http.expectOne(isTime).request.params.get('period')).toBe('month');
    });

    it('coverage is "—" without a plan, and Planner off hides the plan sections', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush(ledTime({ plannerEnabled: false, clockedMinutes: 120 }));
      render();

      expect(q('tptd-planner-off')!.textContent).toContain('2h clocked');
      expect(q('tptd-unscheduled')).toBeNull();
      expect(q('tptd-coverage')).toBeNull();
    });

    it('shows a retry on failure', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush('boom', { status: 500, statusText: 'Server Error' });
      render();

      expect(q('tptd-error')).not.toBeNull();
      (q('tptd-error')!.querySelector('button') as HTMLButtonElement).click();
      render();
      expect(http.expectOne(isTime).request.params.get('period')).toBe('week');
    });
  });
});
