import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ledTime, workloadRow } from '../../utils/team-progress-time.testing';
import { environment } from '../../../../../environments/environment';
import { pickSelectOption } from '../../../../shared/ui/select/select.testing';
import { LedHourTotals, LedModuleProgress, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import {
  LedEmployeeProgressPage,
  LedPeriodProgress,
  LedProgressPeriod,
  LedUnscheduledPage,
  LedUnscheduledRow,
  LedWeeklyCompletion
} from '../../models/team-progress-detail.model';
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
      { taskId: 't1', shortId: 'APO-1', title: 'Fix login', projectId: 'p1', objectiveId: 'm1a', dueDate: '2026-01-10', daysOverdue: 3, estimatedHours: 6, assignees: [{ employeeId: 'e1', displayName: 'Ann Lee' }] },
      { taskId: 't2', shortId: 'ZEU-7', title: 'Polish header', projectId: 'p2', objectiveId: 'm2', dueDate: '2026-01-12', daysOverdue: 1, estimatedHours: null, assignees: [] }
    ],
    overdueTotal: 9,
    modulesAtRisk: 1, overdueHours: 26, overdueUnestimatedTaskCount: 1,
    overdueByProject: [
      { projectId: 'p1', projectName: 'Apollo', hours: 20, taskCount: 6, unestimatedTaskCount: 0 },
      { projectId: 'p2', projectName: 'Zeus', hours: 6, taskCount: 3, unestimatedTaskCount: 1 }
    ],
    overdueByModule: [
      { projectId: 'p1', objectiveId: 'm1', inProgressHours: 12, notStartedHours: 8, taskCount: 6 },
      { projectId: 'p2', objectiveId: 'm2', inProgressHours: 0, notStartedHours: 6, taskCount: 3 }
    ],
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

const UN_ROW: LedUnscheduledRow = {
  employeeId: 'e1', displayName: 'Ada', taskId: 't1', shortId: 'T-1', title: 'Fix bug',
  start: '2026-10-26T09:00:00Z', end: '2026-10-26T10:30:00Z', minutes: 90, kind: 'no_plan'
};

