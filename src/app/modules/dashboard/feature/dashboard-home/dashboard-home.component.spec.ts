import { signal } from '@angular/core';
import { afterEach, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationNavigationService } from '../../../../core/services/notification-navigation.service';
import { NotificationsStore } from '../../../../core/state/notifications.store';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { ActivityTimelineApiService } from '../../data-access/activity-timeline-api.service';
import { FocusStatusApiService } from '../../data-access/focus-status-api.service';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { WorkPatternApiService } from '../../data-access/work-pattern-api.service';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { ActionCenterDecisionService } from '../../data-access/action-center-decision.service';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { PageToolbarService } from '../../../../shared/state/page-toolbar.service';
import { DashboardLayoutService } from '../../state/dashboard-layout.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { DashboardHomeComponent } from './dashboard-home.component';

const TEAM_CAPS: MyTeamCapabilitiesResponse = {
  isAvailable: true, canViewPeopleStatus: true, canReviewPeopleApprovals: true, canReviewExceptions: false,
  hasWorkApprovals: false, leadsWork: true, canViewLiveActivity: false, legalEntityId: 'le-1'
};
const EMPTY_TODAY = { workDate: '2026-10-08', timezone: 'UTC', legalEntityId: 'le-1', summary: { total: 0, working: 0, onBreak: 0, clockedOut: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0 }, members: [], totalMembers: 0 };
// No employee record in the AuthStore stub, so the layout is saved under the login email.
const LAYOUT_KEY = 'onexso.dashboard_layout:arjun.kumar@onevo.dev';
const EMPTY_LED = { hours: { allocatedHours: 0, completedHours: 0, inProgressHours: 0, notStartedHours: 0, untaskedHours: 0, overTaskedHours: 0, taskCount: 0, unestimatedTaskCount: 0 }, modulesAtRisk: 0, projects: [], overdueTasks: [], overdueTotal: 0 };

