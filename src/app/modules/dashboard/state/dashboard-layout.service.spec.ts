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

  it('starts from the default layout: Action Center kept, Team Status and Team Progress left to My Team', () => {
    const service = setup();
    expect(service.resolved().top).toEqual([]);
    expect(service.resolved().grid).toEqual(['todayAtAGlance', 'actionCenter', 'quickActions', 'todaysSchedule', 'todayTotalTime', 'activeProjects', 'myTasks']);
    expect(service.resolved().bottom).toEqual(['workPattern']);
  });

  it('keeps Team Status and Team Progress off the home dashboard, even for a team lead', () => {
    const service = setup(caps());
    const shown = [...service.resolved().top, ...service.resolved().grid, ...service.resolved().bottom];
    expect(shown).not.toContain('teamStatus');
    expect(shown).not.toContain('teamProgress');
    expect(service.customizeGroups().find((g) => g.id === 'team')!.keys).toEqual(['actionCenter']);
  });

  it('shows no My Team cards or My Team group to a viewer without My Team', () => {
    const service = setup(caps({ isAvailable: false }));
    expect(service.resolved().grid).not.toContain('actionCenter');
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
    expect(service.resolved().grid).not.toContain('quickActions');
    service.cancel();
    expect(service.resolved().grid).toContain('quickActions');

    service.startEditing();
    service.toggle('quickActions');
    service.drop('myTasks', 'grid', 0);
    service.done();
    expect(service.editing()).toBe(false);
    expect(service.resolved().grid[0]).toBe('myTasks');
    expect(service.resolved().grid).not.toContain('quickActions');
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
    expect(service.resolved().grid).toContain('myTasks');
    service.cancel();
    expect(service.resolved().grid).not.toContain('myTasks');
  });

  it('never drops cards the viewer cannot see right now from what it saves', () => {
    const service = setup(caps({ isAvailable: false }));
    service.startEditing();
    service.drop('wellbeing', 'grid', 0);
    service.done();
    const stored = JSON.parse(localStorage.getItem('onexso.dashboard_layout:emp-1')!);
    expect(stored.grid).toContain('teamStatus');
    expect(stored.grid).toContain('actionCenter');
    expect(stored.grid[0]).toBe('wellbeing');
  });

  it('moves with ↑ / ↓ in reading order', () => {
    const service = setup();
    service.startEditing();
    service.step('actionCenter', -1);
    expect(service.resolved().grid.slice(0, 2)).toEqual(['actionCenter', 'todayAtAGlance']);
  });

  it('sets a card Small or Large in the draft and saves it on Done', () => {
    const service = setup();
    expect(service.sizeOf('quickActions')).toBe('small');
    service.setSize('quickActions', 'large');
    expect(service.sizeOf('quickActions')).toBe('small');
    service.startEditing();
    service.setSize('quickActions', 'large');
    expect(service.sizeOf('quickActions')).toBe('large');
    service.done();
    const stored = JSON.parse(localStorage.getItem('onexso.dashboard_layout:emp-1')!);
    expect(stored.sizes).toEqual({ quickActions: 'large' });
    service.startEditing();
    service.reset();
    expect(service.sizeOf('quickActions')).toBe('small');
  });

  it('shows the full default on first login, ignoring leftover unscoped or old My Team data', () => {
    localStorage.setItem('onexso.dashboard_layout', JSON.stringify({ ...DEFAULT_DASHBOARD_LAYOUT, hidden: ['notifications', 'wellbeing'] }));
    localStorage.setItem('onexso.my_team_widget_order:emp-1', JSON.stringify(['teamProgress', 'actionCenter']));
    const service = setup();
    expect(service.layout()).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(service.resolved().grid.slice(0, 3)).toEqual(['todayAtAGlance', 'actionCenter', 'quickActions']);
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
