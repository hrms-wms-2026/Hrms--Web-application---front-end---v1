import { describe, expect, it } from 'vitest';
import {
  ALL_DASHBOARD_CARD_KEYS,
  DEFAULT_DASHBOARD_LAYOUT,
  DashboardCardKey,
  DashboardLayout,
  dashboardCardSize,
  moveDashboardCard,
  resolveDashboardLayout,
  sanitizeDashboardLayout,
  setDashboardCardSize,
  stepDashboardCard,
  toggleDashboardCard
} from './dashboard-layout.util';

const ALL = new Set<DashboardCardKey>(ALL_DASHBOARD_CARD_KEYS);
/** A layout with every card ticked, for the move / step rules. */
const LAYOUT: DashboardLayout = {
  version: 2,
  top: [],
  grid: [
    'teamStatus',
    'todayAtAGlance',
    'todaysSchedule',
    'todayTotalTime',
    'activeProjects',
    'actionCenter',
    'myTasks',
    'notifications',
    'teamProgress',
    'quickActions',
    'wellbeing'
  ],
  bottom: ['workPattern'],
  hidden: [],
  sizes: {}
};
const allKeys = (layout: DashboardLayout): DashboardCardKey[] => [...layout.top, ...layout.grid, ...layout.bottom].sort();

