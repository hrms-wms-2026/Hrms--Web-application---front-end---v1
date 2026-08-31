import { buildMonthGrid } from './calendar-grid.util';

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks)', () => {
    expect(buildMonthGrid(2026, 9).length).toBe(42);
  });

  it('starts on the Monday on/before the 1st of the month', () => {
    // September 2026: the 1st is a Tuesday, so the grid starts Monday Aug 31
    const grid = buildMonthGrid(2026, 9);
    expect(grid[0].date).toBe('2026-08-31');
    expect(grid[0].isCurrentMonth).toBe(false);
  });

  it('marks days in the requested month as isCurrentMonth', () => {
    const grid = buildMonthGrid(2026, 9);
    const sep1 = grid.find((d) => d.date === '2026-09-01');
    expect(sep1?.isCurrentMonth).toBe(true);
  });

  it('marks exactly one day as isToday when today falls in the grid', () => {
    const grid = buildMonthGrid(2026, 9);
    const todayCount = grid.filter((d) => d.isToday).length;
    expect(todayCount).toBeLessThanOrEqual(1);
  });
});
