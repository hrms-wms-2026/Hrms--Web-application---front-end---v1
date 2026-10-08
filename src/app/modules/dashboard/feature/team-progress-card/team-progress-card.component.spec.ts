import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
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

  it('shows "you don\'t lead any active modules" when there are no projects', async () => {
    const fixture = await setup({
      totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 },
      projects: [], overdueTasks: [], overdueTotal: 0
    });
    expect(fixture.nativeElement.textContent).toContain("You don't lead any active modules");
  });

  it('shows "no open tasks" when there are led projects but zero tasks', async () => {
    const fixture = await setup({
      totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 },
      projects: [{
        projectId: 'p1', projectName: 'Core Platform', identifier: 'CP',
        totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, modules: []
      }],
      overdueTasks: [], overdueTotal: 0
    });
    expect(fixture.nativeElement.textContent).toContain('No open tasks in the modules you lead');
  });

  it('lists modules at-risk first: most overdue, then least complete', async () => {
    const totals = (total: number, completed: number, overdue: number) => ({
      total, completed, inProgress: 0, notStarted: total - completed, overdue
    });
    const fixture = await setup({
      totals: totals(30, 12, 3),
      projects: [{
        projectId: 'p1', projectName: 'Platform', identifier: 'PL', totals: totals(30, 12, 3),
        modules: [
          { objectiveId: 'healthy', title: 'Healthy', isRootModule: false, endDate: '2026-12-01', totals: totals(10, 9, 0) },
          { objectiveId: 'slow', title: 'Slow', isRootModule: false, endDate: '2026-12-01', totals: totals(10, 1, 0) },
          { objectiveId: 'late', title: 'Late', isRootModule: false, endDate: '2026-12-01', totals: totals(10, 2, 3) }
        ]
      }],
      overdueTasks: [], overdueTotal: 3
    });
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-legend-overdue"]').textContent.trim()).toBe('3');
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-at-risk"]').textContent.trim()).toBe('1');
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-toggle"]').textContent.trim()).toBe('View all (3)');

    const el = openAll(fixture);
    const titles = Array.from(
      el.querySelectorAll('[data-testid="team-progress-projects"] li button p:first-child') as NodeListOf<HTMLElement>
    ).map((p) => p.textContent!.trim());
    expect(titles).toEqual(['Late', 'Slow', 'Healthy']);
  });

  it('names the assignees on each overdue task', async () => {
    const fixture = await setup({
      totals: { total: 1, completed: 0, inProgress: 0, notStarted: 1, overdue: 1 },
      projects: [{
        projectId: 'p1', projectName: 'Platform', identifier: 'PL',
        totals: { total: 1, completed: 0, inProgress: 0, notStarted: 1, overdue: 1 }, modules: []
      }],
      overdueTasks: [{
        taskId: 't1', shortId: 'PL-1', title: 'Ship it', projectId: 'p1', objectiveId: 'o1', dueDate: '2026-10-01',
        daysOverdue: 6, assignees: [{ employeeId: 'e1', displayName: 'Kajaa Tharan' }]
      }],
      overdueTotal: 1
    });
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

  it('renders totals, per-project breakdown, and overdue tasks', async () => {
    const fixture = await setup({
      totals: { total: 6, completed: 2, inProgress: 2, notStarted: 1, overdue: 1 },
      projects: [{
        projectId: 'p1', projectName: 'Core Platform', identifier: 'CP',
        totals: { total: 6, completed: 2, inProgress: 2, notStarted: 1, overdue: 1 },
        modules: [{ objectiveId: 'o1', title: 'Payments', isRootModule: false, endDate: '2026-12-01', totals: { total: 6, completed: 2, inProgress: 2, notStarted: 1, overdue: 1 } }]
      }],
      overdueTasks: [{
        taskId: 't1', shortId: 'CP-9', title: 'Fix login bug', projectId: 'p1', objectiveId: 'o1',
        dueDate: '2026-09-25', daysOverdue: 5, assignees: [{ employeeId: 'e1', displayName: 'Arjun M' }]
      }],
      overdueTotal: 1
    });
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-total"]').textContent).toContain('6');
    expect(fixture.nativeElement.querySelector('[data-testid="team-progress-completion"]').textContent.trim()).toBe('33%');
    const text = openAll(fixture).textContent as string;
    expect(text).toContain('Core Platform');
    expect(text).toContain('Payments');
    expect(text).toContain('Fix login bug');
    expect(text).toContain('5d overdue');
  });

  it('navigates to the module tree on module click', async () => {
    const fixture = await setup({
      totals: { total: 1, completed: 0, inProgress: 1, notStarted: 0, overdue: 0 },
      projects: [{
        projectId: 'p1', projectName: 'Core Platform', identifier: 'CP',
        totals: { total: 1, completed: 0, inProgress: 1, notStarted: 0, overdue: 0 },
        modules: [{ objectiveId: 'o1', title: 'Payments', isRootModule: false, endDate: '2026-12-01', totals: { total: 1, completed: 0, inProgress: 1, notStarted: 0, overdue: 0 } }]
      }],
      overdueTasks: [], overdueTotal: 0
    });
    const moduleButton: HTMLButtonElement = openAll(fixture).querySelector('[data-testid="team-progress-projects"] button')!;
    moduleButton.click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'tree']);
  });

  it('navigates to the task board with a highlight on overdue task click', async () => {
    const fixture = await setup({
      totals: { total: 1, completed: 0, inProgress: 0, notStarted: 0, overdue: 1 },
      projects: [{
        projectId: 'p1', projectName: 'Core Platform', identifier: 'CP',
        totals: { total: 1, completed: 0, inProgress: 0, notStarted: 0, overdue: 1 }, modules: []
      }],
      overdueTasks: [{
        taskId: 't1', shortId: 'CP-9', title: 'Fix login bug', projectId: 'p1', objectiveId: 'o1',
        dueDate: '2026-09-25', daysOverdue: 5, assignees: []
      }],
      overdueTotal: 1
    });
    const taskButton: HTMLButtonElement = openAll(fixture).querySelector('[data-testid="team-progress-overdue"] button')!;
    taskButton.click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], {
      queryParams: { highlightTaskId: 't1' }
    });
  });

  const EMPTY: LedWorkProgressResponse = {
    totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 },
    projects: [], overdueTasks: [], overdueTotal: 0
  };

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
});
