import { describe, expect, it } from 'vitest';
import {
  TEAM_PROGRESS_BREAKPOINTS,
  TEAM_PROGRESS_HYSTERESIS,
  TeamProgressMode,
  classifyTeamProgressSize,
  planTeamProgressLayout,
  resolveTeamProgressMode
} from './team-progress-layout.util';

/** Grid height for a row count: 96px rows, 12px gap. */
const rows = (n: number): number => n * 96 + (n - 1) * 12;
/** Grid width for a column count at a 1440px viewport (about 97px columns, 12px gap). */
const cols = (n: number): number => n * 97 + (n - 1) * 12;
/** The same at a 1920px viewport (about 140px columns). */
const wideCols = (n: number): number => n * 140 + (n - 1) * 12;

describe('team-progress-layout.util', () => {
  describe('every grid size maps to a sensible view', () => {
    const cases: [string, number, number, TeamProgressMode][] = [
      // 1440px screen: 2-row cards are mini; 2-column cards with more height keep the donut (xs)
      ['2x2', cols(2), rows(2), 'mini'],
      ['2x3', cols(2), rows(3), 'xs'],
      ['2x4', cols(2), rows(4), 'xs'],
      ['2x5', cols(2), rows(5), 'xs'],
      ['3x2', cols(3), rows(2), 'mini'],
      ['4x2', cols(4), rows(2), 'mini'],
      ['8x2', cols(8), rows(2), 'mini'],
      ['12x2', cols(12), rows(2), 'mini'],
      ['3x3', cols(3), rows(3), 'xs'],
      ['4x3', cols(4), rows(3), 'small'],
      ['5x3', cols(5), rows(3), 'small'],
      ['6x3', cols(6), rows(3), 'wide'],
      ['8x3', cols(8), rows(3), 'wide'],
      ['12x3', cols(12), rows(3), 'wide'],
      ['3x4', cols(3), rows(4), 'xs'],
      ['4x4', cols(4), rows(4), 'small'],
      ['5x4', cols(5), rows(4), 'small'],
      ['6x4', cols(6), rows(4), 'medium'],
      ['7x4', cols(7), rows(4), 'medium'],
      ['8x4', cols(8), rows(4), 'wide'],
      ['12x4', cols(12), rows(4), 'wide'],
      ['3x5', cols(3), rows(5), 'xs'],
      ['4x5', cols(4), rows(5), 'small'],
      ['6x5', cols(6), rows(5), 'medium'],
      ['8x5', cols(8), rows(5), 'wide'],
      ['3x6', cols(3), rows(6), 'tall'],
      ['4x6', cols(4), rows(6), 'tall'],
      ['6x6', cols(6), rows(6), 'tall'],
      ['8x6', cols(8), rows(6), 'large'],
      ['10x6', cols(10), rows(6), 'large'],
      ['12x6', cols(12), rows(6), 'large'],
      ['4x8', cols(4), rows(8), 'tall'],
      ['6x8', cols(6), rows(8), 'tall'],
      ['8x8', cols(8), rows(8), 'large'],
      ['12x7', cols(12), rows(7), 'large'],
      ['12x8', cols(12), rows(8), 'maximum'],
      // 1920px screen: wider columns
      ['1920 2x2', wideCols(2), rows(2), 'mini'],
      ['1920 2x3', wideCols(2), rows(3), 'xs'],
      ['1920 3x3', wideCols(3), rows(3), 'small'],
      ['1920 4x3', wideCols(4), rows(3), 'wide'],
      ['1920 3x4', wideCols(3), rows(4), 'small'],
      ['1920 4x4', wideCols(4), rows(4), 'medium'],
      ['1920 6x4', wideCols(6), rows(4), 'wide'],
      ['1920 4x6', wideCols(4), rows(6), 'tall'],
      ['1920 6x6', wideCols(6), rows(6), 'large'],
      ['1920 8x6', wideCols(8), rows(6), 'large'],
      ['1920 8x8', wideCols(8), rows(8), 'maximum'],
      ['1920 12x8', wideCols(12), rows(8), 'maximum'],
      // phones: one full-width column
      ['mobile 320 3 rows', 288, rows(3), 'xs'],
      ['mobile 320 4 rows', 288, rows(4), 'xs'],
      ['mobile 320 6 rows', 288, rows(6), 'tall'],
      ['mobile 375 3 rows', 343, rows(3), 'xs'],
      ['mobile 375 4 rows', 343, rows(4), 'xs'],
      ['mobile 375 6 rows', 343, rows(6), 'tall'],
      ['mobile 375 8 rows', 343, rows(8), 'tall']
    ];

    for (const [name, width, height, mode] of cases) {
      it(`${name} (${width}x${height}) -> ${mode}`, () => {
        expect(classifyTeamProgressSize(width, height)).toBe(mode);
        expect(resolveTeamProgressMode(width, height)).toBe(mode);
      });
    }

    it('keeps every grid row count well clear of the height thresholds', () => {
      const h = TEAM_PROGRESS_HYSTERESIS;
      const b = TEAM_PROGRESS_BREAKPOINTS;
      for (let n = 2; n <= 8; n++) {
        for (const threshold of [b.miniHeight, b.mediumHeight, b.tallHeight, b.maximumHeight]) {
          expect(Math.abs(rows(n) - threshold)).toBeGreaterThan(h);
        }
      }
    });

    it('keeps the 1440px column counts well clear of the width thresholds', () => {
      const h = TEAM_PROGRESS_HYSTERESIS;
      const b = TEAM_PROGRESS_BREAKPOINTS;
      for (let n = 2; n <= 12; n++) {
        for (const threshold of [b.smallWidth, b.mediumWidth, b.wideWidth, b.maximumWidth]) {
          expect(Math.abs(cols(n) - threshold)).toBeGreaterThan(h);
        }
      }
    });
  });

  describe('hysteresis', () => {
    const { smallWidth, mediumWidth, wideWidth, maximumWidth, mediumHeight, tallHeight, maximumHeight } = TEAM_PROGRESS_BREAKPOINTS;
    const h = TEAM_PROGRESS_HYSTERESIS;

    it('growing wider: stays xs just past the threshold, switches once clearly past it', () => {
      expect(resolveTeamProgressMode(smallWidth + 5, rows(3), 'xs')).toBe('xs');
      expect(resolveTeamProgressMode(smallWidth + h - 1, rows(3), 'xs')).toBe('xs');
      expect(resolveTeamProgressMode(smallWidth + h, rows(3), 'xs')).toBe('small');
    });

    it('shrinking narrower: stays small just under the threshold, switches once clearly under it', () => {
      expect(resolveTeamProgressMode(smallWidth - 5, rows(3), 'small')).toBe('small');
      expect(resolveTeamProgressMode(smallWidth - h, rows(3), 'small')).toBe('small');
      expect(resolveTeamProgressMode(smallWidth - h - 1, rows(3), 'small')).toBe('xs');
    });

    it('applies to the medium, wide and maximum width thresholds in both directions', () => {
      expect(resolveTeamProgressMode(mediumWidth + 10, rows(4), 'small')).toBe('small');
      expect(resolveTeamProgressMode(mediumWidth + 30, rows(4), 'small')).toBe('medium');
      expect(resolveTeamProgressMode(mediumWidth - 10, rows(4), 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(wideWidth + 10, rows(4), 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(wideWidth - 10, rows(4), 'wide')).toBe('wide');
      expect(resolveTeamProgressMode(wideWidth - 30, rows(4), 'wide')).toBe('medium');
      expect(resolveTeamProgressMode(wideWidth - 10, rows(6), 'large')).toBe('large');
      expect(resolveTeamProgressMode(wideWidth - 30, rows(6), 'large')).toBe('tall');
      expect(resolveTeamProgressMode(maximumWidth - 10, rows(8), 'maximum')).toBe('maximum');
      expect(resolveTeamProgressMode(maximumWidth - 30, rows(8), 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(maximumWidth + 10, rows(8), 'large')).toBe('large');
      expect(resolveTeamProgressMode(maximumWidth + 30, rows(8), 'large')).toBe('maximum');
    });

    it('applies to the height thresholds in both directions', () => {
      expect(resolveTeamProgressMode(cols(6), mediumHeight + 10, 'wide')).toBe('wide');
      expect(resolveTeamProgressMode(cols(6), mediumHeight + 30, 'wide')).toBe('medium');
      expect(resolveTeamProgressMode(cols(6), mediumHeight - 10, 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(430, tallHeight + 10, 'small')).toBe('small');
      expect(resolveTeamProgressMode(430, tallHeight + 30, 'small')).toBe('tall');
      expect(resolveTeamProgressMode(430, tallHeight - 10, 'tall')).toBe('tall');
      expect(resolveTeamProgressMode(430, tallHeight - 30, 'tall')).toBe('small');
      expect(resolveTeamProgressMode(1300, maximumHeight - 10, 'maximum')).toBe('maximum');
      expect(resolveTeamProgressMode(1300, maximumHeight - 30, 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(1300, maximumHeight + 10, 'large')).toBe('large');
    });

    it('never holds on to a previous mode across a whole grid step', () => {
      expect(resolveTeamProgressMode(cols(12), rows(7), 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(cols(12), rows(8), 'large')).toBe('maximum');
      expect(resolveTeamProgressMode(cols(4), rows(5), 'tall')).toBe('small');
      expect(resolveTeamProgressMode(cols(4), rows(6), 'small')).toBe('tall');
      expect(resolveTeamProgressMode(cols(3), rows(3), 'small')).toBe('xs');
      expect(resolveTeamProgressMode(cols(4), rows(3), 'xs')).toBe('small');
      expect(resolveTeamProgressMode(cols(6), rows(4), 'small')).toBe('medium');
      expect(resolveTeamProgressMode(cols(4), rows(4), 'medium')).toBe('small');
      expect(resolveTeamProgressMode(cols(8), rows(4), 'medium')).toBe('wide');
      expect(resolveTeamProgressMode(cols(6), rows(4), 'wide')).toBe('medium');
      expect(resolveTeamProgressMode(cols(6), rows(3), 'medium')).toBe('wide');
    });

    it('jumps straight to the new mode on a big size change', () => {
      expect(resolveTeamProgressMode(1300, rows(8), 'xs')).toBe('maximum');
      expect(resolveTeamProgressMode(300, rows(3), 'maximum')).toBe('xs');
    });
  });

  it('keeps the previous mode (or small) for a zero or invalid size', () => {
    expect(resolveTeamProgressMode(0, 0)).toBe('small');
    expect(resolveTeamProgressMode(0, 500, 'wide')).toBe('wide');
    expect(resolveTeamProgressMode(900, Number.NaN, 'large')).toBe('large');
  });

  describe('planTeamProgressLayout', () => {
    const plan = (c: number, r: number) => {
      const width = cols(c);
      const height = rows(r);
      return planTeamProgressLayout(classifyTeamProgressSize(width, height), width, height);
    };

    it('shows nothing optional for a zero size', () => {
      expect(planTeamProgressLayout('tall', 0, 0)).toEqual({
        miniLegend: 'none', miniFigure: false, legend: false, tileRows: 0, viewDetails: false, listRows: 0, weeklyFallbackRows: 0,
        timeBand: false, timeCallout: false, workloadRows: 0
      });
    });

    it('mini: the small donut at 2x2 and 3x2; from 4 columns the bar and legend replace it', () => {
      expect(planTeamProgressLayout('mini', cols(2), rows(2)).miniLegend).toBe('none');
      expect(planTeamProgressLayout('mini', cols(3), rows(2)).miniLegend).toBe('none');
      expect(planTeamProgressLayout('mini', cols(4), rows(2)).miniLegend).toBe('inline');
      expect(planTeamProgressLayout('mini', cols(5), rows(2)).miniLegend).toBe('inline');
      expect(planTeamProgressLayout('mini', cols(12), rows(2)).miniLegend).toBe('inline');
      expect(planTeamProgressLayout('xs', cols(3), rows(3)).miniLegend).toBe('none');
    });

    it('xs: only the donut and completion at 3x3; taller cards add the legend, tiles and View details', () => {
      expect(plan(3, 3)).toMatchObject({ legend: false, tileRows: 0, viewDetails: false, listRows: 0 });
      expect(plan(3, 4)).toMatchObject({ legend: true, tileRows: 0, viewDetails: false });
      expect(plan(3, 5)).toMatchObject({ legend: true, tileRows: 1, viewDetails: true });
    });

    it('small: tile rows grow with height, then View details', () => {
      expect(plan(4, 3)).toMatchObject({ tileRows: 0, viewDetails: false, listRows: 0 });
      expect(plan(4, 4)).toMatchObject({ tileRows: 2, viewDetails: false });
      expect(plan(4, 5)).toMatchObject({ tileRows: 2, viewDetails: true });
    });

    it('medium: a tile row, then View details, then list rows as the card grows', () => {
      expect(plan(6, 4)).toMatchObject({ tileRows: 1, listRows: 0, viewDetails: true });
      expect(plan(6, 5).listRows).toBeGreaterThanOrEqual(2);
      expect(plan(6, 5).viewDetails).toBe(false);
    });

    it('wide: lists only when there is room under the tiles', () => {
      expect(plan(6, 3).listRows).toBe(0);
      expect(plan(8, 3).listRows).toBe(0);
      expect(plan(8, 4).listRows).toBe(1);
      expect(plan(8, 5).listRows).toBeGreaterThan(plan(8, 4).listRows);
      expect(plan(8, 4).weeklyFallbackRows).toBe(0);
    });

    it('tall, large and maximum: more list rows with height, and more again without the weekly chart', () => {
      expect(plan(4, 6)).toMatchObject({ viewDetails: true, listRows: 0 });
      expect(plan(4, 6).weeklyFallbackRows).toBeGreaterThanOrEqual(3);
      expect(plan(6, 6).listRows).toBeGreaterThan(plan(4, 6).listRows);
      expect(plan(4, 8).listRows).toBeGreaterThan(plan(4, 6).listRows);
      expect(plan(8, 6).listRows).toBeGreaterThanOrEqual(1);
      expect(plan(8, 8).listRows).toBeGreaterThan(plan(8, 6).listRows);
      // The planned-vs-worked band takes about two rows of a 12x8 card (My Team widgets 2026-10-29).
      expect(plan(12, 8)).toMatchObject({ timeBand: true });
      expect(plan(12, 8).listRows).toBeGreaterThanOrEqual(6);
      for (const [c, r] of [[4, 6], [8, 6], [12, 8]]) {
        expect(plan(c, r).weeklyFallbackRows).toBeGreaterThanOrEqual(3);
      }
    });

    it('caps the list rows', () => {
      expect(planTeamProgressLayout('maximum', 1300, 10_000).listRows).toBe(20);
    });
  });
});

describe('team progress layout: planned-vs-worked sections (coverage audit)', () => {
  const rows = (n: number) => n * 96 + (n - 1) * 12;

  it('medium adds the top-3 workload only when the lists keep two rows', () => {
    expect(planTeamProgressLayout('medium', 700, rows(4)).workloadRows).toBe(0);
    const tall = planTeamProgressLayout('medium', 700, rows(8));
    expect(tall.workloadRows).toBe(3);
    expect(tall.listRows).toBeGreaterThanOrEqual(2);
  });

  it('wide adds the unscheduled callout, never the band or workload', () => {
    const plan = planTeamProgressLayout('wide', 900, rows(5));
    expect(plan).toMatchObject({ timeCallout: true, timeBand: false, workloadRows: 0 });
  });

  it('large and maximum add the band, then the top-5 workload as they grow', () => {
    expect(planTeamProgressLayout('large', 900, rows(6))).toMatchObject({ timeBand: false, workloadRows: 0 });
    expect(planTeamProgressLayout('large', 900, rows(8))).toMatchObject({ timeBand: true });
    expect(planTeamProgressLayout('large', 900, rows(8)).workloadRows).toBe(0);
    expect(planTeamProgressLayout('maximum', 1300, rows(11))).toMatchObject({ timeBand: true, workloadRows: 5 });
  });

  it('a time section never takes the lists below two rows, or below what they had', () => {
    for (const mode of ['medium', 'wide', 'tall', 'large', 'maximum'] as const) {
      for (let r = 3; r <= 12; r++) {
        const plan = planTeamProgressLayout(mode, 1300, rows(r));
        const usesTime = plan.timeBand || plan.timeCallout || plan.workloadRows > 0;
        if (usesTime && plan.listRows > 0) expect(plan.listRows, `${mode} ${r} rows`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('mini, xs and small never show time sections', () => {
    for (const mode of ['mini', 'xs', 'small'] as const) {
      expect(planTeamProgressLayout(mode, 400, rows(8))).toMatchObject({ timeBand: false, timeCallout: false, workloadRows: 0 });
    }
  });
});
