import { describe, expect, it } from 'vitest';
import {
  ALL_DASHBOARD_CARD_KEYS,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardCardKey,
  DashboardLayout,
  migrateFromMyTeamPreference,
  moveDashboardCard,
  resolveDashboardLayout,
  sanitizeDashboardLayout,
  stepDashboardCard,
  toggleDashboardCard
} from './dashboard-layout.util';

const ALL = new Set<DashboardCardKey>(ALL_DASHBOARD_CARD_KEYS);
const allKeys = (layout: DashboardLayout): DashboardCardKey[] =>
  [...layout.top, ...layout.columns.flat(), ...layout.bottom].sort();

describe('default layout', () => {
  it('puts My Team on top: KPI tiles, then a team card heading each column', () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.top).toEqual(['teamKpis']);
    expect(DEFAULT_DASHBOARD_LAYOUT.columns.map((c) => c[0])).toEqual(['teamStatus', 'actionCenter', 'teamProgress']);
    expect(DEFAULT_DASHBOARD_LAYOUT.bottom).toEqual(['workPattern']);
    expect(allKeys(DEFAULT_DASHBOARD_LAYOUT)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('sanitizeDashboardLayout', () => {
  it('falls back to the default for anything that is not a v1 layout', () => {
    expect(sanitizeDashboardLayout(null)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout({ version: 2 })).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout('nope')).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('drops unknown keys and duplicates, fixes wrong-width placements, and re-homes missing cards', () => {
    const layout = sanitizeDashboardLayout({
      version: 1,
      top: ['myTasks', 'bogus'],
      columns: [['workPattern', 'wellbeing'], ['wellbeing', 'notifications'], []],
      bottom: [],
      hidden: ['notifications', 'notifications', 'bogus']
    });
    expect(layout.columns[0]).toContain('myTasks');
    expect(layout.columns[0].indexOf('wellbeing')).toBeGreaterThanOrEqual(0);
    expect(layout.columns[1]).toEqual(expect.arrayContaining(['notifications']));
    expect(layout.columns[1]).not.toContain('wellbeing');
    expect(layout.bottom).toContain('workPattern');
    expect(layout.top).toEqual(['teamKpis']);
    expect(layout.hidden).toEqual(['notifications']);
    expect(allKeys(layout)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('migrateFromMyTeamPreference', () => {
  it('heads the columns with the old visible order and keeps old hidden team cards hidden', () => {
    const layout = migrateFromMyTeamPreference(['actionCenter', 'teamProgress']);
    expect(layout.columns.map((c) => c[0])).toEqual(['actionCenter', 'teamProgress', 'teamStatus']);
    expect(layout.hidden).toEqual(['teamStatus']);
    expect(allKeys(layout)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('resolveDashboardLayout', () => {
  it('shows only ticked cards the viewer is allowed, without touching the stored layout', () => {
    const layout = toggleDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'wellbeing');
    const dayOnly = new Set(ALL_DASHBOARD_CARD_KEYS.filter((k) => !['teamKpis', 'teamStatus', 'actionCenter', 'teamProgress'].includes(k)));
    const resolved = resolveDashboardLayout(layout, dayOnly);
    expect(resolved.top).toEqual([]);
    expect(resolved.columns).toEqual([['todayAtAGlance', 'todaysSchedule'], ['myTasks', 'notifications'], ['quickActions']]);
    expect(layout.columns[0]).toContain('teamStatus');
    expect(resolveDashboardLayout(layout, dayOnly, true).columns[2]).toEqual(['quickActions', 'wellbeing']);
  });
});

describe('toggleDashboardCard', () => {
  it('unticks and re-ticks a card in its old place', () => {
    const off = toggleDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'myTasks');
    expect(off.hidden).toEqual(['myTasks']);
    const on = toggleDashboardCard(off, 'myTasks');
    expect(on.hidden).toEqual([]);
    expect(on.columns[1]).toEqual(DEFAULT_DASHBOARD_LAYOUT.columns[1]);
  });
});

describe('moveDashboardCard', () => {
  it('moves a card into another column at the dropped position', () => {
    const moved = moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'wellbeing', 'col0', 1);
    expect(moved.columns[0]).toEqual(['teamStatus', 'wellbeing', 'todayAtAGlance', 'todaysSchedule']);
    expect(moved.columns[2]).toEqual(['teamProgress', 'quickActions']);
  });

  it('reorders within a column', () => {
    const moved = moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'teamStatus', 'col0', 2);
    expect(moved.columns[0]).toEqual(['todayAtAGlance', 'todaysSchedule', 'teamStatus']);
  });

  it('counts the drop position among visible cards only, keeping invisible ones in place', () => {
    const notTeam = (k: DashboardCardKey) => k !== 'teamStatus';
    const moved = moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'myTasks', 'col0', 0, notTeam);
    expect(moved.columns[0]).toEqual(['teamStatus', 'myTasks', 'todayAtAGlance', 'todaysSchedule']);
  });

  it('never puts a full-width card in a column, or a column card in a band', () => {
    expect(moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'workPattern', 'col1', 0)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'myTasks', 'top', 0)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(moveDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'workPattern', 'top', 0).top).toEqual(['workPattern', 'teamKpis']);
  });
});

describe('stepDashboardCard', () => {
  it('moves up and down within a column', () => {
    const down = stepDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'teamStatus', 1);
    expect(down.columns[0]).toEqual(['todayAtAGlance', 'teamStatus', 'todaysSchedule']);
    expect(stepDashboardCard(down, 'teamStatus', -1).columns[0]).toEqual(DEFAULT_DASHBOARD_LAYOUT.columns[0]);
  });

  it('crosses into the neighbouring column at the ends, as the stacked phone layout reads', () => {
    const up = stepDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'actionCenter', -1);
    expect(up.columns[0]).toEqual(['teamStatus', 'todayAtAGlance', 'todaysSchedule', 'actionCenter']);
    const down = stepDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'notifications', 1);
    expect(down.columns[2][0]).toBe('notifications');
    expect(stepDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'teamStatus', -1)).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('moves full-width cards between the top and bottom bands only', () => {
    const down = stepDashboardCard(DEFAULT_DASHBOARD_LAYOUT, 'teamKpis', 1);
    expect(down.top).toEqual([]);
    expect(down.bottom).toEqual(['teamKpis', 'workPattern']);
  });
});
