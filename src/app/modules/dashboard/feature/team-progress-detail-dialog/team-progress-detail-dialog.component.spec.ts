import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { pickSelectOption } from '../../../../shared/ui/select/select.testing';
import { LedHourTotals, LedModuleProgress, LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { LedEmployeeProgressPage, LedPeriodProgress, LedProgressPeriod, LedTaskPage } from '../../models/team-progress-detail.model';
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

function summary(): LedWorkProgressResponse {
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
    modulesAtRisk: 1
  };
}

function employeePage(extra: Partial<LedEmployeeProgressPage> = {}): LedEmployeeProgressPage {
  return {
    items: [
      { employeeId: 'e1', displayName: 'Ann Lee', completedHours: 10, inProgressHours: 5, notStartedHours: 9, totalHours: 24, taskCount: 4, sharedTaskCount: 3, sharedHours: 24 },
      { employeeId: 'e2', displayName: 'Bo Chen', completedHours: 2, inProgressHours: 0, notStartedHours: 0, totalHours: 2, taskCount: 1, sharedTaskCount: 0, sharedHours: 0 }
    ],
    pageNumber: 1, pageSize: 20, totalCount: 45, totalPages: 3, hasNext: true, hasPrevious: false,
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

function taskPage(extra: Partial<LedTaskPage> = {}): LedTaskPage {
  return {
    items: [
      {
        taskId: 'tk1', shortId: 'APO-12', title: 'Build API', status: 'inProgress', statusName: 'Doing', estimatedHours: 8,
        dueDate: '2026-03-01', projectId: 'p1', projectName: 'Apollo', objectiveId: 'm1', objectiveTitle: 'Backend',
        assignees: [{ employeeId: 'e1', displayName: 'Ann Lee' }, { employeeId: 'e2', displayName: 'Bo Chen' }], isShared: true
      }
    ],
    pageNumber: 1, pageSize: 20, totalCount: 21, totalPages: 2, hasNext: true, hasPrevious: false,
    ...extra
  };
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
  /** The Overview's compact Employee Breakdown asks for 5 rows; the By Employee tab for 20. */
  const expectOverviewEmployees = (): TestRequest =>
    http.expectOne((r) => isEmployees(r) && r.params.get('pageSize') === '5');
  const expectPeriod = (): TestRequest => http.expectOne((r) => r.url === `${BASE}/period`);

  /** Opens on the Overview and answers its Employee Breakdown request (when there's a summary). */
  function openWith(data: LedWorkProgressResponse | null = summary(), period: LedProgressPeriod = 'all'): void {
    fixture.componentRef.setInput('summary', data);
    fixture.componentRef.setInput('period', period);
    fixture.componentRef.setInput('open', true);
    render();
    if (data) {
      expectOverviewEmployees().flush(employeePage({ pageSize: 5 }));
      render();
    }
  }

  function clickTab(label: string): void {
    const tab = Array.from(el().querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((t) => t.textContent?.trim() === label);
    if (!tab) throw new Error(`tab ${label} not found`);
    tab.click();
    render();
  }

  const expectEmployees = (): TestRequest => http.expectOne((r) => isEmployees(r) && r.params.get('pageSize') === '20');
  const expectTasks = (): TestRequest => http.expectOne((r) => r.url === `${BASE}/tasks`);

  function typeInto(container: HTMLElement | null, value: string): void {
    const input = container?.querySelector('input');
    if (!input) throw new Error('input not found');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    render();
  }

  it('renders nothing and fetches nothing while closed', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', false);
    render();
    expect(el().querySelector('[role="dialog"]')).toBeNull();
    http.expectNone(() => true);
  });

  it('renders the overview from the summary without any HTTP', () => {
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
    expect(q('tp-overdue-count')?.textContent).toContain('2 of 9');
    expect(q('tp-overdue-t1')?.textContent).toContain('10 Jan 2026');
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Total allocated');
    // Panel 2: real per-project status bars (no made-up trend).
    expect(q('tp-breakdown')?.textContent).toContain('Status by Project');
    expect(q('tp-breakdown-p1')?.textContent).toContain('Apollo');
    expect(q('tp-breakdown-p2')?.textContent).toContain('Zeus');
    expect(q('tp-breakdown-alltime')).toBeNull();
    // Panel 3: compact top-5 employee table with a "1–2 of 45" pager.
    expect(q('tp-ov-employee-e1')?.textContent).toContain('AL');
    expect(q('tp-ov-employee-e1')?.textContent).toContain('Ann Lee');
    expect(q('tp-ov-employee-e1')?.textContent).toContain('24 h');
    expect(q('tp-ov-employee-range')?.textContent?.trim()).toBe('1–2 of 45');
    http.expectNone(() => true);
  });

  it('asks the Overview employee breakdown for the top 5 by total hours, without a period for All time', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('open', true);
    render();
    const req = expectOverviewEmployees();
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('sort')).toBe('totalHours');
    expect(req.request.params.get('direction')).toBe('desc');
    expect(req.request.params.has('period')).toBe(false);
    req.flush(employeePage({ pageSize: 5 }));
    http.expectNone((r) => r.url === `${BASE}/period`);
  });

  it('pages and searches the Overview employee breakdown, and a row opens that employee tasks', () => {
    vi.useFakeTimers();
    openWith();
    q('tp-ov-employee-next')!.click();
    render();
    let req = expectOverviewEmployees();
    expect(req.request.params.get('pageNumber')).toBe('2');
    req.flush(employeePage({ pageSize: 5, pageNumber: 2, hasPrevious: true }));
    render();
    expect(q('tp-ov-employee-range')?.textContent?.trim()).toBe('6–7 of 45');

    const input = q('tp-ov-employee-search') as HTMLInputElement;
    input.value = 'bo';
    input.dispatchEvent(new Event('input'));
    render();
    http.expectNone(() => true);
    vi.advanceTimersByTime(300);
    render();
    req = expectOverviewEmployees();
    expect(req.request.params.get('search')).toBe('bo');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage({ pageSize: 5 }));
    render();

    q('tp-ov-employee-e2')!.click();
    render();
    const tasks = expectTasks();
    expect(tasks.request.params.get('employeeId')).toBe('e2');
    tasks.flush(taskPage());
  });

  it('emits periodChange from the period dropdown and leaves the value to the card', () => {
    openWith();
    pickSelectOption(q('tp-period-filter')!, 'This week', () => render());
    expect(periodChanges).toEqual(['week']);
    // The input is unchanged until the card feeds it back, so nothing is refetched.
    http.expectNone(() => true);
    expect(q('tp-tile-untasked')).not.toBeNull();
  });

  it('does not fetch the period summary while closed or for All time', () => {
    fixture.componentRef.setInput('summary', summary());
    fixture.componentRef.setInput('period', 'week');
    fixture.componentRef.setInput('open', false);
    render();
    http.expectNone(() => true);
    fixture.componentRef.setInput('period', 'all');
    fixture.componentRef.setInput('open', true);
    render();
    expectOverviewEmployees().flush(employeePage({ pageSize: 5 }));
    http.expectNone((r) => r.url === `${BASE}/period`);
  });

  it('shows the period summary for This week: no Not yet tasked, totals due this week, task counts', () => {
    openWith(summary(), 'week');
    expect(q('tp-period-loading')).not.toBeNull();
    const req = expectPeriod();
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.has('projectId')).toBe(false);
    req.flush(periodSummary('week'));
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
    expect(q('tp-breakdown-alltime')?.textContent).toContain('All time');
  });

  it('sends the period with the filters, caches each period, and only fetches on the Overview', () => {
    openWith(summary(), 'week');
    expectPeriod().flush(periodSummary('week'));
    render();

    fixture.componentRef.setInput('period', 'month');
    render();
    let req = expectPeriod();
    expect(req.request.params.get('period')).toBe('month');
    req.flush(periodSummary('month', { totalHours: 40 }));
    let emp = expectOverviewEmployees();
    expect(emp.request.params.get('period')).toBe('month');
    emp.flush(employeePage({ pageSize: 5 }));
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this month');

    // Back to week: served from the cache (the employee breakdown is asked again for the new period).
    fixture.componentRef.setInput('period', 'week');
    render();
    http.expectNone((r) => r.url === `${BASE}/period`);
    expectOverviewEmployees().flush(employeePage({ pageSize: 5 }));
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this week');

    // A project filter narrows the period summary on the server.
    fixture.componentInstance.setProject('p2');
    render();
    const narrowed = http.expectOne((r) => r.url === `${BASE}/period`);
    expect(narrowed.request.params.get('period')).toBe('week');
    expect(narrowed.request.params.get('projectId')).toBe('p2');
    narrowed.flush(periodSummary('week'));
    expect(q('tp-tile-allocated')).toBeNull();
    expectOverviewEmployees().flush(employeePage({ pageSize: 5 }));
    fixture.componentInstance.clearFilters();
    render();
    http.expectNone((r) => r.url === `${BASE}/period`);
    expectOverviewEmployees().flush(employeePage({ pageSize: 5 }));
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this week');

    // Other tabs never ask for the period summary.
    clickTab('By Employee');
    emp = expectEmployees();
    expect(emp.request.params.get('period')).toBe('week');
    emp.flush(employeePage());
    fixture.componentRef.setInput('period', 'month');
    render();
    expectEmployees().flush(employeePage());
    http.expectNone((r) => r.url === `${BASE}/period`);
  });

  it('shows an error with Retry when the period summary fails', () => {
    openWith(summary(), 'month');
    expectPeriod().flush('boom', { status: 500, statusText: 'Server Error' });
    render();
    const retry = Array.from(el().querySelectorAll<HTMLButtonElement>('[role="alert"] button')).find((b) => b.textContent?.trim() === 'Retry');
    expect(retry).toBeTruthy();
    retry!.click();
    render();
    expectPeriod().flush(periodSummary('month'));
    render();
    expect(q('tp-total-label')?.textContent?.trim()).toBe('Due this month');
  });

  it('sends the period to the employee and task tabs and resets paging when it changes', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    render();
    q('tp-employee-next')!.click();
    render();
    expectEmployees().flush(employeePage({ pageNumber: 2, hasPrevious: true }));
    fixture.componentRef.setInput('period', 'week');
    render();
    const req = expectEmployees();
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage());

    clickTab('Task List');
    const tasks = expectTasks();
    expect(tasks.request.params.get('period')).toBe('week');
    tasks.flush(taskPage());
  });

  it('notes that project and module totals are all-time when a period is picked', () => {
    openWith();
    clickTab('By Project');
    expect(q('tp-period-alltime-note')).toBeNull();
    fixture.componentRef.setInput('period', 'month');
    render();
    expect(q('tp-period-alltime-note')?.textContent).toContain('all-time');
    clickTab('By Module');
    expect(q('tp-period-alltime-note')?.textContent).toContain('all-time');
    http.expectNone(() => true);
  });

  it('shows a safe empty state when the summary is null', () => {
    openWith(null);
    expect(el().textContent).toContain('No team progress yet');
    expect(q('team-progress-detail')).toBeNull();
  });

  it('filters the overview client-side by project and module', () => {
    openWith();
    pickSelectOption(q('tp-project-filter')!, 'Zeus', () => render());
    expect(q('tp-tile-allocated')?.textContent).toContain('80');
    expect(q('tp-overdue-t2')).not.toBeNull();
    expect(q('tp-overdue-t1')).toBeNull();
    // Only the Employee Breakdown goes to the server, narrowed the same way.
    let req = expectOverviewEmployees();
    expect(req.request.params.get('projectId')).toBe('p2');
    req.flush(employeePage({ pageSize: 5 }));
    render();
    // A picked project switches panel 2 to its modules.
    expect(q('tp-breakdown')?.textContent).toContain('Status by Module');
    expect(q('tp-breakdown-m2')).not.toBeNull();

    fixture.componentInstance.setProject('p1');
    fixture.componentInstance.setModule('m1a');
    render();
    expect(q('tp-tile-allocated')?.textContent).toContain('40');
    expect(q('tp-overdue-t1')).not.toBeNull();
    req = expectOverviewEmployees();
    expect(req.request.params.get('objectiveId')).toBe('m1a');
    req.flush(employeePage({ pageSize: 5 }));
    http.expectNone(() => true);
  });

  it('closes on Escape (from app-modal) and on the close button', () => {
    openWith();
    el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closedCount).toBe(1);
    q('tp-close')!.click();
    expect(closedCount).toBe(2);
  });

  it('fetches employees only when the tab is activated, with default params, and caches the result', () => {
    openWith();
    http.expectNone(() => true);
    clickTab('By Employee');
    const req = expectEmployees();
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('sort')).toBe('totalHours');
    expect(req.request.params.get('direction')).toBe('desc');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('period')).toBe(false);
    req.flush(employeePage());
    render();

    expect(q('tp-employee-e1')?.textContent).toContain('Ann Lee');
    expect(q('tp-shared-badge')?.textContent).toContain('3 shared · 24 h');
    expect(q('tp-shared-note')?.textContent).toContain('more than the team total');
    expect(q('tp-unassigned')?.textContent).toContain('2 tasks');
    expect(q('tp-unassigned')?.textContent).toContain('6 h');

    clickTab('Overview');
    clickTab('By Employee');
    http.expectNone(() => true);
  });

  it('does not fetch while closed even on the employee tab, and fetches again once reopened only if needed', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    fixture.componentRef.setInput('open', false);
    render();
    fixture.componentInstance.sortEmployees('name');
    render();
    http.expectNone(() => true);

    fixture.componentRef.setInput('open', true);
    render();
    const req = expectEmployees();
    expect(req.request.params.get('sort')).toBe('name');
    expect(req.request.params.get('direction')).toBe('asc');
    req.flush(employeePage());
  });

  it('debounces the employee search by 300 ms and resets to page 1', () => {
    vi.useFakeTimers();
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    render();
    q('tp-employee-next')!.click();
    render();
    const page2 = expectEmployees();
    expect(page2.request.params.get('pageNumber')).toBe('2');
    page2.flush(employeePage({ pageNumber: 2, hasPrevious: true }));
    render();

    typeInto(q('tp-employee-search'), 'an');
    typeInto(q('tp-employee-search'), 'ann');
    vi.advanceTimersByTime(299);
    render();
    http.expectNone(() => true);
    vi.advanceTimersByTime(1);
    render();
    const req = expectEmployees();
    expect(req.request.params.get('search')).toBe('ann');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage());
  });

  it('cancels the in-flight request when a newer query starts', () => {
    openWith();
    clickTab('By Employee');
    const first = expectEmployees();
    fixture.componentInstance.sortEmployees('completedHours');
    render();
    const second = expectEmployees();
    expect(first.cancelled).toBe(true);
    expect(second.request.params.get('sort')).toBe('completedHours');
    second.flush(employeePage());
  });

  it('sorts employees on the server when a header is clicked, toggling direction', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    render();
    q('tp-sort-name')!.click();
    render();
    let req = expectEmployees();
    expect(req.request.params.get('sort')).toBe('name');
    expect(req.request.params.get('direction')).toBe('asc');
    req.flush(employeePage());
    render();
    q('tp-sort-name')!.click();
    render();
    req = expectEmployees();
    expect(req.request.params.get('direction')).toBe('desc');
    req.flush(employeePage());
  });

  it('sends project/module filters to the server and resets paging when they change', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    render();
    q('tp-employee-next')!.click();
    render();
    expectEmployees().flush(employeePage({ pageNumber: 2 }));
    fixture.componentInstance.setModule('m1a');
    render();
    const req = expectEmployees();
    expect(req.request.params.get('projectId')).toBe('p1');
    expect(req.request.params.get('objectiveId')).toBe('m1a');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(employeePage());
  });

  it('shows an error with Retry that refetches', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush('boom', { status: 500, statusText: 'Server Error' });
    render();
    const retry = Array.from(el().querySelectorAll<HTMLButtonElement>('[role="alert"] button')).find((b) => b.textContent?.trim() === 'Retry');
    expect(retry).toBeTruthy();
    retry!.click();
    render();
    expectEmployees().flush(employeePage());
    render();
    expect(el().querySelector('[role="alert"]')).toBeNull();
    expect(q('tp-employee-e1')).not.toBeNull();
  });

  it('opens the Tasks tab filtered by an employee when a row is clicked', () => {
    openWith();
    clickTab('By Employee');
    expectEmployees().flush(employeePage());
    render();
    q('tp-employee-e1')!.click();
    render();
    const req = expectTasks();
    expect(req.request.params.get('employeeId')).toBe('e1');
    req.flush(taskPage());
    render();
    expect(q('tp-task-employee')?.textContent).toContain('Ann Lee');
  });

  it('loads tasks lazily with status filter, search, sort and paging params', () => {
    vi.useFakeTimers();
    openWith();
    http.expectNone(() => true);
    clickTab('Task List');
    let req = expectTasks();
    expect(req.request.params.get('sort')).toBe('estimatedHours');
    expect(req.request.params.get('direction')).toBe('desc');
    expect(req.request.params.has('status')).toBe(false);
    req.flush(taskPage());
    render();

    expect(q('tp-task-tk1')?.textContent).toContain('APO-12');
    expect(q('tp-task-tk1')?.textContent).toContain('Doing');
    expect(q('tp-task-shared')?.textContent).toContain('Shared');
    expect(q('tp-task-tk1')?.textContent).toContain('1 Mar 2026');

    q('tp-status-completed')!.click();
    render();
    req = expectTasks();
    expect(req.request.params.get('status')).toBe('completed');
    req.flush(taskPage());
    render();
    expect(q('tp-status-completed')?.getAttribute('aria-pressed')).toBe('true');

    q('tp-task-next')!.click();
    render();
    req = expectTasks();
    expect(req.request.params.get('pageNumber')).toBe('2');
    req.flush(taskPage({ pageNumber: 2, hasNext: false, hasPrevious: true }));
    render();

    q('tp-sort-dueDate')!.click();
    render();
    req = expectTasks();
    expect(req.request.params.get('sort')).toBe('dueDate');
    expect(req.request.params.get('direction')).toBe('asc');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush(taskPage());
    render();

    typeInto(q('tp-task-search'), 'APO');
    vi.advanceTimersByTime(300);
    render();
    req = expectTasks();
    expect(req.request.params.get('search')).toBe('APO');
    req.flush(taskPage());
  });

  it('navigates to the task board and closes when a task row is clicked', () => {
    openWith();
    clickTab('Task List');
    expectTasks().flush(taskPage());
    render();
    q('tp-task-tk1')!.click();
    expect(closedCount).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'm1', 'board'], { queryParams: { highlightTaskId: 'tk1' } });
  });

  it('navigates to the module tree and closes when a module row is clicked', () => {
    openWith();
    clickTab('By Module');
    expect(q('tp-module-m1a')).not.toBeNull();
    expect(q('tp-at-risk')).not.toBeNull();
    q('tp-module-m1a')!.click();
    expect(closedCount).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'm1a', 'tree']);
    http.expectNone(() => true);
  });

  it('overdue task link navigates to the board and closes', () => {
    openWith();
    q('tp-overdue-t2')!.click();
    expect(closedCount).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/work', 'p2', 'milestones', 'm2', 'board'], { queryParams: { highlightTaskId: 't2' } });
  });

  it('lists projects with their hours and completion', () => {
    openWith();
    clickTab('By Project');
    const text = q('tp-panel-projects')?.textContent ?? '';
    expect(text).toContain('Apollo');
    expect(text).toContain('Zeus');
    expect(text).toContain('33%');
    http.expectNone(() => true);
  });
});
