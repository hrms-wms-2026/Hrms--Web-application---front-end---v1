import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { ActionCenterDecisionService } from '../../data-access/action-center-decision.service';
import { MyTeamActionItemsApiService } from '../../data-access/my-team-action-items-api.service';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { MyTeamLedProgressApiService } from '../../data-access/my-team-led-progress-api.service';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { MyTeamCapabilitiesResponse } from '../../models/my-team-capabilities.model';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamPageComponent } from './my-team-page.component';

const TEAM_CAPS: MyTeamCapabilitiesResponse = {
  isAvailable: true, canViewPeopleStatus: true, canReviewPeopleApprovals: true, canReviewExceptions: false,
  hasWorkApprovals: false, leadsWork: true, canViewLiveActivity: false, legalEntityId: 'le-1'
};
const EMPTY_TODAY = { workDate: '2026-10-08', timezone: 'UTC', legalEntityId: 'le-1', summary: { total: 0, working: 0, onBreak: 0, clockedOut: 0, late: 0, absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0 }, members: [], totalMembers: 0 };
const EMPTY_LED = { totals: { total: 0, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }, projects: [], overdueTasks: [], overdueTotal: 0 };

describe('MyTeamPageComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(caps: MyTeamCapabilitiesResponse | null, opts: { loaded?: boolean; error?: string | null } = {}) {
    const loadCapabilities = vi.fn(() => Promise.resolve());
    const timeTracking = {
      today: signal(null),
      actionLoading: signal(false),
      activeAction: signal(null),
      loadToday: () => Promise.resolve(),
      startBreak: () => Promise.resolve(),
      endBreak: () => Promise.resolve()
    };

    await TestBed.configureTestingModule({
      imports: [MyTeamPageComponent],
      providers: [
        provideRouter([]),
        { provide: TimeTrackingStore, useValue: timeTracking },
        { provide: AuthStore, useValue: { email: signal('arjun.kumar@onevo.dev'), employeeId: signal(null) } },
        {
          provide: MyTeamCapabilitiesStore,
          useValue: {
            capabilities: signal(caps),
            loaded: signal(opts.loaded ?? true),
            error: signal(opts.error ?? null),
            loadCapabilities,
            ensureLoaded: () => Promise.resolve(),
            refresh: () => Promise.resolve()
          }
        },
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: () => of(EMPTY_TODAY) } },
        { provide: MyTeamActionItemsApiService, useValue: { getActionItems: () => of({ legalEntityId: 'le-1', sources: [] }) } },
        { provide: MyTeamLedProgressApiService, useValue: { getLedProgress: () => of(EMPTY_LED) } },
        { provide: MyTeamDeepLinkService, useValue: { navigate: () => Promise.resolve() } },
        { provide: ActionCenterDecisionService, useValue: { decide: () => Promise.resolve() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyTeamPageComponent);
    fixture.detectChanges();
    return { fixture, loadCapabilities };
  }

  const el = (fixture: { nativeElement: HTMLElement }, selector: string): Element | null => fixture.nativeElement.querySelector(selector);

  it('reloads capabilities on every visit', async () => {
    const { loadCapabilities } = await setup(TEAM_CAPS);
    expect(loadCapabilities).toHaveBeenCalledOnce();
  });

  it('shows a lead Quick Actions plus Team Status and Team Progress - not Action Center, which stays on My Work', async () => {
    const { fixture } = await setup(TEAM_CAPS);
    expect(el(fixture, 'app-quick-actions-card')).toBeTruthy();
    expect(el(fixture, '[data-testid="my-team-main"] #my-team-widget-teamStatus')).toBeTruthy();
    expect(el(fixture, '[data-testid="my-team-side"] #my-team-widget-teamProgress')).toBeTruthy();
    expect(el(fixture, 'app-action-center-card')).toBeNull();
    expect(el(fixture, 'app-my-tasks-card')).toBeNull();
  });

  it('swaps the My Team quick action for My Work, linking back to the personal dashboard', async () => {
    const { fixture } = await setup(TEAM_CAPS);
    expect(el(fixture, '[data-testid="quick-action-my-work"]')!.getAttribute('href')).toBe('/dashboard');
    expect(el(fixture, '[data-testid="quick-action-my-team"]')).toBeNull();
  });

  it('moves Team Progress into the wide column when Team Status is not allowed', async () => {
    const { fixture } = await setup({ ...TEAM_CAPS, canViewPeopleStatus: false });
    expect(el(fixture, '#my-team-widget-teamStatus')).toBeNull();
    expect(el(fixture, '[data-testid="my-team-main"] #my-team-widget-teamProgress')).toBeTruthy();
    expect(fixture.nativeElement.querySelectorAll('app-team-progress-card').length).toBe(1);
  });

  it('shows the empty state to an approver-only viewer, whose only card (Action Center) lives on My Work', async () => {
    const { fixture } = await setup({ ...TEAM_CAPS, canViewPeopleStatus: false, leadsWork: false });
    expect(el(fixture, '[data-testid="my-team-empty"]')).toBeTruthy();
    expect(el(fixture, 'app-action-center-card')).toBeNull();
  });

  it('shows an empty state, but keeps Quick Actions, for a viewer without a team', async () => {
    const { fixture } = await setup({ ...TEAM_CAPS, isAvailable: false });
    expect(el(fixture, '[data-testid="my-team-empty"]')).toBeTruthy();
    expect(el(fixture, 'app-quick-actions-card')).toBeTruthy();
    expect(el(fixture, 'app-team-status-card, app-team-progress-card')).toBeNull();
  });

  it('shows a loader until capabilities arrive', async () => {
    const { fixture } = await setup(null, { loaded: false });
    expect(el(fixture, 'app-loader')).toBeTruthy();
    expect(el(fixture, 'app-team-status-card')).toBeNull();
  });

  it('offers a retry when capabilities fail to load', async () => {
    const { fixture, loadCapabilities } = await setup(null, { error: 'Failed to load My Team capabilities.' });
    (el(fixture, '[data-testid="my-team-retry"]') as HTMLButtonElement).click();
    expect(loadCapabilities).toHaveBeenCalledTimes(2);
  });
});
