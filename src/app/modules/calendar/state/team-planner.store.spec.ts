import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlannerApiService } from '../../work/planner/data-access/planner-api.service';
import { TeamPlannerResponse } from '../../work/planner/models/team-planner.models';
import { member, personDay } from './team-planner.testing';
import { TeamPlannerStore } from './team-planner.store';

describe('TeamPlannerStore', () => {
  const D = '2026-11-05'; // Thursday
  // over / under / on leave / not planned on D.
  const team: TeamPlannerResponse = {
    managerEmployeeId: 'me', managerName: 'Suresh M.', from: D, to: D, members: [
      member('a', 'Anjali S.', [personDay(D, { blockMinutes: 480, meetingMinutes: 60 })]),
      member('m', 'Mohan P.', [personDay(D, { onLeave: true, capacityMinutes: 0 })]),
      member('n', 'Nila T.', [personDay(D)]),
      member('r', 'Ravi Kumar', [personDay(D, { blockMinutes: 120 })], 1),
    ],
  };

  function setup(api: Partial<Record<'getTeamDay' | 'getTeamRange' | 'getEmployeeRange', ReturnType<typeof vi.fn>>> = {}) {
    const fake = {
      getTeamDay: api.getTeamDay ?? vi.fn(() => of(team)),
      getTeamRange: api.getTeamRange ?? vi.fn(() => of({ ...team, from: '2026-11-02', to: '2026-11-08' })),
      getEmployeeRange: api.getEmployeeRange ?? vi.fn(() => of({ employeeId: 'r', name: 'Ravi Kumar', timezone: 'Asia/Colombo',
        today: D, days: [personDay('2026-11-02')] })),
    };
    TestBed.configureTestingModule({ providers: [TeamPlannerStore, { provide: PlannerApiService, useValue: fake }] });
    const store = TestBed.inject(TeamPlannerStore);
    store.setDate(D);
    return { store, api: fake };
  }

  it('loads the day for date and null manager', async () => {
    const { store, api } = setup();
    await store.load();
    expect(api.getTeamDay).toHaveBeenLastCalledWith(D, null);
    expect(store.response()?.members).toHaveLength(4);
    expect(store.loading()).toBe(false);
  });

  it('week mode asks Monday–Sunday', async () => {
    const { store, api } = setup();
    await store.setMode('week');
    expect(api.getTeamRange).toHaveBeenLastCalledWith('2026-11-02', '2026-11-08', null);
  });

  it('step moves a day in day mode and a week in week mode', async () => {
    const { store } = setup();
    await store.step(1);
    expect(store.date()).toBe('2026-11-06');
    await store.setMode('week');
    await store.step(-1);
    expect(store.date()).toBe('2026-10-30');
  });

  it('drillDown pushes the trail and reloads with managerId; backTo(0) returns to my team', async () => {
    const { store, api } = setup();
    await store.drillDown('r', 'Ravi Kumar');
    expect(store.trail().map((s) => s.name)).toEqual(['My team', 'Ravi Kumar']);
    expect(api.getTeamDay).toHaveBeenLastCalledWith(D, 'r');
    await store.backTo(0);
    expect(store.trail()).toHaveLength(1);
    expect(api.getTeamDay).toHaveBeenLastCalledWith(D, null);
  });

  it('ignores a stale response', async () => {
    const slow = new Subject<TeamPlannerResponse>();
    const calls = [slow.asObservable(), of({ ...team, members: [team.members[0]] })];
    const { store } = setup({ getTeamDay: vi.fn(() => calls.shift()!) });
    const first = store.load();
    await store.load();
    slow.next(team);
    slow.complete();
    await first;
    expect(store.response()?.members).toHaveLength(1);
  });

  it('counts and filters (OR-ed)', async () => {
    const { store } = setup();
    await store.load();
    expect(store.counts()).toEqual({ over: 1, under: 1, leave: 1, notPlanned: 1 });
    store.filters.set(new Set(['over', 'leave']));
    expect(store.visibleMembers().map((m) => m.employeeId)).toEqual(['a', 'm']);
  });

  // Review finding 2: leave masked as busy (no leave:read) leaves a working day with no capacity; that is not "Not planned".
  it('a working day with no capacity left is not counted as Not planned', async () => {
    const masked = { ...team, members: [member('m', 'Mohan P.', [personDay(D, { capacityMinutes: 0 })])] };
    const { store } = setup({ getTeamDay: vi.fn(() => of(masked)) });
    await store.load();
    expect(store.counts().notPlanned).toBe(0);
  });

  it('sort loadDesc puts the fullest first; search is case-insensitive', async () => {
    const { store } = setup();
    await store.load();
    store.sort.set('loadDesc');
    expect(store.visibleMembers()[0].employeeId).toBe('a');
    store.search.set('RAVI');
    expect(store.visibleMembers().map((m) => m.employeeId)).toEqual(['r']);
  });

  it('week days hide days nobody works', async () => {
    const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];
    const days = week.map((d, i) => personDay(d, i >= 5 ? { workingMinutes: 0, capacityMinutes: 0 } : {}));
    const { store } = setup({ getTeamRange: vi.fn(() => of({ ...team, from: week[0], to: week[6], members: [member('n', 'Nila T.', days)] })) });
    await store.setMode('week');
    expect(store.weekDays()).toEqual(week.slice(0, 5));
  });

  it('openPerson loads that employee\'s week; closePerson clears it', async () => {
    const { store, api } = setup();
    await store.openPerson('r');
    expect(api.getEmployeeRange).toHaveBeenLastCalledWith('r', '2026-11-02', '2026-11-08');
    expect(store.person()?.name).toBe('Ravi Kumar');
    store.closePerson();
    expect(store.person()).toBeNull();
  });

  it('an error says "Unable to load team plan"', async () => {
    const { store } = setup({ getTeamDay: vi.fn(() => throwError(() => new Error('down'))) });
    await store.load();
    expect(store.error()).toBe('Unable to load team plan');
    expect(store.loading()).toBe(false);
  });
});
