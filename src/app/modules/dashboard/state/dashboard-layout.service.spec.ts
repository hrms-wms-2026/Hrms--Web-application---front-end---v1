import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { MyTeamCapabilitiesResponse } from '../models/my-team-capabilities.model';
import { DEFAULT_DASHBOARD_LAYOUT } from '../utils/dashboard-layout.util';
import { DashboardLayoutService } from './dashboard-layout.service';
import { MyTeamCapabilitiesStore } from './my-team-capabilities.store';

function caps(overrides: Partial<MyTeamCapabilitiesResponse> = {}): MyTeamCapabilitiesResponse {
  return {
    isAvailable: true, canViewPeopleStatus: true, canReviewPeopleApprovals: true,
    canReviewExceptions: false, hasWorkApprovals: false, leadsWork: true,
    canViewLiveActivity: false, legalEntityId: 'le-1',
    ...overrides
  };
}

describe('DashboardLayoutService', () => {
  const capabilities = signal<MyTeamCapabilitiesResponse | null>(null);
  const loaded = signal(false);
  const employeeId = signal<string | null>('emp-1');

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  function setup(c: MyTeamCapabilitiesResponse | null = caps(), isLoaded = true): DashboardLayoutService {
    capabilities.set(c);
    loaded.set(isLoaded);
    employeeId.set('emp-1');
    TestBed.configureTestingModule({
      providers: [
        { provide: MyTeamCapabilitiesStore, useValue: { capabilities, loaded } },
        { provide: AuthStore, useValue: { employeeId, email: signal('arjun.kumar@onevo.dev') } }
      ]
    });
    return TestBed.inject(DashboardLayoutService);
  }

  it('starts from the default layout: Team Status, Notifications and Wellbeing unticked', () => {
    const service = setup();
    expect(service.resolved().top).toEqual([]);
    expect(service.resolved().columns).toEqual([['todayAtAGlance', 'todaysSchedule'], ['actionCenter', 'myTasks'], ['quickActions', 'teamProgress']]);
    expect(service.resolved().bottom).toEqual(['workPattern']);
  });

  it('shows no My Team cards or My Team group to a viewer without My Team', () => {
    const service = setup(caps({ isAvailable: false }));
    expect(service.resolved().top).toEqual([]);
    expect(service.resolved().columns.flat()).not.toContain('teamStatus');
    expect(service.customizeGroups().map((g) => g.id)).toEqual(['day']);
  });

  it('waits for capabilities before Customize can start', () => {
    const service = setup(null, false);
    service.startEditing();
    expect(service.editing()).toBe(false);
  });

  it('edits a draft: Cancel drops it, Done saves it per employee', () => {
    const service = setup();
    service.startEditing();
    service.toggle('quickActions');
    expect(service.resolved().columns[2]).not.toContain('quickActions');
    service.cancel();
    expect(service.resolved().columns[2]).toContain('quickActions');

    service.startEditing();
    service.toggle('quickActions');
    service.drop('myTasks', 'col0', 0);
    service.done();
    expect(service.editing()).toBe(false);
    expect(service.resolved().columns[0][0]).toBe('myTasks');
    expect(service.resolved().columns[2]).not.toContain('quickActions');
    const stored = JSON.parse(localStorage.getItem('onexso.dashboard_layout:emp-1')!);
    expect(stored.hidden).toContain('quickActions');
  });

  it('Reset brings back the default in the draft, saved only on Done', () => {
    const service = setup();
    service.startEditing();
    service.toggle('myTasks');
    service.done();
    service.startEditing();
    service.reset();
    expect(service.resolved().columns[1]).toContain('myTasks');
    service.cancel();
    expect(service.resolved().columns[1]).not.toContain('myTasks');
  });

  it('never drops cards the viewer cannot see right now from what it saves', () => {
    const service = setup(caps({ isAvailable: false }));
    service.startEditing();
    service.drop('wellbeing', 'col0', 0);
    service.done();
    const stored = JSON.parse(localStorage.getItem('onexso.dashboard_layout:emp-1')!);
    expect(stored.columns[0]).toContain('teamStatus');
    expect(stored.columns[1]).toContain('actionCenter');
  });

  it('moves with ↑ / ↓ across columns', () => {
    const service = setup();
    service.startEditing();
    service.step('actionCenter', -1);
    expect(service.resolved().columns[0].at(-1)).toBe('actionCenter');
  });

  it('shows the full default on first login, ignoring leftover unscoped or old My Team data', () => {
    localStorage.setItem('onexso.dashboard_layout', JSON.stringify({ ...DEFAULT_DASHBOARD_LAYOUT, hidden: ['notifications', 'wellbeing'] }));
    localStorage.setItem('onexso.my_team_widget_order:emp-1', JSON.stringify(['teamProgress', 'actionCenter']));
    const service = setup();
    expect(service.layout()).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(service.resolved().columns.map((c) => c[0])).toEqual(['todayAtAGlance', 'actionCenter', 'quickActions']);
  });

  it('prefers a saved dashboard layout and falls back to the default on bad data', () => {
    localStorage.setItem('onexso.dashboard_layout:emp-1', '{not json');
    expect(setup().layout()).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('switches layouts when the signed-in employee changes', () => {
    localStorage.setItem('onexso.dashboard_layout:emp-2', JSON.stringify({ ...DEFAULT_DASHBOARD_LAYOUT, hidden: ['myTasks'] }));
    const service = setup();
    expect(service.layout().hidden).toEqual(DEFAULT_DASHBOARD_LAYOUT.hidden);
    employeeId.set('emp-2');
    expect(service.layout().hidden).toEqual(['myTasks']);
  });
});
