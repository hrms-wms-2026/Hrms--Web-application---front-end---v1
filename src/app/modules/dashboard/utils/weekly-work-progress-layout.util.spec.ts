import { describe, expect, it } from 'vitest';
import {
  WEEKLY_PROGRESS_CARD_CHROME,
  classifyWeeklyProgressSize,
  planWeeklyProgressSections,
  resolveWeeklyProgressView
} from './weekly-work-progress-layout.util';

/** Card host sizes at 1440 px: a column is about 97 px, rows are 96 px with 12 px gaps. */
const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;
const plan = (w: number, h: number) =>
  planWeeklyProgressSections(
    classifyWeeklyProgressSize(w, h),
    w - WEEKLY_PROGRESS_CARD_CHROME.width,
    h - WEEKLY_PROGRESS_CARD_CHROME.height
  );

describe('weekly work progress layout', () => {
  it('2x2 is the mini view: the donut only', () => {
    expect(classifyWeeklyProgressSize(cols(2), rows(2))).toBe('mini');
    expect(plan(cols(2), rows(2))).toEqual({ miniTiles: false, stackedTiles: 0, tilesOneRow: false, sideTiles: 0, chart: false, comparison: false });
  });

  it('a wide 2-row card is mini-wide, adding tiles from 640 px', () => {
    expect(classifyWeeklyProgressSize(cols(5), rows(2))).toBe('mini-wide');
    expect(plan(cols(5), rows(2)).miniTiles).toBe(false);
    expect(plan(cols(7), rows(2)).miniTiles).toBe(true);
  });

  it('a narrow tall card is xs and stacks as many tiles as fit, up to 4', () => {
    expect(classifyWeeklyProgressSize(cols(2), rows(5))).toBe('xs');
    expect(plan(cols(2), rows(5)).stackedTiles).toBe(4);
    expect(plan(cols(2), rows(4)).stackedTiles).toBe(2);
    expect(plan(cols(2), rows(3)).stackedTiles).toBe(0);
  });

  it('standard adds the chart, then the comparison, as the card gets taller', () => {
    expect(classifyWeeklyProgressSize(cols(6), rows(3))).toBe('standard');
    expect(plan(cols(6), rows(3))).toMatchObject({ tilesOneRow: true, chart: false, comparison: false });
    expect(plan(cols(6), rows(5))).toMatchObject({ chart: true, comparison: false });
    expect(plan(cols(6), rows(7))).toMatchObject({ chart: true, comparison: true });
  });

  it('a standard card under 520 px of body lists the tiles as compact rows beside the donut, never under it', () => {
    // The default My Work slot (4x3) must fit without scrolling: donut + four rows beside it, nothing below.
    expect(plan(cols(4), rows(3))).toEqual({ miniTiles: false, stackedTiles: 0, tilesOneRow: false, sideTiles: 4, chart: false, comparison: false });
    expect(plan(cols(4), rows(5))).toMatchObject({ sideTiles: 4, chart: true, comparison: false });
  });

  it('never plans more than the body can hold', () => {
    for (let w = 2; w <= 12; w++) {
      for (let h = 2; h <= 8; h++) {
        const bodyH = rows(h) - WEEKLY_PROGRESS_CARD_CHROME.height;
        const p = plan(cols(w), rows(h));
        const view = classifyWeeklyProgressSize(cols(w), rows(h));
        if (view !== 'standard') continue;
        const used = 162 + (p.chart ? 12 + 186 : 0) + (p.comparison ? 12 + 116 : 0);
        expect(used, `${w}x${h}`).toBeLessThanOrEqual(bodyH);
      }
    }
  });

  it('keeps the previous view within the 20 px hysteresis band', () => {
    expect(resolveWeeklyProgressView(cols(2), 265, 'mini')).toBe('mini');
    expect(resolveWeeklyProgressView(cols(2), 285, 'mini')).toBe('xs');
    expect(resolveWeeklyProgressView(350, rows(2), 'mini-wide')).toBe('mini-wide');
  });

  it('a card not laid out yet keeps the previous view, or standard', () => {
    expect(resolveWeeklyProgressView(0, 0, null)).toBe('standard');
    expect(resolveWeeklyProgressView(0, 0, 'xs')).toBe('xs');
  });
});
