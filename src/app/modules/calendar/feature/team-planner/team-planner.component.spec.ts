import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { TeamPlannerResponse } from '../../../work/planner/models/team-planner.models';
import { TeamPlannerStore } from '../../state/team-planner.store';
import { member, personDay } from '../../state/team-planner.testing';
import { TeamPlannerComponent } from './team-planner.component';

describe('TeamPlannerComponent (team planner shell)', () => {
  const D = '2026-11-05';
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
  const team: TeamPlannerResponse = { managerEmployeeId: 'me', managerName: 'Suresh M.', from: D, to: D, members: [
    member('a', 'Anjali S.', [personDay(D, { blockMinutes: 540 })]),
    member('d', 'Dinesh V.', [personDay(D, { blockMinutes: 120 })], 3),
  ] };
  const weekTeam: TeamPlannerResponse = { ...team, from: '2026-11-02', to: '2026-11-08',
    members: team.members.map((m) => ({ ...m, days: week.map((d) => personDay(d, { blockMinutes: 240 })) })) };

  function setup(api: Partial<Record<'getTeamDay' | 'getTeamRange' | 'getEmployeeRange', ReturnType<typeof vi.fn>>> = {}) {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const fake = {
      getTeamDay: api.getTeamDay ?? vi.fn(() => of(team)),
      getTeamRange: api.getTeamRange ?? vi.fn(() => of(weekTeam)),
      getEmployeeRange: api.getEmployeeRange ?? vi.fn(() => of({ employeeId: 'd', name: 'Dinesh V.', timezone: 'Asia/Colombo', today: D,
        days: week.map((d) => personDay(d)) })),
    };
    TestBed.configureTestingModule({ imports: [TeamPlannerComponent], providers: [TeamPlannerStore, { provide: PlannerApiService, useValue: fake }] });
    const store = TestBed.inject(TeamPlannerStore);
    store.setDate(D);
    const fixture = TestBed.createComponent(TeamPlannerComponent);
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const all = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
    const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    return { fixture, store, api: fake, q, all, settle };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('day mode renders the columns grid', async () => {
    const { all, settle } = setup();
    await settle();
    expect(all('plan-col-title').map((e) => e.textContent!.trim())).toEqual(['Anjali S.', 'Dinesh V.']);
    expect(all('heat-cell')).toHaveLength(0);
  });

  it('week mode renders the heatmap; a cell click opens that day', async () => {
    const { q, all, settle, store, api } = setup();
    await settle();
    q('team-mode-week')!.click();
    await settle();
    expect(all('heat-cell')).toHaveLength(10);
    all('heat-cell')[1].click();
    await settle();
    expect(store.mode()).toBe('day');
    expect(store.date()).toBe('2026-11-03');
    expect(api.getTeamDay).toHaveBeenLastCalledWith('2026-11-03', null);
  });

  it('a name opens the person view and Back returns', async () => {
    const { q, all, settle, api } = setup();
    await settle();
    all('plan-col-open')[1].click();
    await settle();
    expect(api.getEmployeeRange).toHaveBeenCalledWith('d', '2026-11-02', '2026-11-08');
    expect(q('team-person-title')!.textContent!.trim()).toBe("Dinesh V.'s plan");
    expect(all('plan-col-title')).toHaveLength(5);
    q('team-person-back')!.click();
    await settle();
    expect(q('team-person-title')).toBeNull();
  });

  it('breadcrumb drill-down and back', async () => {
    const { q, all, settle, api } = setup();
    await settle();
    q('team-mode-week')!.click();
    await settle();
    all('heat-drill')[0].click();
    await settle();
    expect(api.getTeamRange).toHaveBeenLastCalledWith('2026-11-02', '2026-11-08', 'd');
    expect(all('team-crumb').map((e) => e.textContent!.trim())).toEqual(['My team', 'Dinesh V.']);
    all('team-crumb')[0].click();
    await settle();
    expect(api.getTeamRange).toHaveBeenLastCalledWith('2026-11-02', '2026-11-08', null);
  });

  it('filter chip shows its count and toggles', async () => {
    const { q, all, settle } = setup();
    await settle();
    expect(q('team-filter-over')!.textContent).toContain('1');
    q('team-filter-over')!.click();
    await settle();
    expect(all('plan-col-title').map((e) => e.textContent!.trim())).toEqual(['Anjali S.']);
    expect(q('team-filter-over')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('no reports state', async () => {
    const { q, settle } = setup({ getTeamDay: vi.fn(() => of({ ...team, members: [] })) });
    await settle();
    expect(q('team-empty')!.textContent).toContain('No direct reports');
    expect(q('team-empty')!.textContent).toContain('Team view is available to managers with direct reports.');
  });

  it('nobody planned shows a note above the grid', async () => {
    const { q, settle } = setup({ getTeamDay: vi.fn(() => of({ ...team, members: [member('n', 'Nila T.', [personDay(D)])] })) });
    await settle();
    expect(q('team-unplanned')!.textContent!.trim()).toBe('No one has planned this day');
  });

  it('error state retries', async () => {
    const calls = [throwError(() => new Error('down')), of(team)];
    const { q, all, settle } = setup({ getTeamDay: vi.fn(() => calls.shift()!) });
    await settle();
    expect(q('team-error')!.textContent).toContain('Unable to load team plan');
    q('team-retry')!.click();
    await settle();
    expect(all('plan-col-title')).toHaveLength(2);
  });

  it('loading shows skeleton rows', async () => {
    const pending = new Subject<TeamPlannerResponse>();
    const { all, fixture } = setup({ getTeamDay: vi.fn(() => pending.asObservable()) });
    fixture.detectChanges();
    expect(all('team-skeleton')).toHaveLength(3);
    pending.complete();
  });
});
