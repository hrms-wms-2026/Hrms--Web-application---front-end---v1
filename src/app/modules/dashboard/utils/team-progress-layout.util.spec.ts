import { describe, expect, it } from 'vitest';
import {
  TEAM_PROGRESS_BREAKPOINTS,
  TEAM_PROGRESS_HYSTERESIS,
  TeamProgressMode,
  classifyTeamProgressSize,
  resolveTeamProgressMode,
  teamProgressListBudget
} from './team-progress-layout.util';

/** Grid height for a row count: 96px rows, 12px gap. */
const rows = (n: number): number => n * 96 + (n - 1) * 12;

describe('team-progress-layout.util', () => {
  describe('reference grid sizes', () => {
    const cases: [string, number, number, TeamProgressMode][] = [
      ['4x4 desktop', 430, rows(4), 'compact'],
      ['4x4 narrow container', 400, rows(4), 'compact'],
      ['4x5', 450, rows(5), 'compact'],
      ['4x6 (default)', 450, rows(6), 'tall'],
      ['4x8', 470, rows(8), 'tall'],
      ['5x4', 540, rows(4), 'compact'],
      ['6x4', 650, rows(4), 'medium'],
      ['6x4 narrow container', 620, rows(4), 'medium'],
      ['6x6', 680, rows(6), 'tall'],
      ['8x4', 900, rows(4), 'wide'],
      ['8x4 narrow container', 840, rows(4), 'wide'],
      ['8x6', 900, rows(6), 'large'],
      ['8x8', 950, rows(8), 'large'],
      ['12x4', 1300, rows(4), 'wide'],
      ['12x5', 1300, rows(5), 'wide'],
      ['12x6', 1300, rows(6), 'large'],
      ['12x7', 1300, rows(7), 'large'],
      ['12x8', 1300, rows(8), 'maximum'],
      ['12x8 narrow container', 1250, rows(8), 'maximum'],
      ['mobile 4x4', 320, rows(4), 'compact'],
      ['mobile 4x6', 320, rows(6), 'tall'],
      ['small mobile 4x6', 290, rows(6), 'tall'],
      ['mobile 4x8', 360, rows(8), 'tall']
    ];

    for (const [name, width, height, mode] of cases) {
      it(`${name} (${width}x${height}) -> ${mode}`, () => {
        expect(classifyTeamProgressSize(width, height)).toBe(mode);
        expect(resolveTeamProgressMode(width, height)).toBe(mode);
      });
    }

    it('keeps every grid row count well clear of the height thresholds', () => {
      const h = TEAM_PROGRESS_HYSTERESIS;
      for (let n = 4; n <= 8; n++) {
        for (const threshold of [TEAM_PROGRESS_BREAKPOINTS.tallHeight, TEAM_PROGRESS_BREAKPOINTS.maximumHeight]) {
          expect(Math.abs(rows(n) - threshold)).toBeGreaterThan(h);
        }
      }
    });
  });

  describe('hysteresis', () => {
    const { mediumWidth, wideWidth, maximumWidth, tallHeight, maximumHeight } = TEAM_PROGRESS_BREAKPOINTS;
    const h = TEAM_PROGRESS_HYSTERESIS;

    it('growing wider: stays compact just past the threshold, switches once clearly past it', () => {
      expect(resolveTeamProgressMode(mediumWidth + 5, 420, 'compact')).toBe('compact');
      expect(resolveTeamProgressMode(mediumWidth + h - 1, 420, 'compact')).toBe('compact');
      expect(resolveTeamProgressMode(mediumWidth + h, 420, 'compact')).toBe('medium');
    });

    it('shrinking narrower: stays medium just under the threshold, switches once clearly under it', () => {
      expect(resolveTeamProgressMode(mediumWidth - 5, 420, 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(mediumWidth - h, 420, 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(mediumWidth - h - 1, 420, 'medium')).toBe('compact');
    });

    it('applies to the wide and maximum width thresholds in both directions', () => {
      expect(resolveTeamProgressMode(wideWidth + 10, 420, 'medium')).toBe('medium');
      expect(resolveTeamProgressMode(wideWidth - 10, 420, 'wide')).toBe('wide');
      expect(resolveTeamProgressMode(wideWidth - 30, 420, 'wide')).toBe('medium');
      expect(resolveTeamProgressMode(maximumWidth - 10, rows(8), 'maximum')).toBe('maximum');
      expect(resolveTeamProgressMode(maximumWidth - 30, rows(8), 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(maximumWidth + 10, rows(8), 'large')).toBe('large');
      expect(resolveTeamProgressMode(maximumWidth + 30, rows(8), 'large')).toBe('maximum');
    });

    it('applies to the height thresholds in both directions', () => {
      expect(resolveTeamProgressMode(430, tallHeight + 10, 'compact')).toBe('compact');
      expect(resolveTeamProgressMode(430, tallHeight + 30, 'compact')).toBe('tall');
      expect(resolveTeamProgressMode(430, tallHeight - 10, 'tall')).toBe('tall');
      expect(resolveTeamProgressMode(430, tallHeight - 30, 'tall')).toBe('compact');
      expect(resolveTeamProgressMode(1300, maximumHeight - 10, 'maximum')).toBe('maximum');
      expect(resolveTeamProgressMode(1300, maximumHeight - 30, 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(1300, maximumHeight + 10, 'large')).toBe('large');
    });

    it('never holds on to a previous mode across a whole grid step', () => {
      expect(resolveTeamProgressMode(1300, rows(7), 'maximum')).toBe('large');
      expect(resolveTeamProgressMode(1300, rows(8), 'large')).toBe('maximum');
      expect(resolveTeamProgressMode(430, rows(5), 'tall')).toBe('compact');
      expect(resolveTeamProgressMode(430, rows(6), 'compact')).toBe('tall');
      expect(resolveTeamProgressMode(650, rows(4), 'compact')).toBe('medium');
      expect(resolveTeamProgressMode(430, rows(4), 'medium')).toBe('compact');
      expect(resolveTeamProgressMode(900, rows(4), 'medium')).toBe('wide');
      expect(resolveTeamProgressMode(650, rows(4), 'wide')).toBe('medium');
    });

    it('jumps straight to the new mode on a big size change', () => {
      expect(resolveTeamProgressMode(1300, rows(8), 'compact')).toBe('maximum');
      expect(resolveTeamProgressMode(320, rows(4), 'maximum')).toBe('compact');
    });
  });

  it('keeps the previous mode (or compact) for a zero or invalid size', () => {
    expect(resolveTeamProgressMode(0, 0)).toBe('compact');
    expect(resolveTeamProgressMode(0, 500, 'wide')).toBe('wide');
    expect(resolveTeamProgressMode(900, Number.NaN, 'large')).toBe('large');
  });

  describe('teamProgressListBudget', () => {
    it('is 0 for modes without lists', () => {
      expect(teamProgressListBudget('compact', rows(4))).toBe(0);
      expect(teamProgressListBudget('medium', rows(4))).toBe(0);
      expect(teamProgressListBudget('wide', rows(4))).toBe(0);
    });

    it('grows with height and is at least one row', () => {
      expect(teamProgressListBudget('tall', rows(6))).toBeGreaterThanOrEqual(1);
      expect(teamProgressListBudget('tall', rows(8))).toBeGreaterThan(teamProgressListBudget('tall', rows(6)));
      expect(teamProgressListBudget('large', rows(8))).toBeGreaterThan(teamProgressListBudget('large', rows(6)));
      expect(teamProgressListBudget('maximum', rows(8))).toBeGreaterThanOrEqual(8);
      expect(teamProgressListBudget('tall', 100)).toBe(1);
    });

    it('is capped', () => {
      expect(teamProgressListBudget('maximum', 10_000)).toBe(20);
    });
  });
});
