import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { TeamActionItemsResponse } from '../../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { ActionCenterCardComponent } from './action-center-card.component';

const EMPTY_LED_PROGRESS: LedWorkProgressResponse = {
  totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 },
  projects: [], overdueTasks: [], overdueTotal: 0
};

function capabilities(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: false, canReviewPeopleApprovals: false,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: false,
    canViewLiveActivity: false, legalEntityId: 'le-1',
    ...overrides
  };
}

function source(overrides: Partial<TeamActionItemsResponse['sources'][number]> = {}) {
  return {
    sourceKey: 'leave.approval', domain: 'people' as const, status: 'ok' as const, pendingCount: 0,
    inProgressCount: null, oldestPendingAt: null, topItems: [],
    ...overrides
  };
}

describe('ActionCenterCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;
  let deepLinkNavigate: ReturnType<typeof vi.fn>;

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(options: {
    caps?: MyTeamCapabilitiesResponse;
    actionItems?: TeamActionItemsResponse | 'error';
    ledProgress?: LedWorkProgressResponse;
  } = {}): Promise<{ fixture: ComponentFixture<ActionCenterCardComponent>; getActionItems: ReturnType<typeof vi.fn> }> {
    navigate = vi.fn();
    deepLinkNavigate = vi.fn();
    const actionItemsResult = options.actionItems ?? { legalEntityId: 'le-1', sources: [] };
    const getActionItems = vi.fn(() =>
      actionItemsResult === 'error' ? throwError(() => new Error('fail')) : of(actionItemsResult)
    );

    await TestBed.configureTestingModule({
      imports: [ActionCenterCardComponent],
      providers: [
        MyTeamActionItemsStore,
        MyTeamLedProgressStore,
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(options.ledProgress ?? EMPTY_LED_PROGRESS) } },
        { provide: MyTeamCapabilitiesStore, useValue: { capabilities: () => options.caps ?? capabilities({ isAvailable: true }) } },
        { provide: Router, useValue: { navigate } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: deepLinkNavigate } },
        { provide: AuthStore, useValue: { employeeId: () => null } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(ActionCenterCardComponent);
    fixture.detectChanges();
    // ActionCenterCardComponent intentionally never calls MyTeamLedProgressStore.load() itself
    // (Team Progress owns that fetch) - mirror what TeamProgressCardComponent would have already
    // done by the time this card renders in the real app.
    await TestBed.inject(MyTeamLedProgressStore).load();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getActionItems };
  }

  describe('rail visibility (§C)', () => {
    it('is absent for a leadsWork-only viewer with no approval/exception capability', async () => {
      const { fixture } = await setup({ caps: capabilities({ leadsWork: true }) });
      expect(fixture.nativeElement.querySelector('[data-testid="action-center-rail"]')).toBeNull();
    });

    it('never calls getActionItems for a leadsWork-only viewer', async () => {
      const { getActionItems } = await setup({ caps: capabilities({ leadsWork: true }) });
      expect(getActionItems).not.toHaveBeenCalled();
    });

    it('renders for a viewer with hasWorkApprovals even without leadsWork', async () => {
      const { fixture } = await setup({ caps: capabilities({ hasWorkApprovals: true }) });
      expect(fixture.nativeElement.querySelector('[data-testid="action-center-rail"]')).toBeTruthy();
    });
  });

  describe('rail collapsing (§A)', () => {
    it('shows the loading skeleton and claims no category "all clear" while the fetch is in flight', async () => {
      const { Subject } = await import('rxjs');
      const pending = new Subject<TeamActionItemsResponse>();
      await TestBed.configureTestingModule({
        imports: [ActionCenterCardComponent],
        providers: [
          MyTeamActionItemsStore,
          MyTeamLedProgressStore,
          { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => pending.asObservable() } },
          { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED_PROGRESS) } },
          { provide: MyTeamCapabilitiesStore, useValue: { capabilities: () => capabilities({ canReviewPeopleApprovals: true }) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: MyTeamDeepLinkService, useValue: { navigate: vi.fn() } },
          { provide: AuthStore, useValue: { employeeId: () => null } }
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(ActionCenterCardComponent);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="action-center-rail-skeleton"]')).toBeTruthy();
      expect(fixture.nativeElement.textContent).not.toContain('all clear');
      pending.complete();
    });

    it('collapses two or more zero-and-ok categories into one "+N all clear" chip', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: {
          legalEntityId: 'le-1',
          sources: [source({ sourceKey: 'leave.approval', pendingCount: 0 }), source({ sourceKey: 'attendance.correction', pendingCount: 0 })]
        }
      });
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('+2 all clear');
      expect(text).not.toContain('Leave requests');
    });

    it('shows a single zero-and-ok category directly instead of a "+1" summary', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: { legalEntityId: 'le-1', sources: [source({ sourceKey: 'leave.approval', pendingCount: 0 })] }
      });
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Leave requests');
      expect(text).not.toContain('all clear');
    });

    it('never folds an unavailable category into the "all clear" summary', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: {
          legalEntityId: 'le-1',
          sources: [
            source({ sourceKey: 'leave.approval', status: 'unavailable', pendingCount: 0 }),
            source({ sourceKey: 'attendance.correction', pendingCount: 0 }),
            source({ sourceKey: 'attendance.work_area', pendingCount: 0 })
          ]
        }
      });
      const text = fixture.nativeElement.textContent as string;
      expect(text.replace(/\s+/g, ' ')).toContain("Leave requests — couldn't load");
      expect(text).toContain('+2 all clear');
    });

    it('expands a collapsed summary to show the individual zero categories on click', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: {
          legalEntityId: 'le-1',
          sources: [source({ sourceKey: 'leave.approval', pendingCount: 0 }), source({ sourceKey: 'attendance.correction', pendingCount: 0 })]
        }
      });
      const summaryChip: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="action-center-rail-people"] .action-center-chip--summary');
      summaryChip.click();
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Leave requests');
      expect(text).toContain('Attendance corrections');
    });

    it('groups categories under People I manage and Work I lead', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true, hasWorkApprovals: true }),
        actionItems: {
          legalEntityId: 'le-1',
          sources: [source({ sourceKey: 'leave.approval', domain: 'people', pendingCount: 3 }), source({ sourceKey: 'work.objective_change', domain: 'work', pendingCount: 4 })]
        }
      });
      const peopleSection = fixture.nativeElement.querySelector('[data-testid="action-center-rail-people"]');
      const workSection = fixture.nativeElement.querySelector('[data-testid="action-center-rail-work"]');
      expect(peopleSection.textContent).toContain('Leave requests');
      expect(workSection.textContent).toContain('Objective changes');
    });
  });

  describe('category navigation', () => {
    it('navigates a people category to its known list route on click', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: { legalEntityId: 'le-1', sources: [source({ sourceKey: 'attendance.correction', pendingCount: 2 })] }
      });
      const chip: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="action-center-rail-people"] button.action-center-chip');
      chip.click();
      await fixture.whenStable();
      expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], { queryParams: { view: 'team', type: 'corrections' } });
    });
  });

  describe('priority queue (§B)', () => {
    function manyPendingApprovals(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        sourceKey: 'leave.approval', entityId: `r${i}`, title: `Leave request ${i}`, subjectEmployeeId: null,
        subjectName: `Person ${i}`, createdAt: new Date(2026, 0, i + 1).toISOString(), exceptionStatus: null,
        link: { kind: 'leave.approval', params: { requestId: `r${i}` } }
      }));
    }

    it('shows at most 5 rows by default when more than 5 exist', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: { legalEntityId: 'le-1', sources: [source({ pendingCount: 5, topItems: manyPendingApprovals(5) })] }
      });
      const rows = fixture.nativeElement.querySelectorAll('[data-testid="action-center-queue"] > li');
      expect(rows.length).toBe(5);
      expect(fixture.nativeElement.querySelector('[data-testid="action-center-show-more"]')).toBeNull();
    });

    it('expands to show the rest via "Show N more priority items" and back with "Show less"', async () => {
      // 5 pending approvals + 1 overdue task = 6 total, triggers the 5-row cap.
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true, leadsWork: true }),
        actionItems: { legalEntityId: 'le-1', sources: [source({ pendingCount: 5, topItems: manyPendingApprovals(5) })] },
        ledProgress: {
          totals: { total: 1, completed: 0, inProgress: 0, notStarted: 0, overdue: 1 },
          projects: [], overdueTotal: 1,
          overdueTasks: [{ taskId: 't1', shortId: 'CP-1', title: 'Overdue task', projectId: 'p1', objectiveId: 'o1', dueDate: '2026-01-01', daysOverdue: 3, assignees: [] }]
        }
      });

      const showMore: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="action-center-show-more"]');
      expect(showMore.textContent?.trim()).toBe('Show 1 more priority items');

      showMore.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="action-center-queue"] > li').length).toBe(6);
      expect(fixture.nativeElement.querySelector('[data-testid="action-center-show-less"]')).toBeTruthy();

      fixture.nativeElement.querySelector('[data-testid="action-center-show-less"]').click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="action-center-queue"] > li').length).toBe(5);
    });

    it('shows a loading skeleton while a sibling store has not resolved', async () => {
      const { Subject } = await import('rxjs');
      const pending = new Subject<TeamActionItemsResponse>();
      await TestBed.configureTestingModule({
        imports: [ActionCenterCardComponent],
        providers: [
          MyTeamActionItemsStore,
          MyTeamLedProgressStore,
          { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => pending.asObservable() } },
          { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED_PROGRESS) } },
          { provide: MyTeamCapabilitiesStore, useValue: { capabilities: () => capabilities({ canReviewPeopleApprovals: true }) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: MyTeamDeepLinkService, useValue: { navigate: vi.fn() } },
          { provide: AuthStore, useValue: { employeeId: () => null } }
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(ActionCenterCardComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="action-center-queue-skeleton"]')).toBeTruthy();
      pending.complete();
    });

    it('shows "You\'re all caught up" only once resolved and genuinely empty', async () => {
      const { fixture } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }) });
      expect(fixture.nativeElement.textContent).toContain("You're all caught up");
    });

    it('routes a queue item via the deep-link service on click', async () => {
      const { fixture } = await setup({
        caps: capabilities({ canReviewPeopleApprovals: true }),
        actionItems: {
          legalEntityId: 'le-1',
          sources: [source({
            pendingCount: 1,
            topItems: [{ sourceKey: 'leave.approval', entityId: 'r1', title: 'Leave request - Priya K', subjectEmployeeId: null, subjectName: 'Priya K', createdAt: '2026-09-29T00:00:00Z', exceptionStatus: null, link: { kind: 'leave.approval', params: { requestId: 'r1' } } }]
          })]
        }
      });
      const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="action-center-queue"] button');
      row.click();
      await fixture.whenStable();
      expect(deepLinkNavigate).toHaveBeenCalledWith({ kind: 'leave.approval', params: { requestId: 'r1' } });
    });
  });

  describe('subtitle', () => {
    it('reads "Work you lead" for a leadsWork-only viewer', async () => {
      const { fixture } = await setup({ caps: capabilities({ leadsWork: true }) });
      expect(fixture.nativeElement.textContent).toContain('Work you lead');
    });

    it('reads "People you manage" for a people-approvals-only viewer', async () => {
      const { fixture } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true }) });
      expect(fixture.nativeElement.textContent).toContain('People you manage');
      expect(fixture.nativeElement.textContent).not.toContain('Work you lead');
    });

    it('reads the combined subtitle when both apply', async () => {
      const { fixture } = await setup({ caps: capabilities({ canReviewPeopleApprovals: true, leadsWork: true }) });
      expect(fixture.nativeElement.textContent).toContain('People you manage and work you lead');
    });
  });

  describe('polling', () => {
    it('polls action-items every 60s while visible, when the rail is relevant', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      const getActionItems = vi.fn(() => of({ legalEntityId: 'le-1', sources: [] }));
      await TestBed.configureTestingModule({
        imports: [ActionCenterCardComponent],
        providers: [
          MyTeamActionItemsStore,
          MyTeamLedProgressStore,
          { provide: MyTeamActionItemsApiService, useValue: { getActionItems } },
          { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED_PROGRESS) } },
          { provide: MyTeamCapabilitiesStore, useValue: { capabilities: () => capabilities({ canReviewPeopleApprovals: true }) } },
          { provide: Router, useValue: { navigate: vi.fn() } },
          { provide: MyTeamDeepLinkService, useValue: { navigate: vi.fn() } },
          { provide: AuthStore, useValue: { employeeId: () => null } }
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(ActionCenterCardComponent);
      fixture.detectChanges();
      expect(getActionItems).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(getActionItems).toHaveBeenCalledTimes(2);
    });
  });
});
