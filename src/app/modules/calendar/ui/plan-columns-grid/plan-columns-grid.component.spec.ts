import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PlannerMeetingView } from '../../../work/planner/models/planner.models';
import { member, personDay } from '../../state/team-planner.testing';
import { PlanColumn, memberColumn, planItemsOf } from './plan-columns';
import { PlanColumnsGridComponent } from './plan-columns-grid.component';

const D = '2026-11-05';

function meeting(over: Partial<PlannerMeetingView>): PlannerMeetingView {
  return { taskId: 'mt', seriesId: 's', originalStart: `${D}T04:30:00Z`, startAt: `${D}T04:30:00Z`, endAt: `${D}T05:00:00Z`,
    title: 'Stand-up', isPrivate: false, cancelled: false, declined: false, plannedMinutes: 30, actualMinutes: 0, ...over };
}

describe('PlanColumnsGrid (team planner)', () => {
  function setup(columns: PlanColumn[], narrow = false) {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: narrow, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const fixture = TestBed.createComponent(PlanColumnsGridComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    fixture.detectChanges();
    const all = (id: string) => Array.from(fixture.nativeElement.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
    return { fixture, all };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('renders one column per PlanColumn with name and load label', () => {
    const ravi = memberColumn(member('r', 'Ravi Kumar', [personDay(D, { blockMinutes: 360 })]), D, 'Asia/Colombo');
    const { all } = setup([ravi, memberColumn(member('a', 'Anjali S.', [personDay(D)]), D, 'Asia/Colombo')]);
    expect(all('plan-col-title').map((e) => e.textContent!.trim())).toEqual(['Ravi Kumar', 'Anjali S.']);
    expect(all('plan-col-load')[0].textContent!.trim()).toBe('6h / 8h');
  });

  it('positions an item by instant in the viewer zone', () => {
    // 09:00 in Dubai is 10:30 in Colombo: (10.5 − 7) × 72 = 252px from the top of a 07:00 grid.
    const day = personDay(D, { blocks: [{ id: 'b1', taskId: 't1', projectId: 'p', taskTitle: 'API-4 Webhooks', startAt: '2026-11-05T09:00:00+04:00',
      endAt: '2026-11-05T11:00:00+04:00', plannedMinutes: 120, actualMinutes: 0, stillAssigned: true }] });
    const { all } = setup([memberColumn({ ...member('k', 'Kavin R.', [day]), timezone: 'Asia/Dubai' }, D, 'Asia/Colombo')]);
    const item = all('plan-item')[0];
    expect(item.style.top).toBe('252px');
    expect(item.style.height).toBe('144px');
  });

  it('draws a private meeting as Busy and a cancelled one not at all', () => {
    const items = planItemsOf(personDay(D, { meetings: [meeting({ isPrivate: true, title: 'Private meeting' }), meeting({ taskId: 'c', cancelled: true })] }));
    expect(items).toEqual([expect.objectContaining({ kind: 'busy', label: 'Busy' })]);
  });

  it('draws approved, pending and busy leave', () => {
    const items = planItemsOf(personDay(D, { leaves: [
      { startAt: `${D}T03:30:00Z`, endAt: `${D}T07:30:00Z`, status: 'approved' },
      { startAt: `${D}T08:30:00Z`, endAt: `${D}T11:30:00Z`, status: 'pending' },
      { startAt: `${D}T12:00:00Z`, endAt: `${D}T13:00:00Z`, status: 'busy' },
    ] }));
    expect(items.map((i) => [i.kind, i.label])).toEqual([['leave', 'Leave'], ['leavePending', 'Leave (pending)'], ['busy', 'Busy']]);
  });

  it('shades off-hours before and after the work window, and a whole non-working day', () => {
    const working = memberColumn(member('r', 'Ravi Kumar', [personDay(D)]), D, 'Asia/Colombo');
    const off = memberColumn(member('n', 'Nila T.', [personDay(D, { workStartAt: null, workEndAt: null, workingMinutes: 0, capacityMinutes: 0 })]), D, 'Asia/Colombo');
    const { all } = setup([working, off]);
    expect(all('plan-off').length).toBe(3);
  });

  it('header click emits columnOpen(key)', () => {
    const { fixture, all } = setup([memberColumn(member('r', 'Ravi Kumar', [personDay(D)]), D, 'Asia/Colombo')]);
    const spy = vi.fn();
    fixture.componentInstance.columnOpen.subscribe(spy);
    all('plan-col-open')[0].click();
    expect(spy).toHaveBeenCalledWith('r');
  });

  it('a lead shows "Lead · N reports" and another zone shows under the name', () => {
    const col = memberColumn({ ...member('d', 'Dinesh V.', [personDay(D)], 3), timezone: 'Asia/Dubai' }, D, 'Asia/Colombo');
    expect(col.subtitle).toBe('Lead · 3 reports · Dubai time');
  });

  it('narrow screen shows cards instead of the grid', () => {
    const { all } = setup([memberColumn(member('r', 'Ravi Kumar', [personDay(D, { blocks: [{ id: 'b', taskId: 't', projectId: 'p', taskTitle: 'WEB-12',
      startAt: `${D}T03:30:00Z`, endAt: `${D}T05:30:00Z`, plannedMinutes: 120, actualMinutes: 0, stillAssigned: true }] })]), D, 'Asia/Colombo')], true);
    expect(all('plan-card').length).toBe(1);
    expect(all('plan-item').length).toBe(0);
    expect(all('plan-card-item')[0].textContent).toContain('09:00');
  });
});
