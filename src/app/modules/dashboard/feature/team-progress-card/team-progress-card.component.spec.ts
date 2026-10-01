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

  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    result: LedWorkProgressResponse | 'error'
  ): Promise<ComponentFixture<TeamProgressCardComponent>> {
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
    return fixture;
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
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('6');
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
    const moduleButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="team-progress-projects"] button');
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
    const taskButton: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="team-progress-overdue"] button');
    taskButton.click();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], {
      queryParams: { highlightTaskId: 't1' }
    });
  });
});
