import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { ActionCenterDecisionService } from '../../data-access/action-center-decision.service';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { ActionItem, TeamActionItemsResponse } from '../../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { ACTION_ITEMS_PER_SOURCE, MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { ActionCenterCardComponent } from './action-center-card.component';

const DAY = 86_400_000;

const EMPTY_LED_PROGRESS: LedWorkProgressResponse = {
  hours: { allocatedHours: 0, completedHours: 0, inProgressHours: 0, notStartedHours: 0, untaskedHours: 0, overTaskedHours: 0, taskCount: 0, unestimatedTaskCount: 0 }, modulesAtRisk: 0, overdueHours: 0, overdueUnestimatedTaskCount: 0, overdueByProject: [],
  projects: [], overdueTasks: [], overdueTotal: 0
};

function capabilities(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: false, canReviewPeopleApprovals: false,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: false,
    canViewLiveActivity: false, hasReports: false, legalEntityId: 'le-1',
    ...overrides
  };
}

function source(overrides: Partial<TeamActionItemsResponse['sources'][number]> = {}) {
  return {
    sourceKey: 'leave.approval', domain: 'people' as const, status: 'ok' as const, pendingCount: 0,
    inProgressCount: null, oldestPendingAt: null, topItems: [] as ActionItem[],
    ...overrides
  };
}

function item(sourceKey: string, id: string, daysAgo: number, overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    sourceKey, entityId: id, title: `${sourceKey} ${id}`, subjectEmployeeId: null, subjectName: `Person ${id}`,
    createdAt: new Date(Date.now() - daysAgo * DAY - 3_600_000).toISOString(), exceptionStatus: null,
    link: { kind: 'leave.approval', params: { requestId: id } },
    ...overrides
  };
}

function overdueTask(id: string, days: number) {
  return { taskId: id, shortId: id.toUpperCase(), title: `Task ${id}`, projectId: 'p1', objectiveId: 'o1', dueDate: '2026-10-01', daysOverdue: days, estimatedHours: null, assignees: [] };
}