describe('default layout', () => {
  it('fills 4-column rows: Good morning (S), Action Center (L), Quick Actions (S); Schedule (L), Total time (S), Active projects (S)', () => {
    const shown = resolveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, ALL);
    expect(shown.top).toEqual([]);
    expect(shown.grid.slice(0, 7)).toEqual([
      'todayAtAGlance',
      'actionCenter',
      'quickActions',
      'todaysSchedule',
      'todayTotalTime',
      'activeProjects',
      'myTasks'
    ]);
    expect(shown.grid.slice(0, 6).map((key) => dashboardCardSize(DEFAULT_DASHBOARD_LAYOUT, key))).toEqual([
      'small',
      'large',
      'small',
      'large',
      'small',
      'small'
    ]);
    expect(shown.bottom).toEqual(['workPattern']);
    expect(DEFAULT_DASHBOARD_LAYOUT.hidden).toEqual(['teamStatus', 'notifications', 'wellbeing']);
    expect(allKeys(DEFAULT_DASHBOARD_LAYOUT)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('sanitizeDashboardLayout', () => {
  it('falls back to the default for anything that is not a v2 layout, including v1 column layouts', () => {
    expect(sanitizeDashboardLayout(null)).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout({ version: 1, top: [], columns: [[], [], []], bottom: [], hidden: [] })).toBe(DEFAULT_DASHBOARD_LAYOUT);
    expect(sanitizeDashboardLayout('nope')).toBe(DEFAULT_DASHBOARD_LAYOUT);
  });

  it('drops unknown keys, duplicates and bad sizes, keeps cards wherever they were put, and re-homes missing ones', () => {
    const layout = sanitizeDashboardLayout({
      version: 2,
      top: ['myTasks', 'bogus'],
      grid: ['workPattern', 'wellbeing', 'wellbeing'],
      bottom: [],
      hidden: ['notifications', 'notifications', 'bogus'],
      sizes: { quickActions: 'large', myTasks: 'huge', bogus: 'small' }
    });
    expect(layout.top).toEqual(['myTasks']);
    expect(layout.grid[0]).toBe('todayAtAGlance');
    expect(layout.grid.indexOf('workPattern')).toBeLessThan(layout.grid.indexOf('wellbeing'));
    expect(layout.grid).toContain('activeProjects');
    expect(layout.bottom).toEqual([]);
    expect(layout.hidden).toEqual(['notifications']);
    expect(layout.sizes).toEqual({ quickActions: 'large' });
    expect(allKeys(layout)).toEqual([...ALL_DASHBOARD_CARD_KEYS].sort());
  });
});

describe('resolveDashboardLayout', () => {
  it('shows only ticked cards the viewer is allowed, without touching the stored layout', () => {
    const layout = toggleDashboardCard(LAYOUT, 'wellbeing');
    const dayOnly = new Set(ALL_DASHBOARD_CARD_KEYS.filter((k) => !['teamStatus', 'actionCenter', 'teamProgress'].includes(k)));
    const resolved = resolveDashboardLayout(layout, dayOnly);
    expect(resolved.grid).toEqual(['todayAtAGlance', 'todaysSchedule', 'todayTotalTime', 'activeProjects', 'myTasks', 'notifications', 'quickActions']);
    expect(layout.grid).toContain('teamStatus');
    expect(resolveDashboardLayout(layout, dayOnly, true).grid.at(-1)).toBe('wellbeing');
  });
});

describe('toggleDashboardCard', () => {
  it('unticks and re-ticks a card in its old place', () => {
    const off = toggleDashboardCard(LAYOUT, 'myTasks');
    expect(off.hidden).toEqual(['myTasks']);
    const on = toggleDashboardCard(off, 'myTasks');
    expect(on.hidden).toEqual([]);
    expect(on.grid).toEqual(LAYOUT.grid);
  });
});

describe('setDashboardCardSize', () => {
  it('stores only sizes that differ from the default', () => {
    const large = setDashboardCardSize(LAYOUT, 'quickActions', 'large');
    expect(dashboardCardSize(large, 'quickActions')).toBe('large');
    expect(large.sizes).toEqual({ quickActions: 'large' });
    const back = setDashboardCardSize(large, 'quickActions', 'small');
    expect(back.sizes).toEqual({});
    expect(dashboardCardSize(back, 'actionCenter')).toBe('large');
  });
});

describe('moveDashboardCard', () => {
  it('reorders within the grid at the dropped position', () => {
    const moved = moveDashboardCard(LAYOUT, 'wellbeing', 'grid', 1);
    expect(moved.grid.slice(0, 3)).toEqual(['teamStatus', 'wellbeing', 'todayAtAGlance']);
    expect(moved.grid).toHaveLength(LAYOUT.grid.length);
  });

  it('counts the drop position among visible cards only, keeping invisible ones in place', () => {
    const notTeam = (k: DashboardCardKey) => k !== 'teamStatus';
    const moved = moveDashboardCard(LAYOUT, 'myTasks', 'grid', 0, notTeam);
    expect(moved.grid.slice(0, 3)).toEqual(['teamStatus', 'myTasks', 'todayAtAGlance']);
  });

  it('puts any card anywhere: a full-width card into the grid, a grid card into a full-width row', () => {
    const intoGrid = moveDashboardCard(LAYOUT, 'workPattern', 'grid', 0);
    expect(intoGrid.grid[0]).toBe('workPattern');
    expect(intoGrid.bottom).toEqual([]);
    const intoRow = moveDashboardCard(LAYOUT, 'myTasks', 'top', 0);
    expect(intoRow.top).toEqual(['myTasks']);
    expect(intoRow.grid).not.toContain('myTasks');
  });
});

describe('stepDashboardCard', () => {
  it('moves forward and back in reading order within the grid', () => {
    const down = stepDashboardCard(LAYOUT, 'teamStatus', 1);
    expect(down.grid.slice(0, 2)).toEqual(['todayAtAGlance', 'teamStatus']);
    expect(stepDashboardCard(down, 'teamStatus', -1).grid).toEqual(LAYOUT.grid);
  });

  it('walks every zone in one sequence: top row, grid, bottom row', () => {
    const up = stepDashboardCard(LAYOUT, 'teamStatus', -1);
    expect(up.top).toEqual(['teamStatus']);
    const back = stepDashboardCard(up, 'teamStatus', 1);
    expect(back.top).toEqual([]);
    expect(back.grid[0]).toBe('teamStatus');
    const intoBottom = stepDashboardCard(LAYOUT, 'wellbeing', 1);
    expect(intoBottom.bottom).toEqual(['wellbeing', 'workPattern']);
    expect(stepDashboardCard(LAYOUT, 'workPattern', 1)).toBe(LAYOUT);
    expect(stepDashboardCard(up, 'teamStatus', -1)).toBe(up);
  });
});
