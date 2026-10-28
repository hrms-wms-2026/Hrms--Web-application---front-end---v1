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
    expect(plan(cols(2), rows(2))).toEqual({ miniTiles: false, stackedTiles: 0, tilesOneRow: false, chart: false, comparison: false });
  });

  it('a wide 2-row card is mini-wide, adding tiles from 640 px', () => {
    expect(classifyWeeklyProgressSize(cols(5), rows(2))).toBe('mini-wide');
    expect(plan(cols(5), rows(2)).miniTiles).toBe(false);
    expect(plan(cols(7), rows(2)).miniTiles).toBe(true);
  });

  it('a narrow tall card is xs and stacks as many tiles as fit, up to 4', () => {
    expect(classifyWeeklyProgressSize(cols(2), rows(5))).toBe('xs');
    expect(plan(cols(2), rows(5)).stackedTiles).toBe(4);
    expect(plan(cols(2), rows(4)).stackedTiles).toBe(3);
    expect(plan(cols(2), rows(3)).stackedTiles).toBe(1);
  });

  it('standard adds the chart, then the comparison, as the card gets taller', () => {
    expect(classifyWeeklyProgressSize(cols(6), rows(3))).toBe('standard');
    expect(plan(cols(6), rows(3))).toMatchObject({ tilesOneRow: true, chart: false, comparison: false });
    expect(plan(cols(6), rows(5))).toMatchObject({ chart: true, comparison: false });
    expect(plan(cols(6), rows(7))).toMatchObject({ chart: true, comparison: true });
  });

  it('a standard card under 520 px of body puts the tiles two by two', () => {
    expect(plan(cols(4), rows(5)).tilesOneRow).toBe(false);
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
