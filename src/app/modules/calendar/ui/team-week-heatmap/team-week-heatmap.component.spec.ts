import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TeamPlannerMember } from '../../../work/planner/models/team-planner.models';
import { member, personDay } from '../../state/team-planner.testing';
import { TeamWeekHeatmapComponent } from './team-week-heatmap.component';

describe('TeamWeekHeatmap (team planner, approved heatmap)', () => {
  const days = ['2026-11-02', '2026-11-03'];
  const ravi = member('r', 'Ravi Kumar', [personDay(days[0], { blockMinutes: 300, meetingMinutes: 60 }), personDay(days[1], { blockMinutes: 540 })]);
  const mohan = member('m', 'Mohan P.', [personDay(days[0], { onLeave: true, capacityMinutes: 0 }), personDay(days[1])]);
  const dinesh = member('d', 'Dinesh V.', [personDay(days[0]), personDay(days[1])], 3);

  function setup(members: TeamPlannerMember[] = [ravi, mohan, dinesh], narrow = false) {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: narrow, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const fixture = TestBed.createComponent(TeamWeekHeatmapComponent);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('days', days);
    fixture.detectChanges();
    const all = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
    return { fixture, all };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('one cell per member per day with hours and percent', () => {
    const { all } = setup();
    expect(all('heat-cell')).toHaveLength(6);
    const parts = (el: HTMLElement) => [el.querySelector('strong')!.textContent!.trim(), el.querySelector('span')!.textContent!.trim()];
    expect(parts(all('heat-cell')[0])).toEqual(['6h', '75%']);
    expect(all('heat-cell')[1].style.background).toContain('rgb(194, 65, 12)'); // 9h of 8h → over
  });

  it('leave cell says Leave; zero shows — and not planned', () => {
    const { all } = setup();
    expect(all('heat-cell')[2].textContent).toContain('Leave');
    const zero = all('heat-cell')[3];
    expect([zero.querySelector('strong')!.textContent!.trim(), zero.querySelector('span')!.textContent!.trim()]).toEqual(['—', 'not planned']);
  });

  it('a working day with no capacity left reads unavailable, not "not planned"', () => {
    const { all } = setup([member('m', 'Mohan P.', [personDay(days[0], { capacityMinutes: 0 }), personDay(days[1])])]);
    expect(all('heat-cell')[0].querySelector('span')!.textContent!.trim()).toBe('unavailable');
  });

  it('week total is load over capacity, orange when over', () => {
    const { all } = setup();
    expect(all('heat-total')[0].textContent!.replace(/\s+/g, ' ').trim()).toBe('15h / 16h');
    expect(all('heat-total')[1].textContent!.replace(/\s+/g, ' ').trim()).toBe('0h / 8h');
  });

  it('cell click emits cellOpen, name click emits personOpen', () => {
    const { fixture, all } = setup();
    const cell = vi.fn();
    const person = vi.fn();
    fixture.componentInstance.cellOpen.subscribe(cell);
    fixture.componentInstance.personOpen.subscribe(person);
    all('heat-cell')[1].click();
    all('heat-person')[0].click();
    expect(cell).toHaveBeenCalledWith({ employeeId: 'r', date: days[1] });
    expect(person).toHaveBeenCalledWith('r');
  });

  it('View team emits drillDown only for leads', () => {
    const { fixture, all } = setup();
    const drill = vi.fn();
    fixture.componentInstance.drillDown.subscribe(drill);
    expect(all('heat-drill')).toHaveLength(1);
    all('heat-drill')[0].click();
    expect(drill).toHaveBeenCalledWith({ employeeId: 'd', name: 'Dinesh V.' });
  });

  it('narrow screen shows a small coloured chip per day', () => {
    const { all } = setup([ravi], true);
    expect(all('heat-chip')).toHaveLength(2);
    expect(all('heat-cell')).toHaveLength(0);
  });
});
