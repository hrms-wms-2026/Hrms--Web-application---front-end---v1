import { describe, expect, it } from 'vitest';
import {
  ALL_DASHBOARD_CARD_KEYS,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardCardKey,
  DashboardLayout,
  moveDashboardCard,
  resolveDashboardLayout,
  sanitizeDashboardLayout,
  stepDashboardCard,
  toggleDashboardCard
} from './dashboard-layout.util';

const ALL = new Set<DashboardCardKey>(ALL_DASHBOARD_CARD_KEYS);
/** A layout with every card ticked and My Team heading the columns, for the move / step rules. */
const LAYOUT: DashboardLayout = {
  version: 1,
  top: [],
  columns: [
    ['teamStatus', 'todayAtAGlance', 'todaysSchedule'],
    ['actionCenter', 'myTasks', 'notifications'],
    ['teamProgress', 'quickActions', 'wellbeing']
  ],
  bottom: ['workPattern'],
  hidden: []
};
const allKeys = (layout: DashboardLayout): DashboardCardKey[] =>
  [...layout.top, ...layout.columns.flat(), ...layout.bottom].sort();

describe('default layout', () => {
  it("shows Good morning, Today's Schedule, Action Center, My Tasks, Quick Actions, Team Progress and Work Pattern", () => {
    const shown = resolveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, ALL);
    expect(shown.top).toEqual([]);
    expect(shown.columns).toEqual([['todayAtAGlance', 'todaysSchedule'], ['actionCenter', 'myTasks'], ['quickActions', 'teamProgress']]);
    expect(shown.bottom).toEqual(['workPattern']);
    expect(DEFAULT_DASHBOARD_LAYOUT.hidden).toEqual(['teamStatus', 'notifications', 'wellbeing']);
    expect(allKeys(DEFAULT_DASHBOARD_LAYOUT)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('sanitizeDashboardLayout', () => {
  it('falls back to the default for anything that is not a v1 layout', () => {
    expect(sanitizeDashboardLayout(null)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout({ version: 2 })).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout('nope')).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('drops unknown keys and duplicates, keeps cards wherever they were put, and re-homes missing ones', () => {
    const layout = sanitizeDashboardLayout({
      version: 1,
      top: ['myTasks', 'bogus'],
      columns: [['workPattern', 'wellbeing'], ['wellbeing', 'notifications'], []],
      bottom: [],
      hidden: ['notifications', 'notifications', 'bogus']
    });
    expect(layout.top).toEqual(['myTasks']);
    expect(layout.columns[0]).toEqual(['todayAtAGlance', 'todaysSchedule', 'workPattern', 'wellbeing', 'teamStatus']);
    expect(layout.columns[1]).not.toContain('wellbeing');
    expect(layout.bottom).not.toContain('workPattern');
    expect(layout.hidden).toEqual(['notifications']);
    expect(allKeys(layout)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('resolveDashboardLayout', () => {
  it('shows only ticked cards the viewer is allowed, without touching the stored layout', () => {
    const layout = toggleDashboardCard(LAYOUT, 'wellbeing');
    const dayOnly = new Set(ALL_DASHBOARD_CARD_KEYS.filter((k) => !['teamStatus', 'actionCenter', 'teamProgress'].includes(k)));
    const resolved = resolveDashboardLayout(layout, dayOnly);
    expect(resolved.top).toEqual([]);
    expect(resolved.columns).toEqual([['todayAtAGlance', 'todaysSchedule'], ['myTasks', 'notifications'], ['quickActions']]);
    expect(layout.columns[0]).toContain('teamStatus');
    expect(resolveDashboardLayout(layout, dayOnly, true).columns[2]).toEqual(['quickActions', 'wellbeing']);
  });
});

describe('toggleDashboardCard', () => {
  it('unticks and re-ticks a card in its old place', () => {
    const off = toggleDashboardCard(LAYOUT, 'myTasks');
    expect(off.hidden).toEqual(['myTasks']);
    const on = toggleDashboardCard(off, 'myTasks');
    expect(on.hidden).toEqual([]);
    expect(on.columns[1]).toEqual(LAYOUT.columns[1]);
  });
});

describe('moveDashboardCard', () => {
  it('moves a card into another column at the dropped position', () => {
    const moved = moveDashboardCard(LAYOUT, 'wellbeing', 'col0', 1);
    expect(moved.columns[0]).toEqual(['teamStatus', 'wellbeing', 'todayAtAGlance', 'todaysSchedule']);
    expect(moved.columns[2]).toEqual(['teamProgress', 'quickActions']);
  });

  it('reorders within a column', () => {
    const moved = moveDashboardCard(LAYOUT, 'teamStatus', 'col0', 2);
    expect(moved.columns[0]).toEqual(['todayAtAGlance', 'todaysSchedule', 'teamStatus']);
  });

  it('counts the drop position among visible cards only, keeping invisible ones in place', () => {
    const notTeam = (k: DashboardCardKey) => k !== 'teamStatus';
    const moved = moveDashboardCard(LAYOUT, 'myTasks', 'col0', 0, notTeam);
    expect(moved.columns[0]).toEqual(['teamStatus', 'myTasks', 'todayAtAGlance', 'todaysSchedule']);
  });

  it('puts any card anywhere: a full-width card into a column, a column card into a full-width row', () => {
    const intoColumn = moveDashboardCard(LAYOUT, 'workPattern', 'col1', 0);
    expect(intoColumn.columns[1][0]).toBe('workPattern');
    expect(intoColumn.bottom).toEqual([]);
    const intoRow = moveDashboardCard(LAYOUT, 'myTasks', 'top', 0);
    expect(intoRow.top).toEqual(['myTasks']);
    expect(intoRow.columns[1]).not.toContain('myTasks');
    expect(moveDashboardCard(LAYOUT, 'workPattern', 'top', 0).top).toEqual(['workPattern']);
  });
});

describe('stepDashboardCard', () => {
  it('moves up and down within a column', () => {
    const down = stepDashboardCard(LAYOUT, 'teamStatus', 1);
    expect(down.columns[0]).toEqual(['todayAtAGlance', 'teamStatus', 'todaysSchedule']);
    expect(stepDashboardCard(down, 'teamStatus', -1).columns[0]).toEqual(LAYOUT.columns[0]);
  });

  it('crosses into the neighbouring column at the ends, as the stacked phone layout reads', () => {
    const up = stepDashboardCard(LAYOUT, 'actionCenter', -1);
    expect(up.columns[0]).toEqual(['teamStatus', 'todayAtAGlance', 'todaysSchedule', 'actionCenter']);
    const down = stepDashboardCard(LAYOUT, 'notifications', 1);
    expect(down.columns[2][0]).toBe('notifications');
    expect(stepDashboardCard(LAYOUT, 'teamStatus', -1).top).toEqual(['teamStatus']);
  });

  it('walks every zone in one sequence: top row, columns 1-3, bottom row', () => {
    const up = stepDashboardCard(LAYOUT, 'teamStatus', -1);
    expect(up.top).toEqual(['teamStatus']);
    const back = stepDashboardCard(up, 'teamStatus', 1);
    expect(back.top).toEqual([]);
    expect(back.columns[0][0]).toBe('teamStatus');
    const intoBottom = stepDashboardCard(LAYOUT, 'wellbeing', 1);
    expect(intoBottom.bottom).toEqual(['wellbeing', 'workPattern']);
    expect(stepDashboardCard(LAYOUT, 'workPattern', 1)).toBe(LAYOUT);
    expect(stepDashboardCard(up, 'teamStatus', -1)).toBe(up);
  });
});