describe('DashboardHomeComponent', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  async function setup(caps: MyTeamCapabilitiesResponse | null = null) {
    const store = {
      today: signal(null),
      todayLoading: signal(false),
      todayError: signal(null),
      actionLoading: signal(false),
      activeAction: signal(null),
      history: signal([]),
      historyLoading: signal(false),
      historyError: signal(null),
      loadToday: () => Promise.resolve(),
      loadMyHistory: () => Promise.resolve(),
      startBreak: () => Promise.resolve(),
      endBreak: () => Promise.resolve()
    };

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: store },
        { provide: ActivityTimelineApiService, useValue: { getMyTimeline: () => of({ date: '', segments: [] }) } },
        { provide: MyTasksApiService, useValue: { getMyTasks: () => of({ tasks: [] }) } },
        { provide: WorkPatternApiService, useValue: { getMyWorkPattern: () => of({ days: [] }) } },
        { provide: FocusStatusApiService, useValue: { getMyFocusStatus: () => of({ isBreakReminderDue: false, continuousFocusMinutes: 0 }) } },
        { provide: CalendarEventApiService, useValue: { getEvents: () => of({ events: [] }), getMyTimezone: () => of({ timezone: 'UTC' }) } },
        { provide: AuthStore, useValue: { email: signal('arjun.kumar@onevo.dev'), employeeId: signal(null) } },
        {
          provide: NotificationsStore,
          useValue: {
            items: signal([]),
            unreadCount: signal(0),
            loading: signal(false),
            loadMine: () => Promise.resolve(),
            markRead: () => Promise.resolve(),
            markAllRead: () => Promise.resolve()
          }
        },
        { provide: NotificationNavigationService, useValue: { navigate: () => Promise.resolve() } },
        { provide: PermissionService, useValue: { hasAnyModule: () => true, hasAnyPermission: () => true } },
        {
          provide: MyTeamCapabilitiesStore,
          useValue: { capabilities: signal(caps), loaded: signal(true), ensureLoaded: () => Promise.resolve() }
        },
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: () => of(EMPTY_TODAY) } },
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => of({ legalEntityId: 'le-1', sources: [] }) } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED) } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: () => Promise.resolve() } },
        { provide: ActionCenterDecisionService, useValue: { decide: () => Promise.resolve() } },
        {
          provide: ProjectApiService,
          useValue: { listMine: () => of({ items: [], pageNumber: 1, pageSize: 100, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false }) }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the dashboard cards without the removed placeholder UI', async () => {
    const fixture = await setup();

    const text = (fixture.nativeElement.textContent as string).trim();
    expect(text).not.toContain('Welcome');
    expect(text).not.toContain('Sign out');
  });

  it('renders the greeting, Today\'s Schedule, My Tasks, Quick Actions and Work Pattern by default - not Notifications or Wellbeing', async () => {
    const fixture = await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Arjun Kumar');
    expect(text).toContain('Activity Timeline');
    expect(text).toContain('Quick Actions');
    expect(text).toContain('My Tasks');
    expect(text).toContain('Today\'s Schedule');
    expect(text).toContain('Work Pattern');
    expect(fixture.nativeElement.querySelector('app-dashboard-notifications-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-wellbeing-carousel-card')).toBeNull();
  });

  const q = (fixture: { nativeElement: HTMLElement }, testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  /** The live grid's cards in order, as `tag:size`. */
  const gridCards = (fixture: { nativeElement: HTMLElement }): string[] =>
    Array.from(q(fixture, 'dashboard-grid')!.querySelectorAll(':scope > app-dashboard-grid-item')).map(
      (item) => `${item.querySelector(':scope > app-dashboard-card > *')!.tagName.toLowerCase()}:${item.getAttribute('data-size')}`
    );
  const DEFAULT_GRID = [
    'app-today-at-a-glance-card:small',
    'app-action-center-card:large',
    'app-quick-actions-card:small',
    'app-todays-schedule-card:large',
    'app-today-total-time-card:small',
    'app-active-projects-card:small',
    'app-my-tasks-card:large'
  ];
  // "Customize" now renders in the top navbar (outside this component), so it's not in `fixture`'s
  // DOM - trigger it the way the navbar button would, via the shared PageToolbarService action.
  const click = (fixture: { nativeElement: HTMLElement; detectChanges: () => void }, testId: string): void => {
    if (testId === 'dashboard-customize') {
      TestBed.inject(PageToolbarService).action()?.onClick();
    } else {
      q(fixture, testId)!.click();
    }
    fixture.detectChanges();
  };

  describe('layout', () => {
    it('shows a manager the default layout: Action Center kept, Team Status and Team Progress left to My Team', async () => {
      const fixture = await setup(TEAM_CAPS);
      expect(fixture.nativeElement.querySelector('app-team-kpi-strip')).toBeNull();
      expect(gridCards(fixture)).toEqual(DEFAULT_GRID);
      expect(q(fixture, 'dashboard-band-bottom-workPattern')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-team-status-card, app-team-progress-card')).toBeNull();
      expect(q(fixture, 'quick-action-my-team')!.getAttribute('href')).toBe('/dashboard/my-team');
    });

    it('shows no My Team cards to a viewer without My Team (AC-1)', async () => {
      const fixture = await setup({ ...TEAM_CAPS, isAvailable: false });
      expect(fixture.nativeElement.querySelector('app-team-status-card, app-action-center-card, app-team-progress-card')).toBeNull();
      expect(gridCards(fixture).slice(0, 3)).toEqual(['app-today-at-a-glance-card:small', 'app-quick-actions-card:small', 'app-todays-schedule-card:large']);
    });

    it('renders a saved layout', async () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({
        version: 2,
        top: ['quickActions'],
        grid: ['myTasks', 'teamStatus', 'todayAtAGlance', 'wellbeing', 'actionCenter', 'todaysSchedule', 'teamProgress', 'notifications', 'todayTotalTime', 'activeProjects'],
        bottom: ['workPattern'],
        hidden: ['todayAtAGlance', 'notifications', 'todayTotalTime', 'activeProjects'],
        sizes: { myTasks: 'small', wellbeing: 'large' }
      }));
      const fixture = await setup({ ...TEAM_CAPS, isAvailable: false });
      expect(gridCards(fixture)).toEqual(['app-my-tasks-card:small', 'app-wellbeing-carousel-card:large', 'app-todays-schedule-card:large']);
      expect(q(fixture, 'dashboard-band-top-quickActions')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('app-today-at-a-glance-card')).toBeNull();
    });

    it('treats a saved v1 (3-column) layout as the default', async () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({
        version: 1, top: [], columns: [['myTasks'], ['wellbeing'], ['quickActions']], bottom: ['workPattern'], hidden: ['todayAtAGlance']
      }));
      const fixture = await setup(TEAM_CAPS);
      expect(gridCards(fixture)).toEqual(DEFAULT_GRID);
    });
  });

  describe('Customize', () => {
    it('switches to tiles beside the card list, with no live cards while editing', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      expect(q(fixture, 'dashboard-edit-bar')).toBeTruthy();
      expect(q(fixture, 'customize-panel')).toBeTruthy();
      expect(q(fixture, 'dashboard-tile-actionCenter')).toBeTruthy();
      expect(q(fixture, 'dashboard-tile-teamStatus')).toBeNull();
      expect(q(fixture, 'customize-toggle-teamStatus')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-my-tasks-card')).toBeNull();
      expect(q(fixture, 'customize-group-team')).toBeTruthy();
    });

    it('leaves the My Team group out of the list for a viewer without My Team', async () => {
      const fixture = await setup({ ...TEAM_CAPS, isAvailable: false });
      click(fixture, 'dashboard-customize');
      expect(q(fixture, 'customize-group-team')).toBeNull();
      expect(q(fixture, 'customize-group-day')).toBeTruthy();
    });

    it('unticks a card and saves the change on Done', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      click(fixture, 'customize-toggle-quickActions');
      expect(q(fixture, 'dashboard-tile-quickActions')).toBeNull();
      click(fixture, 'dashboard-done');
      expect(fixture.nativeElement.querySelector('app-quick-actions-card')).toBeNull();
      expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!).hidden).toContain('quickActions');
    });

    it('removes a card from its tile and brings it back from the list', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      click(fixture, 'dashboard-tile-remove-myTasks');
      expect(q(fixture, 'dashboard-tile-myTasks')).toBeNull();
      expect((q(fixture, 'customize-toggle-myTasks') as HTMLInputElement).checked).toBe(false);
      click(fixture, 'customize-toggle-myTasks');
      expect(q(fixture, 'dashboard-tile-myTasks')).toBeTruthy();
    });

    it('moves a card in the grid by drop, and by the ↑ / ↓ buttons', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      const tiles = (): (string | null)[] =>
        Array.from(q(fixture, 'dashboard-edit-grid')!.querySelectorAll('.dashboard-tile')).map((t) => t.getAttribute('data-testid'));
      const layout = TestBed.inject(DashboardLayoutService);
      layout.drop('quickActions', 'grid', 0);
      fixture.detectChanges();
      expect(tiles()[0]).toBe('dashboard-tile-quickActions');

      click(fixture, 'customize-up-actionCenter');
      expect(tiles().slice(0, 3)).toEqual(['dashboard-tile-quickActions', 'dashboard-tile-actionCenter', 'dashboard-tile-todayAtAGlance']);

      click(fixture, 'dashboard-done');
      expect(gridCards(fixture)[0]).toBe('app-quick-actions-card:small');
    });

    it('switches a grid card between Small and Large and saves it on Done', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      expect(q(fixture, 'dashboard-tile-quickActions')!.classList).not.toContain('dashboard-tile--large');
      expect(q(fixture, 'dashboard-tile-size-small-quickActions')!.getAttribute('aria-pressed')).toBe('true');
      click(fixture, 'dashboard-tile-size-large-quickActions');
      expect(q(fixture, 'dashboard-tile-quickActions')!.classList).toContain('dashboard-tile--large');
      expect(q(fixture, 'dashboard-tile-size-small-workPattern')).toBeNull();

      click(fixture, 'dashboard-done');
      expect(gridCards(fixture)[2]).toBe('app-quick-actions-card:large');
      expect(JSON.parse(localStorage.getItem(LAYOUT_KEY)!).sizes).toEqual({ quickActions: 'large' });
    });

    it('drops the draft on Cancel and on Esc', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      click(fixture, 'customize-toggle-myTasks');
      click(fixture, 'dashboard-cancel');
      expect(fixture.nativeElement.querySelector('app-my-tasks-card')).toBeTruthy();

      click(fixture, 'dashboard-customize');
      click(fixture, 'customize-toggle-myTasks');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(q(fixture, 'dashboard-edit-bar')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-my-tasks-card')).toBeTruthy();
      expect(localStorage.getItem(LAYOUT_KEY)).toBeNull();
    });

    it('Reset puts the default back, saved on Done', async () => {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify({
        version: 2, top: [], grid: ['myTasks', 'wellbeing', 'quickActions'], bottom: ['workPattern'], hidden: ['todayAtAGlance'], sizes: { myTasks: 'small' }
      }));
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      click(fixture, 'dashboard-reset');
      click(fixture, 'dashboard-done');
      expect(gridCards(fixture)).toEqual(DEFAULT_GRID);
    });
  });
});
