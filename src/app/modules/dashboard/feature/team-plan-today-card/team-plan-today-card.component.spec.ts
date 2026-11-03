import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { member, personDay } from '../../../calendar/state/team-planner.testing';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { TeamPlannerResponse } from '../../../work/planner/models/team-planner.models';
import { TeamPlanTodayCardComponent } from './team-plan-today-card.component';

describe('TeamPlanTodayCard (My Team widget, team planner 2026-11-03)', () => {
  const D = '2026-11-05';
  const team: TeamPlannerResponse = { managerEmployeeId: 'me', managerName: 'Suresh M.', from: D, to: D, members: [
    member('r', 'Ravi Kumar', [personDay(D, { blockMinutes: 300, meetingMinutes: 60 })]),
    member('m', 'Mohan P.', [personDay(D, { onLeave: true, capacityMinutes: 0 })]),
    member('n', 'Nila T.', [personDay(D)]),
    member('a', 'Anjali S.', [personDay(D, { blockMinutes: 480 })]),
    member('k', 'Kavin R.', [personDay(D, { blockMinutes: 60 })]),
  ] };

  async function setup(getTeamDay: ReturnType<typeof vi.fn> = vi.fn(() => of(team))) {
    TestBed.configureTestingModule({
      imports: [TeamPlanTodayCardComponent],
      providers: [provideRouter([]), { provide: PlannerApiService, useValue: { getTeamDay } }],
    });
    const fixture = TestBed.createComponent(TeamPlanTodayCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const all = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
    return { fixture, q, all, getTeamDay };
  }

  it("lists members with today's load", async () => {
    const { all, getTeamDay } = await setup();
    expect(getTeamDay).toHaveBeenCalledWith(null, null);
    expect(all('tpt-name').map((e) => e.textContent!.trim())).toEqual(['Ravi Kumar', 'Mohan P.', 'Nila T.', 'Anjali S.', 'Kavin R.']);
    expect(all('tpt-load')[0].textContent!.trim()).toBe('6h / 8h');
  });

  it('on leave and not planned chips', async () => {
    const { all } = await setup();
    expect(all('tpt-chip').map((e) => e.textContent!.trim())).toEqual(['On leave', 'Not planned']);
  });

  it('open team planner link', async () => {
    const { q } = await setup();
    const link = q('tpt-open') as HTMLAnchorElement;
    expect(link.textContent).toContain('Open team planner');
    expect(link.getAttribute('href')).toBe('/planner?scope=team&teamView=day');
  });

  it('a row navigates to that person', async () => {
    const { all } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    all('tpt-row')[0].click();
    expect(navigate).toHaveBeenCalledWith(['/planner'], { queryParams: { scope: 'team', teamView: 'day', person: 'r' } });
  });

  it('compact shows 4 rows and +N more', async () => {
    const { fixture, all, q } = await setup();
    fixture.componentInstance.compact.set(true);
    fixture.detectChanges();
    expect(all('tpt-row')).toHaveLength(4);
    expect(q('tpt-more')!.textContent!.trim()).toBe('+1 more');
  });

  it('an error retries', async () => {
    const calls = [throwError(() => new HttpErrorResponse({ status: 500 })), of(team)];
    const { fixture, q, all } = await setup(vi.fn(() => calls.shift()!));
    expect(q('tpt-error')!.textContent).toContain('Unable to load team plan');
    q('tpt-retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(all('tpt-row')).toHaveLength(5);
  });

  it('planner off says so', async () => {
    const { q } = await setup(vi.fn(() => throwError(() => new HttpErrorResponse({ status: 503, error: { code: 'planner_disabled' } }))));
    expect(q('tpt-off')!.textContent!.trim()).toBe('Planner is off');
  });
});
