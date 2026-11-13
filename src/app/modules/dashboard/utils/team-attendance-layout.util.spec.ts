import { describe, expect, it } from 'vitest';
import { classifyTeamAttendanceSize, planTeamAttendanceLayout, resolveTeamAttendanceView } from './team-attendance-layout.util';

/** Card host height for a number of grid rows (96px rows, 12px gaps). */
const rows = (n: number) => n * 96 + (n - 1) * 12;

describe('team attendance layout', () => {
  it.each([
    [350, 350, 'standard'],
    [760, 350, 'standard'],
    [760, 640, 'standard'],
    [1200, 800, 'standard'],
    [300, 640, 'xs'],
    [206, 420, 'xs'],
    [315, 312, 'xs'],
    [760, 240, 'mini'],
    [206, 204, 'mini'],
    [292, 204, 'mini']
  ] as const)('%ix%i is %s', (w, h, view) => {
    expect(classifyTeamAttendanceSize(w, h)).toBe(view);
  });

  it('keeps the previous view within the hysteresis band', () => {
    expect(resolveTeamAttendanceView(340, 400, 'xs')).toBe('xs');
    expect(resolveTeamAttendanceView(400, 400, 'xs')).toBe('standard');
  });

  it('keeps the previous view (or standard) for a zero size', () => {
    expect(resolveTeamAttendanceView(0, 0, 'xs')).toBe('xs');
    expect(resolveTeamAttendanceView(0, 300, null)).toBe('standard');
  });

  it('mini adds nothing under the donut', () => {
    expect(planTeamAttendanceLayout('mini', 760, rows(2))).toEqual({ heroTrend: false, legend: false, figure: false, tiles: false, tileColumns: 4, trend: false, rankingRows: 0 });
  });

  it('standard: a taller card adds the tiles, then the trend, then the ranking (never the other way round)', () => {
    const w = 640;
    expect(planTeamAttendanceLayout('standard', w, rows(3))).toMatchObject({ tiles: false, trend: false, rankingRows: 0 });
    expect(planTeamAttendanceLayout('standard', w, rows(4))).toMatchObject({ tiles: true, tileColumns: 4, trend: false, rankingRows: 0 });
    expect(planTeamAttendanceLayout('standard', w, rows(5))).toMatchObject({ tiles: true, trend: true, rankingRows: 0 });
    expect(planTeamAttendanceLayout('standard', w, rows(6))).toMatchObject({ tiles: true, trend: true, rankingRows: 0 });
    expect(planTeamAttendanceLayout('standard', w, rows(7))).toMatchObject({ tiles: true, trend: true, rankingRows: 5 });
    expect(planTeamAttendanceLayout('standard', w, rows(8)).rankingRows).toBeGreaterThan(3);
    expect(planTeamAttendanceLayout('standard', w, 5000).rankingRows).toBe(10);
  });

  it('standard on a wide card puts the trend beside the donut, so the ranking comes straight after the tiles', () => {
    expect(planTeamAttendanceLayout('standard', 1200, rows(3))).toMatchObject({ heroTrend: true, trend: false });
    expect(planTeamAttendanceLayout('standard', 1200, rows(5))).toMatchObject({ heroTrend: true, tiles: true, trend: false });
    expect(planTeamAttendanceLayout('standard', 1200, rows(5)).rankingRows).toBeGreaterThanOrEqual(3);
    expect(planTeamAttendanceLayout('standard', 760, rows(3)).heroTrend).toBe(false);
    expect(planTeamAttendanceLayout('xs', 320, rows(8)).heroTrend).toBe(false);
  });

  it('standard on a narrower card puts the tiles two by two', () => {
    expect(planTeamAttendanceLayout('standard', 400, rows(4))).toMatchObject({ tiles: true, tileColumns: 2 });
  });

  it('xs: the donut alone at 3 rows, its legend from 4, the rate from 5, the trend from 6, the ranking after that', () => {
    expect(planTeamAttendanceLayout('xs', 315, rows(3))).toMatchObject({ legend: false, figure: false, tiles: false, trend: false, rankingRows: 0 });
    expect(planTeamAttendanceLayout('xs', 315, rows(4))).toMatchObject({ legend: true, figure: false, tiles: false, trend: false });
    expect(planTeamAttendanceLayout('xs', 315, rows(5))).toMatchObject({ legend: true, figure: true, tiles: false, trend: false });
    expect(planTeamAttendanceLayout('xs', 315, rows(6))).toMatchObject({ legend: true, tiles: false, trend: true, rankingRows: 0 });
    expect(planTeamAttendanceLayout('xs', 315, rows(8)).rankingRows).toBeGreaterThanOrEqual(3);
  });

  it('budgets a taller summary-cards row in the tiles place when asked', () => {
    expect(planTeamAttendanceLayout('standard', 760, 528).trend).toBe(true);
    const withCards = planTeamAttendanceLayout('standard', 760, 528, 140);
    expect(withCards.tiles).toBe(true);
    expect(withCards.trend).toBe(false);
    expect(planTeamAttendanceLayout('standard', 760, 420, 140).tiles).toBe(false);
  });

  it('a wide card moves the range into the header, so 4 rows fit the summary-cards row under the hero', () => {
    // 912 x 420 (8 x 4 at 1440px): donut 168 + gap 12 + row 140 = 320 of a 352px body.
    expect(planTeamAttendanceLayout('standard', 912, rows(4), 140)).toMatchObject({ heroTrend: true, tiles: true });
    // ...and 3 rows now fit the status tiles under the donut.
    expect(planTeamAttendanceLayout('standard', 912, rows(3))).toMatchObject({ heroTrend: true, tiles: true });
    // A narrower card keeps the range above the donut and has no room for the row at 4 rows.
    expect(planTeamAttendanceLayout('standard', 760, rows(4), 140).tiles).toBe(false);
  });
});