function unscheduledPage(extra: Partial<LedUnscheduledPage> = {}): LedUnscheduledPage {
  return {
    items: [UN_ROW],
    pageNumber: 1, pageSize: 4, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false,
    period: 'week', from: '2026-10-26', to: '2026-11-01', plannerEnabled: true, kind: 'all',
    all: { count: 1, minutes: 90 }, noPlan: { count: 1, minutes: 90 }, outsideSlot: { count: 0, minutes: 0 },
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
    http.match(isUnscheduled).forEach((r) => {
      if (!r.cancelled) r.flush(unscheduledPage());
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
  const isUnscheduled = (r: { url: string }): boolean => r.url === `${BASE}/time/unscheduled`;
  /** The time and unscheduled-work calls: answered by their own tests, or in afterEach. */
  const isSide = (r: { url: string }): boolean => isTime(r) || isUnscheduled(r);
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
    http.expectNone((r) => !isSide(r));
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
    expect(panels).toEqual(['tp-distribution', 'tp-weekly', 'tp-projects', 'tp-ov-employees']);
    expect(q('tp-weekly')?.textContent).toContain('Weekly completion');
    expect(q('tp-weekly-range')?.textContent?.trim()).toBe('Last 10 weeks');
    expect(q('tp-weekly')?.textContent).toContain('Allocated task hours completed per week');
    expect(q('tp-weekly-chart')?.querySelectorAll('[data-testid="weekly-completion-bar"]').length).toBe(10);
    expect(q('tp-weekly-undated')).toBeNull();
    expect(q('tp-member-bar-e1')?.textContent).toContain('AL');
    expect(q('tp-member-bar-e1')?.textContent).toContain('24 h');
    expect(q('tp-ov-employee-range')?.textContent?.trim()).toBe('1–2 of 45');
    expect(q('tp-overdue-count')?.textContent).toContain('2 of 9');
    expect(q('tp-overdue-t1')?.closest('tr')?.textContent).toContain('10 Jan 2026');
    http.expectNone((r) => !isSide(r));
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
    http.expectNone((r) => !isSide(r));
    vi.advanceTimersByTime(300);
    render();
    req = expectEmployees();
    expect(req.request.params.get('search')).toBe('bo');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage());
    render();

    expect(q('tp-member-bar-e2')?.querySelector('button')).toBeNull();
    q('tp-member-bar-e2')!.click();
    render();
    http.expectNone((r) => !isSide(r));
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
    expect(q('tp-member-bar-e1')).not.toBeNull();
  });

  it('emits periodChange from the period dropdown and leaves the value to the card', () => {
    openWith();
    pickSelectOption(q('tp-period-filter')!, 'This week', () => render());
    expect(periodChanges).toEqual(['week']);
    http.expectNone((r) => !isSide(r));
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
    http.expectNone((r) => !isSide(r));
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
    http.expectNone((r) => !isSide(r));
  });

  it('project breakdown is a bar chart of allocated vs completed hours, most allocated first, on one scale', () => {
    openWith();

    const rows = [...el().querySelectorAll<HTMLElement>('[data-testid="tp-project-row"]')];
    expect(rows.map((r) => r.querySelector('.tp-project-name')!.textContent!.trim())).toEqual(['Apollo', 'Zeus']);
    expect(rows.map((r) => r.querySelector('.tp-project-figures')!.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      '40 h / 120 h · 33%',
      '10 h / 80 h · 13%',
    ]);
    const width = (r: HTMLElement, id: string) => (r.querySelector(`[data-testid="${id}"]`) as HTMLElement).style.width;
    // The largest allocation (120 h) is the full track.
    expect(width(rows[0], 'tp-project-allocated')).toBe('100%');
    expect(width(rows[0], 'tp-project-completed')).toBe('33.3%');
    expect(width(rows[1], 'tp-project-allocated')).toBe('66.7%');
    expect(width(rows[1], 'tp-project-completed')).toBe('8.3%');
    expect(q('tp-projects')!.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('Apollo: 40 h completed of 120 h allocated');
  });

  it('the project breakdown follows the project filter', () => {
    openWith();
    fixture.componentInstance.setProject('p2');
    render();
    expect([...el().querySelectorAll('[data-testid="tp-project-row"]')].length).toBe(1);
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
  });

  it('overdue: total overdue hours on top, a pie by project, and a table with each task allocated hours', () => {
    openWith();

    expect(q('tp-overdue-hours')!.textContent!.replace(/\s+/g, ' ')).toContain('26 h overdue');
    expect(q('tp-overdue-hours')!.textContent).toContain('1 task without an estimate');
    const slices = [...el().querySelectorAll('[data-testid="tp-overdue-slice"]')].map((r) =>
      [...r.children].map((c) => c.textContent!.trim()).filter((t) => t !== '').join(' '),
    );
    expect(slices).toEqual(['Apollo 20 h 77%', 'Zeus 6 h 23%']);
    expect(q('tp-overdue-pie')).not.toBeNull();
    const row = (id: string) => q(id)!.closest('tr')!.textContent!.replace(/\s+/g, ' ');
    expect(row('tp-overdue-t1')).toContain('6 h');
    expect(q('tp-overdue-t2')!.closest('tr')!.querySelector('[data-testid="tp-overdue-task-hours"]')!.textContent!.trim()).toBe('—');
  });

  it('an Overdue KPI tile sits in the tile row with the overdue hours and task count', () => {
    openWith();
    const tile = q('tp-tile-overdue')!;
    expect(tile.parentElement!.getAttribute('data-testid')).toBe('tp-overview-tiles');
    expect(tile.textContent!.replace(/\s+/g, ' ')).toContain('26 h');
    expect(q('tp-tile-count-overdue')!.textContent).toContain('9 tasks');
  });

  /** The Status Distribution legend rows as [label, hours, percent]. */
  const legendRows = () =>
    [...el().querySelectorAll('[data-testid="tp-legend-row"]')].map((r) =>
      [...r.children].map((c) => c.textContent!.trim()).filter((t) => t !== ''),
    );

  it('status distribution: overdue is its own slice, carved out of In progress / Not started so it still adds up', () => {
    openWith();
    expect(legendRows()).toEqual([
      ['Completed', '50 h', '(25%)'],
      ['In progress', '18 h', '(9%)'],
      ['Overdue', '26 h', '(13%)'],
      ['Not started', '6 h', '(3%)'],
      ['Not yet tasked', '100 h', '(50%)'],
    ]);
    const slices = [...q('tp-donut')!.querySelectorAll('circle[stroke-dasharray]')];
    expect(slices.map((c) => c.getAttribute('stroke'))).toContain('#ef4444');
    expect(q('tp-donut-overdue')).toBeNull();
    expect(q('tp-donut')!.getAttribute('aria-label')).toContain('Overdue 26 h (13%)');
    expect(q('tp-legend-note')!.textContent).toContain('without the overdue');
  });

  it('the overdue slice follows the project filter', () => {
    openWith();
    fixture.componentInstance.setProject('p2');
    render();
    expect(legendRows()).toContainEqual(['Overdue', '6 h', '(7.5%)']);
    expect(legendRows()).toContainEqual(['Not started', '4 h', '(5%)']);
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
  });

  it('no overdue slice when nothing is overdue', () => {
    openWith(summary({ overdueTasks: [], overdueTotal: 0, overdueByProject: [], overdueByModule: [] }));
    expect(legendRows().map((r) => r[0])).not.toContain('Overdue');
    expect(q('tp-legend-note')).toBeNull();
  });

  it('the Overdue tile shows 0 h when nothing is overdue', () => {
    openWith(summary({ overdueTasks: [], overdueTotal: 0, overdueByProject: [], overdueByModule: [] }));
    expect(q('tp-tile-overdue')!.textContent!.replace(/\s+/g, ' ')).toContain('0 h');
    expect(q('tp-tile-count-overdue')!.textContent).toContain('0 tasks');
  });

  it('the overdue total and pie follow the project filter', () => {
    openWith();
    fixture.componentInstance.setProject('p2');
    render();
    expect(q('tp-tile-count-overdue')!.textContent).toContain('3 tasks');
    expect(q('tp-overdue-hours')!.textContent).toContain('6 h overdue');
    expect(el().querySelectorAll('[data-testid="tp-overdue-slice"]').length).toBe(1);
    expectEmployees().flush(employeePage());
    expectWeekly().flush(weekly());
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
    it('no Planned vs worked panel; Unscheduled work loads its first page from the server for the week', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush(ledTime());
      const req = http.expectOne(isUnscheduled);
      expect(req.request.params.get('period')).toBe('week');
      expect(req.request.params.get('kind')).toBe('all');
      expect(req.request.params.get('pageNumber')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('4');
      req.flush(unscheduledPage());
      render();

      expect(q('tptd-planned')).toBeNull();
      expect(el().textContent).not.toContain('Planned vs worked');
      expect(q('tptd-unscheduled')!.textContent).toContain('Unscheduled work');
      expect(q('tptd-unscheduled')!.textContent).toContain('Worked without a matching Planner slot.');
      expect(el().querySelectorAll('[data-testid="tptd-unscheduled-row"]').length).toBe(1);
      expect(q('tptd-unscheduled')!.querySelector('table')).toBeNull();
      expect(q('tptd-pager')).toBeNull();
    });

    it('a tab asks the server for that kind from page 1; the tab counts come from the response', () => {
      openWith(summary(), 'all');
      http.expectOne(isUnscheduled).flush(unscheduledPage({
        totalCount: 64, totalPages: 16, hasNext: true,
        all: { count: 64, minutes: 2960 }, noPlan: { count: 3, minutes: 1202 }, outsideSlot: { count: 61, minutes: 1758 }
      }));
      render();
      expect(q('tptd-tab-outside_slot')!.textContent).toContain('61');
      expect(q('tptd-tab-all')!.getAttribute('aria-selected')).toBe('true');

      q('tptd-tab-no_plan')!.click();
      render();
      const req = http.expectOne(isUnscheduled);
      expect(req.request.params.get('kind')).toBe('no_plan');
      expect(req.request.params.get('pageNumber')).toBe('1');
      req.flush(unscheduledPage({ kind: 'no_plan' }));
      render();
      expect(q('tptd-tab-no_plan')!.getAttribute('aria-selected')).toBe('true');
    });

    it('pages on the server with Next / Previous and keeps the cards while the next page loads', () => {
      openWith(summary(), 'all');
      http.expectOne(isUnscheduled).flush(unscheduledPage({
        totalCount: 9, totalPages: 3, hasNext: true,
        items: [0, 1, 2, 3].map((i) => ({ ...UN_ROW, taskId: 't' + i }))
      }));
      render();
      expect(q('tptd-range')!.textContent!.trim()).toBe('1–4 of 9');
      expect(q('tptd-page')!.textContent!.trim()).toBe('1 / 3');
      expect((q('tptd-prev') as HTMLButtonElement).disabled).toBe(true);

      q('tptd-next')!.click();
      render();
      const req = http.expectOne(isUnscheduled);
      expect(req.request.params.get('pageNumber')).toBe('2');
      expect(el().querySelectorAll('[data-testid="tptd-unscheduled-row"]').length).toBe(4);
      expect((q('tptd-next') as HTMLButtonElement).disabled).toBe(true);
      req.flush(unscheduledPage({ pageNumber: 2, totalCount: 9, totalPages: 3, hasNext: true, hasPrevious: true }));
      render();
      expect(q('tptd-range')!.textContent!.trim()).toBe('5–5 of 9');
      expect((q('tptd-prev') as HTMLButtonElement).disabled).toBe(false);
    });

    it('a period change goes back to page 1', () => {
      openWith(summary(), 'week');
      http.match(isPeriod).forEach((r) => r.flush({}));
      http.expectOne(isUnscheduled).flush(unscheduledPage({ totalCount: 9, totalPages: 3, hasNext: true }));
      render();
      q('tptd-next')!.click();
      render();
      http.expectOne(isUnscheduled).flush(unscheduledPage({ pageNumber: 2, totalCount: 9, totalPages: 3, hasNext: true, hasPrevious: true }));
      fixture.componentRef.setInput('period', 'month');
      render();
      http.match(isEmployees).forEach((r) => r.flush(employeePage()));
      http.match(isPeriod).forEach((r) => r.flush({}));

      const req = http.expectOne(isUnscheduled);
      expect(req.request.params.get('period')).toBe('month');
      expect(req.request.params.get('pageNumber')).toBe('1');
    });

    it('Export CSV walks every server page', () => {
      openWith(summary(), 'all');
      http.expectOne(isUnscheduled).flush(unscheduledPage({ totalCount: 2 }));
      render();
      const download = vi.fn();
      fixture.componentInstance.downloadFile = download;

      q('tptd-unscheduled-export')!.click();
      const first = http.expectOne(isUnscheduled);
      expect(first.request.params.get('pageSize')).toBe('100');
      expect(first.request.params.get('kind')).toBe('all');
      first.flush(unscheduledPage({ hasNext: true, totalPages: 2 }));
      const second = http.expectOne(isUnscheduled);
      expect(second.request.params.get('pageNumber')).toBe('2');
      second.flush(unscheduledPage({ pageNumber: 2, items: [{ ...UN_ROW, taskId: 't9', shortId: 'T-9', kind: 'outside_slot' }] }));

      expect(download).toHaveBeenCalledOnce();
      const [name, csv] = download.mock.calls[0] as [string, string];
      expect(name).toBe('team-unscheduled-work-2026-10-26_2026-11-01.csv');
      expect(csv).toContain('T-1');
      expect(csv).toContain('T-9');
    });

    it('Team members shows a horizontal bar chart by default and switches to the table', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush(ledTime());
      render();

      expect(q('tp-members-chart')).not.toBeNull();
      expect(q('tp-member-bar-e1')!.getAttribute('aria-label')).toContain('10 h completed');
      expect(q('tp-member-bar-e1')!.querySelectorAll('.tp-member-seg').length).toBe(3);
      expect(q('tp-ov-employee-e1')).toBeNull();

      q('tp-members-view-table')!.click();
      render();
      expect(q('tp-members-chart')).toBeNull();
      expect(q('tp-ov-employee-e1')).not.toBeNull();
      expect(q('tp-members-view-table')!.getAttribute('aria-pressed')).toBe('true');
    });

    it('one Team members table: estimate hours and this week time side by side, matched by employee', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush(ledTime({
        workload: [
          workloadRow({ employeeId: 'e1', displayName: 'Ann Lee', plannedMinutes: 600, clockedMinutes: 540, unscheduledMinutes: 30, utilizationPercent: 125, expectedMinutes: 480 })
        ]
      }));
      render();
      q('tp-members-view-table')!.click();
      render();

      expect(q('tp-ov-employees')!.textContent).toContain('Team members');
      expect(el().textContent).not.toContain('Workload ranking');
      expect(el().textContent).not.toContain('Employee Breakdown');
      const cells = (id: string) => [...q(id)!.querySelectorAll('td')].map((c) => c.textContent!.trim());
      expect(cells('tp-ov-employee-e1')).toEqual(['ALAnn Lee', '10 h', '5 h', '9 h', '24 h', '10 h', '9 h', '0.5 h', '125%']);
      expect(cells('tp-ov-employee-e2').slice(5)).toEqual(['—', '—', '—', '—']);
      expect(q('tp-ov-employee-e1')!.querySelector('.tp-over')).not.toBeNull();
    });

    it('Export CSV downloads the team workload with each person\'s estimate hours when shown', () => {
      openWith(summary(), 'all');
      http.expectOne(isTime).flush(ledTime({ from: '2026-10-26', to: '2026-11-01', workload: [workloadRow({ employeeId: 'e1', displayName: 'Ann Lee', plannedMinutes: 600 })] }));
      render();
      const download = vi.fn();
      fixture.componentInstance.downloadFile = download;

      q('tp-members-export')!.click();

      expect(download).toHaveBeenCalledOnce();
      const [name, csv] = download.mock.calls[0] as [string, string];
      expect(name).toBe('team-members-2026-10-26_2026-11-01.csv');
      expect(csv.split(/\r?\n/)[0]).toContain('Person');
      expect(csv).toContain('Ann Lee');
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

    it('Planner off shows a note in the unscheduled work panel instead of the cards', () => {
      openWith(summary(), 'all');
      http.expectOne(isUnscheduled).flush(unscheduledPage({ plannerEnabled: false, items: [], totalCount: 0, all: { count: 0, minutes: 0 } }));
      render();

      expect(q('tptd-planner-off')!.textContent).toContain('Planner is off');
      expect(q('tptd-tabs')).toBeNull();
      expect(q('tptd-unscheduled-export')).toBeNull();
    });

    it('shows a retry when the unscheduled work fails', () => {
      openWith(summary(), 'all');
      http.expectOne(isUnscheduled).flush('boom', { status: 500, statusText: 'Server Error' });
      render();

      expect(q('tptd-error')).not.toBeNull();
      (q('tptd-error')!.querySelector('button') as HTMLButtonElement).click();
      render();
      expect(http.expectOne(isUnscheduled).request.params.get('period')).toBe('week');
    });
  });
});