describe('ActionCenterCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let deepLinkNavigate: ReturnType<typeof vi.fn>;
  let decide: ReturnType<typeof vi.fn>;
  let notify: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function providers(getActionItems: unknown, ledProgress: LedWorkProgressResponse, caps: MyTeamCapabilitiesResponse): unknown[] {
    return [
      MyTeamActionItemsStore,
      MyTeamLedProgressStore,
      { provide: MyTeamActionItemsApiService, useValue: { getActionItems } },
      { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(ledProgress) } },
      { provide: MyTeamCapabilitiesStore, useValue: { capabilities: () => caps } },
      { provide: Router, useValue: { navigate } },
      { provide: MyTeamDeepLinkService, useValue: { navigate: deepLinkNavigate } },
      { provide: ActionCenterDecisionService, useValue: { decide } },
      { provide: NotificationService, useValue: notify },
      { provide: AuthStore, useValue: { employeeId: () => null } }
    ];
  }

  async function setup(options: {
    caps?: MyTeamCapabilitiesResponse;
    actionItems?: TeamActionItemsResponse | 'error';
    ledProgress?: LedWorkProgressResponse;
    decideImpl?: () => Promise<void>;
  } = {}): Promise<{ fixture: ComponentFixture<ActionCenterCardComponent>; getActionItems: ReturnType<typeof vi.fn>; el: HTMLElement }> {
    navigate = vi.fn();
    deepLinkNavigate = vi.fn();
    decide = vi.fn(options.decideImpl ?? (() => Promise.resolve()));
    notify = { success: vi.fn(), error: vi.fn() };
    const actionItemsResult = options.actionItems ?? { legalEntityId: 'le-1', sources: [] };
    const getActionItems = vi.fn(() =>
      actionItemsResult === 'error' ? throwError(() => new Error('fail')) : of(actionItemsResult)
    );

    await TestBed.configureTestingModule({
      imports: [ActionCenterCardComponent],
      providers: providers(getActionItems, options.ledProgress ?? EMPTY_LED_PROGRESS, options.caps ?? capabilities()) as never[]
    }).compileComponents();

    const fixture = TestBed.createComponent(ActionCenterCardComponent);
    fixture.detectChanges();
    // The card never loads led-progress itself (Team Progress owns it) - mirror that it has.
    await TestBed.inject(MyTeamLedProgressStore).load();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getActionItems, el: fixture.nativeElement as HTMLElement };
  }

  const rows = (el: HTMLElement): string[] =>
    Array.from(el.querySelectorAll('[data-testid="action-center-inbox-row"]')).map((r) => r.textContent!.replace(/\s+/g, ' ').trim());
  const tags = (el: HTMLElement): string[] =>
    Array.from(el.querySelectorAll('[data-testid="action-center-inbox-tag"]')).map((t) => t.textContent!.trim());
  const chipText = (el: HTMLElement, key: string): string =>
    el.querySelector(`[data-testid="action-center-filter-${key}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const click = (fixture: ComponentFixture<ActionCenterCardComponent>, el: HTMLElement, selector: string, index = 0): void => {
    (el.querySelectorAll(selector)[index] as HTMLElement).click();
    fixture.detectChanges();
  };

  const MIXED: TeamActionItemsResponse = {
    legalEntityId: 'le-1',
    sources: [
      source({ pendingCount: 1, topItems: [item('leave.approval', 'l1', 2)] }),
      source({ sourceKey: 'work.objective_change', domain: 'work', pendingCount: 5, topItems: [item('work.objective_change', 'o1', 6)] }),
      source({ sourceKey: 'work.task_creation', domain: 'work', pendingCount: 15, topItems: [item('work.task_creation', 't1', 3)] }),
      source({ sourceKey: 'monitoring.exception', pendingCount: 1, topItems: [item('monitoring.exception', 'e1', 1, { exceptionStatus: 'Open' })] })
    ]
  };
  const MIXED_CAPS = capabilities({ canReviewPeopleApprovals: true, canReviewExceptions: true, hasWorkApprovals: true, leadsWork: true });
  const MIXED_PROGRESS: LedWorkProgressResponse = { ...EMPTY_LED_PROGRESS, overdueTasks: [overdueTask('w1', 7)], overdueTotal: 1 };

  describe('one inbox with filters', () => {
    it('lists approvals, exceptions and overdue work together, oldest first, each tagged with its type', async () => {
      const { fixture, el } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      expect(tags(el)).toEqual(['Overdue', 'Objective', 'Task creation', 'Leave']);
      expect(rows(el)[0]).toContain('7d late');
      expect(rows(el)[1]).toContain('6d ago');
      click(fixture, el, '[data-testid="action-center-show-more"]');
      expect(tags(el)).toEqual(['Overdue', 'Objective', 'Task creation', 'Leave', 'Alert']);
    });

    it('counts each filter from the real pending totals, and shows each type separately', async () => {
      const { fixture, el } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      expect(chipText(el, 'all')).toBe('All 23');
      expect(chipText(el, 'approval')).toBe('Approvals 21');
      expect(chipText(el, 'exception')).toBe('Alerts 1');
      expect(chipText(el, 'overdue')).toBe('Overdue 1');

      click(fixture, el, '[data-testid="action-center-filter-approval"]');
      expect(tags(el)).toEqual(['Objective', 'Task creation', 'Leave']);
      click(fixture, el, '[data-testid="action-center-filter-overdue"]');
      expect(tags(el)).toEqual(['Overdue']);
      expect(el.querySelector('[data-testid="action-center-filter-overdue"]')!.getAttribute('aria-pressed')).toBe('true');
      expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(false);
    });

    it('asks the backend for enough rows per type to fill the inbox', async () => {
      const { getActionItems } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }) });
      expect(getActionItems).toHaveBeenCalledWith(ACTION_ITEMS_PER_SOURCE);
    });

    it('shows 4 rows on the card and pops out every row via "View all", back with "Show less"', async () => {
      const many: TeamActionItemsResponse = {
        legalEntityId: 'le-1',
        sources: [source({ pendingCount: 7, topItems: Array.from({ length: 7 }, (_, i) => item('leave.approval', `r${i}`, i)) })]
      };
      const { fixture, el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: many });
      expect(rows(el).length).toBe(4);
      const showMore = el.querySelector('[data-testid="action-center-show-more"]') as HTMLButtonElement;
      expect(showMore.textContent!.trim()).toBe('View all (7)');

      showMore.click();
      fixture.detectChanges();
      expect(rows(el).length).toBe(7);
      expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(true);

      click(fixture, el, '[data-testid="action-center-show-less"]');
      expect(rows(el).length).toBe(4);
    });

    it('says how many it could not list when more are pending than were sent', async () => {
      const truncated: TeamActionItemsResponse = {
        legalEntityId: 'le-1',
        sources: [source({ pendingCount: 40, topItems: Array.from({ length: 6 }, (_, i) => item('leave.approval', `r${i}`, i)) })]
      };
      const { fixture, el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: truncated });
      click(fixture, el, '[data-testid="action-center-show-more"]');
      expect(el.querySelector('[data-testid="action-center-not-loaded"]')!.textContent).toContain('Showing the oldest 6 of 40');
    });

    it('keeps "View all" with the real total when the backend sends only the 4 oldest rows', async () => {
      const capped: TeamActionItemsResponse = {
        legalEntityId: 'le-1',
        sources: [source({ pendingCount: 20, topItems: Array.from({ length: 4 }, (_, i) => item('leave.approval', `r${i}`, i)) })]
      };
      const { fixture, el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: capped });
      expect(rows(el).length).toBe(4);
      const showMore = el.querySelector('[data-testid="action-center-show-more"]') as HTMLButtonElement;
      expect(showMore.textContent!.trim()).toBe('View all (20)');
      click(fixture, el, '[data-testid="action-center-show-more"]');
      expect(rows(el).length).toBe(4);
      expect(el.querySelector('[data-testid="action-center-not-loaded"]')!.textContent).toContain('Showing the oldest 4 of 20');
    });
  });

  describe('row actions', () => {
    const typeComment = (fixture: ComponentFixture<ActionCenterCardComponent>, el: HTMLElement, text: string): void => {
      const box = el.querySelector('[data-testid="action-center-decision-comment"]') as HTMLTextAreaElement;
      box.value = text;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('offers Approve and Reject only on approvals; every row has the open arrow', async () => {
      const { el } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      expect(el.querySelectorAll('[data-testid="action-center-arrow"]').length).toBe(4);
      expect(el.querySelectorAll('[data-testid="action-center-approve"]').length).toBe(3);
      expect(el.querySelectorAll('[data-testid="action-center-reject"]').length).toBe(3);
      const overdueRow = el.querySelectorAll('[data-testid="action-center-inbox-row"]')[0];
      expect(overdueRow.querySelector('[data-testid="action-center-approve"]')).toBeNull();
    });

    it('opens an approval on its own screen and an overdue task on the board', async () => {
      const { fixture, el } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      click(fixture, el, '[data-testid="action-center-arrow"]', 0);
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'milestones', 'o1', 'board'], { queryParams: { highlightTaskId: 'w1' } });

      click(fixture, el, '[data-testid="action-center-arrow"]', 3);
      await fixture.whenStable();
      expect(deepLinkNavigate).toHaveBeenCalledWith({ kind: 'leave.approval', params: { requestId: 'l1' } });
    });

    it('approves after a confirm, hides the row, refreshes the counts and says so', async () => {
      const { fixture, el, getActionItems } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      const callsBefore = getActionItems.mock.calls.length;
      click(fixture, el, '[data-testid="action-center-approve"]');
      expect(decide).not.toHaveBeenCalled();
      click(fixture, el, '[data-testid="action-center-decision-confirm"]');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(decide).toHaveBeenCalledWith('work.objective_change', 'o1', 'approve', null);
      expect(notify.success).toHaveBeenCalledWith('Objective request approved.');
      expect(tags(el)).not.toContain('Objective');
      expect(getActionItems.mock.calls.length).toBe(callsBefore + 1);
      expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(false);
    });

    it("needs a reason to reject where the request's own page does", async () => {
      const leaveOnly: TeamActionItemsResponse = { legalEntityId: 'le-1', sources: [source({ pendingCount: 1, topItems: [item('leave.approval', 'l1', 2)] })] };
      const { fixture, el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: leaveOnly });
      click(fixture, el, '[data-testid="action-center-reject"]');
      click(fixture, el, '[data-testid="action-center-decision-confirm"]');
      expect(el.querySelector('[data-testid="action-center-decision-validation"]')!.textContent).toContain('Add a reason');
      expect(decide).not.toHaveBeenCalled();

      typeComment(fixture, el, 'Peak week');
      click(fixture, el, '[data-testid="action-center-decision-confirm"]');
      await fixture.whenStable();
      expect(decide).toHaveBeenCalledWith('leave.approval', 'l1', 'reject', 'Peak week');
    });

    it('lets a work request be rejected without a reason, as on the Work approvals page', async () => {
      const workOnly: TeamActionItemsResponse = {
        legalEntityId: 'le-1',
        sources: [source({ sourceKey: 'work.task_creation', domain: 'work', pendingCount: 1, topItems: [item('work.task_creation', 't1', 2)] })]
      };
      const { fixture, el } = await setup({ caps: capabilities({ hasWorkApprovals: true }), actionItems: workOnly });
      click(fixture, el, '[data-testid="action-center-reject"]');
      click(fixture, el, '[data-testid="action-center-decision-confirm"]');
      await fixture.whenStable();
      expect(decide).toHaveBeenCalledWith('work.task_creation', 't1', 'reject', null);
    });

    it("shows the server's reason on the row when a decision fails, and keeps the row", async () => {
      const { fixture, el } = await setup({
        caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS,
        decideImpl: () => Promise.reject(new HttpErrorResponse({ status: 409, error: { detail: 'Already decided by Ravi.' } }))
      });
      click(fixture, el, '[data-testid="action-center-approve"]');
      click(fixture, el, '[data-testid="action-center-decision-confirm"]');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="action-center-row-error"]')!.textContent).toContain('Already decided by Ravi.');
      expect(notify.error).toHaveBeenCalledWith('Already decided by Ravi.');
      expect(tags(el)).toContain('Objective');
    });

    it('cancels without deciding', async () => {
      const { fixture, el } = await setup({ caps: MIXED_CAPS, actionItems: MIXED, ledProgress: MIXED_PROGRESS });
      click(fixture, el, '[data-testid="action-center-approve"]');
      (Array.from(el.querySelectorAll('[data-testid="action-center-decision-form"] button')).find((b) => b.textContent!.trim() === 'Cancel') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="action-center-decision-form"]')).toBeNull();
      expect(decide).not.toHaveBeenCalled();
    });
  });

  describe('permissions and states', () => {
    it('never fetches action items for a leadsWork-only viewer and shows only All and Overdue', async () => {
      const { el, getActionItems } = await setup({ caps: capabilities({ leadsWork: true }), ledProgress: MIXED_PROGRESS });
      expect(getActionItems).not.toHaveBeenCalled();
      expect(el.querySelector('[data-testid="action-center-filter-approval"]')).toBeNull();
      expect(el.querySelector('[data-testid="action-center-filter-exception"]')).toBeNull();
      expect(chipText(el, 'overdue')).toBe('Overdue 1');
      expect(tags(el)).toEqual(['Overdue']);
    });

    it('hides the Alerts filter when the viewer gets no exceptions', async () => {
      const { el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: { legalEntityId: 'le-1', sources: [source()] } });
      expect(el.querySelector('[data-testid="action-center-filter-approval"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="action-center-filter-exception"]')).toBeNull();
    });

    it('shows the error state with retry when loading fails', async () => {
      const { fixture, el, getActionItems } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }), actionItems: 'error' });
      expect(el.textContent).toContain("Couldn't load your approvals.");
      (el.querySelector('app-error-state button') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(getActionItems).toHaveBeenCalledTimes(2);
    });

    it('warns that counts may be higher when one type failed to load', async () => {
      const { el } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: { legalEntityId: 'le-1', sources: [source({ pendingCount: 1, topItems: [item('leave.approval', 'l1', 1)] }), source({ sourceKey: 'attendance.correction', status: 'unavailable' })] }
      });
      expect(el.querySelector('[data-testid="action-center-partial"]')).toBeTruthy();
    });

    it('says "You\'re all caught up" when nothing is pending', async () => {
      const { el } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }) });
      expect(el.textContent).toContain("You're all caught up");
    });

    it('reads "Work you lead" / "People you manage" for single-domain viewers', async () => {
      const work = await setup({ caps: capabilities({ leadsWork: true }) });
      expect(work.el.textContent).toContain('Work you lead');
      TestBed.resetTestingModule();
      const people = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }) });
      expect(people.el.textContent).toContain('People you manage');
    });
  });

  describe('reloads', () => {
    it('does not poll on a timer, and reloads action-items when the tab becomes visible again', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      navigate = vi.fn();
      deepLinkNavigate = vi.fn();
      decide = vi.fn();
      notify = { success: vi.fn(), error: vi.fn() };
      const getActionItems = vi.fn(() => of({ legalEntityId: 'le-1', sources: [] }));
      await TestBed.configureTestingModule({
        imports: [ActionCenterCardComponent],
        providers: providers(getActionItems, EMPTY_LED_PROGRESS, capabilities({ canReviewPeopleApprovals: true })) as never[]
      }).compileComponents();
      const fixture = TestBed.createComponent(ActionCenterCardComponent);
      fixture.detectChanges();
      expect(getActionItems).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(180_000);
      expect(getActionItems).toHaveBeenCalledTimes(1);

      document.dispatchEvent(new Event('visibilitychange'));
      expect(getActionItems).toHaveBeenCalledTimes(2);
    });
  });
});
