import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { TeamActionItemsResponse } from '../../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { PriorityActionsCardComponent } from './priority-actions-card.component';

describe('PriorityActionsCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let deepLinkNavigate: ReturnType<typeof vi.fn>;

  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    actionItemsResponse: TeamActionItemsResponse | null,
    ledProgressResponse: LedWorkProgressResponse | null
  ): Promise<ComponentFixture<PriorityActionsCardComponent>> {
    navigate = vi.fn();
    deepLinkNavigate = vi.fn();

    await TestBed.configureTestingModule({
      imports: [PriorityActionsCardComponent],
      providers: [
        MyTeamActionItemsStore,
        MyTeamLedProgressStore,
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => of(actionItemsResponse ?? { legalEntityId: 'le-1', sources: [] }) } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(ledProgressResponse ?? { totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, projects: [], overdueTasks: [], overdueTotal: 0 }) } },
        { provide: Router, useValue: { navigate } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: deepLinkNavigate } },
        { provide: AuthStore, useValue: { employeeId: () => null } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(PriorityActionsCardComponent);
    if (actionItemsResponse) await TestBed.inject(MyTeamActionItemsStore).load();
    if (ledProgressResponse) await TestBed.inject(MyTeamLedProgressStore).load();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows "You\'re all caught up" when both source stores are empty', async () => {
    const fixture = await setup(null, null);
    expect(fixture.nativeElement.textContent).toContain("You're all caught up");
  });

  it('reads from the already-loaded sibling stores without triggering its own extra fetch', async () => {
    const getActionItems = vi.fn(() => of({ legalEntityId: 'le-1', sources: [] }));
    await TestBed.configureTestingModule({
      imports: [PriorityActionsCardComponent],
      providers: [
        MyTeamActionItemsStore,
        MyTeamLedProgressStore,
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: vi.fn(() => of({ totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, projects: [], overdueTasks: [], overdueTotal: 0 })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: vi.fn() } },
        { provide: AuthStore, useValue: { employeeId: () => null } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(PriorityActionsCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(getActionItems).not.toHaveBeenCalled();
  });

  it('renders a merged item and routes via the deep-link service on click', async () => {
    const fixture = await setup({
      legalEntityId: 'le-1',
      sources: [{
        sourceKey: 'leave.approval', domain: 'people', status: 'ok', pendingCount: 1, inProgressCount: null,
        oldestPendingAt: null,
        topItems: [{
          sourceKey: 'leave.approval', entityId: 'r1', title: 'Leave request - Priya K', subjectEmployeeId: null,
          subjectName: 'Priya K', createdAt: '2026-09-29T00:00:00Z', exceptionStatus: null,
          link: { kind: 'leave.approval', params: { requestId: 'r1' } }
        }]
      }]
    }, null);

    expect(fixture.nativeElement.textContent).toContain('Priya K');
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="priority-actions-list"] button');
    row.click();
    await fixture.whenStable();
    expect(deepLinkNavigate).toHaveBeenCalledWith({ kind: 'leave.approval', params: { requestId: 'r1' } });
  });

  it('routes an overdue-work item directly to its task board', async () => {
    const fixture = await setup(null, {
      totals: { total: 1, completed: 0, inProgress: 0, notStarted: 0, overdue: 1 },
      projects: [], overdueTotal: 1,
      overdueTasks: [{
        taskId: 't1', shortId: 'CP-1', title: 'Fix bug', projectId: 'p1', objectiveId: 'o1',
        dueDate: '2026-09-20', daysOverdue: 5, assignees: []
      }]
    });
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="priority-actions-list"] button');
    row.click();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], {
      queryParams: { highlightTaskId: 't1' }
    });
  });
});
