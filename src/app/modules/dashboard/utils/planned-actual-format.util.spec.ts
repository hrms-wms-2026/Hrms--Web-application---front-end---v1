import { describe, expect, it } from 'vitest';
import {
  PlannedActualRow,
  plannedActualScale,
  plannedActualTiles,
  summarizePlannedActual,
} from './planned-actual-format.util';

const row = (over: Partial<PlannedActualRow> = {}): PlannedActualRow => ({
  id: 'a',
  label: 'Ada',
  planned: 0,
  scheduled: 0,
  outside: 0,
  noPlan: 0,
  ...over,
});

describe('planned vs actual format', () => {
  it('summarizes planned, actual (all clocked), in plan % and unscheduled', () => {
    const s = summarizePlannedActual([
      row({ planned: 240, scheduled: 120, outside: 30, noPlan: 30 }),
      row({ id: 'b', planned: 60, scheduled: 60 }),
    ]);
    expect(s).toEqual({ planned: 300, actual: 240, inPlanPercent: 75, unscheduled: 60 });
  });

  it('in plan % is null without actual time, never 0% or 100%', () => {
    expect(summarizePlannedActual([row({ planned: 120 })]).inPlanPercent).toBeNull();
    expect(summarizePlannedActual([]).inPlanPercent).toBeNull();
  });

  it('scale covers overtime: the larger of planned and actual, at least 1', () => {
    expect(plannedActualScale([row({ planned: 60, scheduled: 100, noPlan: 50 })])).toBe(150);
    expect(
      plannedActualScale([row({ planned: 200, scheduled: 10 }), row({ planned: 20, outside: 90 })]),
    ).toBe(200);
    expect(plannedActualScale([])).toBe(1);
  });

  it('tiles: Planned, Actual, In plan, Unscheduled', () => {
    const tiles = plannedActualTiles({
      planned: 300,
      actual: 240,
      inPlanPercent: 75,
      unscheduled: 60,
    });
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Planned', '5h'],
      ['Actual', '4h'],
      ['In plan', '75%'],
      ['Unscheduled', '1h'],
    ]);
    expect(tiles.every((t) => t.hint === undefined)).toBe(true);
  });

  it('tiles show vs last week hints', () => {
    const tiles = plannedActualTiles(
      { planned: 300, actual: 240, inPlanPercent: 75, unscheduled: 60 },
      { planned: 240, actual: 300, inPlanPercent: 70, unscheduled: 60 },
    );
    expect(tiles.map((t) => t.hint)).toEqual([
      '↑ 1h vs last week',
      '↓ 1h vs last week',
      '↑ 5 pts vs last week',
      '→ same as last week',
    ]);
  });

  it('a missing in plan % reads "—" and gets no comparison', () => {
    const tiles = plannedActualTiles(
      { planned: 60, actual: 0, inPlanPercent: null, unscheduled: 0 },
      { planned: 60, actual: 60, inPlanPercent: 50, unscheduled: 0 },
    );
    expect(tiles[2].value).toBe('—');
    expect(tiles[2].hint).toBeUndefined();
  });
});
