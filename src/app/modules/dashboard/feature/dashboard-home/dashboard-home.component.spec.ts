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
import { ActionCenterDecisionService } from '../../data-access/action-center-decision.service';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { DashboardLayoutService } from '../../state/dashboard-layout.service';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { DashboardHomeComponent } from './dashboard-home.component';

const TEAM_CAPS: MyTeamCapabilitiesResponse = {
  isAvailable: true, canViewPeopleStatus: true, canReviewPeopleApprovals: true, canReviewExceptions: false,
  hasWorkApprovals: false, leadsWork: true, canViewLiveActivity: false, legalEntityId: 'le-1'
};
const EMPTY_TODAY = { workDate: '2026-10-08', timezone: 'UTC', legalEntityId: 'le-1', summary: { total: 0, working: 0, onBreak: 0, clockedOut: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0 }, members: [], totalMembers: 0 };
const EMPTY_LED = { totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, projects: [], overdueTasks: [], overdueTotal: 0 };

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
        {
          provide: MyTeamCapabilitiesStore,
          useValue: { capabilities: signal(caps), loaded: signal(true), ensureLoaded: () => Promise.resolve() }
        },
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: () => of(EMPTY_TODAY) } },
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => of({ legalEntityId: 'le-1', sources: [] }) } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED) } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: () => Promise.resolve() } },
        { provide: ActionCenterDecisionService, useValue: { decide: () => Promise.resolve() } }
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

  it('renders the greeting, Today at a Glance, Quick Actions, My Tasks, Notifications, Today\'s Schedule, Work Pattern, and Wellbeing cards', async () => {
    const fixture = await setup();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Arjun Kumar');
    expect(text).toContain('Activity Timeline');
    expect(text).toContain('Quick Actions');
    expect(text).toContain('My Tasks');
    expect(text).toContain('Notifications');
    expect(text).toContain('Today\'s Schedule');
    expect(text).toContain('Work Pattern');
    expect(text).toContain('Wellbeing');
  });

  const q = (fixture: { nativeElement: HTMLElement }, testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const columnTags = (fixture: { nativeElement: HTMLElement }, zone: string): string[] =>
    Array.from(q(fixture, `dashboard-column-${zone}`)!.querySelectorAll(':scope > app-dashboard-card > *')).map((el) => el.tagName.toLowerCase());
  const click = (fixture: { nativeElement: HTMLElement; detectChanges: () => void }, testId: string): void => {
    q(fixture, testId)!.click();
    fixture.detectChanges();
  };

  describe('layout', () => {
    it('puts My Team on top for a manager: KPI tiles, then a team card heading each column', async () => {
      const fixture = await setup(TEAM_CAPS);
      expect(q(fixture, 'dashboard-band-top-teamKpis')).toBeTruthy();
      expect(columnTags(fixture, 'col0')).toEqual(['app-team-status-card', 'app-today-at-a-glance-card', 'app-todays-schedule-card']);
      expect(columnTags(fixture, 'col1')).toEqual(['app-action-center-card', 'app-my-tasks-card', 'app-dashboard-notifications-card']);
      expect(columnTags(fixture, 'col2')).toEqual(['app-team-progress-card', 'app-quick-actions-card', 'app-wellbeing-carousel-card']);
      expect(q(fixture, 'dashboard-band-bottom-workPattern')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('#my-team-widget-teamStatus')).toBeTruthy();
    });

    it('shows no My Team cards or KPI tiles to a viewer without My Team (AC-1)', async () => {
      const fixture = await setup({ ...TEAM_CAPS, isAvailable: false });
      expect(q(fixture, 'dashboard-band-top-teamKpis')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-team-status-card, app-action-center-card, app-team-progress-card')).toBeNull();
      expect(columnTags(fixture, 'col0')).toEqual(['app-today-at-a-glance-card', 'app-todays-schedule-card']);
    });

    it('renders a saved layout', async () => {
      localStorage.setItem('onexso.dashboard_layout', JSON.stringify({
        version: 1,
        top: ['teamKpis'],
        columns: [
          ['myTasks', 'teamStatus', 'todayAtAGlance'],
          ['wellbeing', 'actionCenter', 'todaysSchedule'],
          ['quickActions', 'teamProgress', 'notifications']
        ],
        bottom: ['workPattern'],
        hidden: ['todayAtAGlance']
      }));
      const fixture = await setup({ ...TEAM_CAPS, isAvailable: false });
      expect(columnTags(fixture, 'col0')).toEqual(['app-my-tasks-card']);
      expect(columnTags(fixture, 'col1')).toEqual(['app-wellbeing-carousel-card', 'app-todays-schedule-card']);
      expect(fixture.nativeElement.querySelector('app-today-at-a-glance-card')).toBeNull();
    });
  });

  describe('Customize', () => {
    it('switches to tiles beside the card list, with no live cards while editing', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      expect(q(fixture, 'dashboard-edit-bar')).toBeTruthy();
      expect(q(fixture, 'customize-panel')).toBeTruthy();
      expect(q(fixture, 'dashboard-tile-teamStatus')).toBeTruthy();
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
      click(fixture, 'customize-toggle-wellbeing');
      expect(q(fixture, 'dashboard-tile-wellbeing')).toBeNull();
      click(fixture, 'dashboard-done');
      expect(fixture.nativeElement.querySelector('app-wellbeing-carousel-card')).toBeNull();
      expect(JSON.parse(localStorage.getItem('onexso.dashboard_layout')!).hidden).toEqual(['wellbeing']);
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

    it('moves a card into another column by drop, and by the ↑ / ↓ buttons', async () => {
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      const layout = TestBed.inject(DashboardLayoutService);
      layout.drop('wellbeing', 'col0', 0);
      fixture.detectChanges();
      expect(q(fixture, 'dashboard-edit-col0')!.querySelector('[data-testid^="dashboard-tile-"]')!.getAttribute('data-testid')).toBe('dashboard-tile-wellbeing');

      click(fixture, 'customize-up-actionCenter');
      const col0Tiles = Array.from(q(fixture, 'dashboard-edit-col0')!.querySelectorAll('.dashboard-tile')).map((t) => t.getAttribute('data-testid'));
      expect(col0Tiles.at(-1)).toBe('dashboard-tile-actionCenter');

      click(fixture, 'dashboard-done');
      expect(columnTags(fixture, 'col0')[0]).toBe('app-wellbeing-carousel-card');
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
      expect(localStorage.getItem('onexso.dashboard_layout')).toBeNull();
    });

    it('Reset puts the default back, saved on Done', async () => {
      localStorage.setItem('onexso.dashboard_layout', JSON.stringify({
        version: 1, top: [], columns: [['myTasks'], ['wellbeing'], ['quickActions']], bottom: ['workPattern', 'teamKpis'], hidden: ['todayAtAGlance']
      }));
      const fixture = await setup(TEAM_CAPS);
      click(fixture, 'dashboard-customize');
      click(fixture, 'dashboard-reset');
      click(fixture, 'dashboard-done');
      expect(columnTags(fixture, 'col0')[0]).toBe('app-team-status-card');
      expect(q(fixture, 'dashboard-band-top-teamKpis')).toBeTruthy();
    });
  });
});
