import { describe, expect, it } from 'vitest';
import { SummaryCardModel } from '../models/summary-card.model';
import { SUMMARY_ROW_PX, pickSummaryCards, summaryRowCount, withSummaryRow } from './summary-row.util';

const card = (id: string): SummaryCardModel => ({ id, title: id, icon: 'users', tone: 'var(--color-cat-blue)', section: id, state: 'ready', body: null });
const CARDS = ['a', 'b', 'c', 'd'].map(card);

describe('summaryRowCount', () => {
  it('fits two cards side by side from 374px (2 x 180 + 14), else one', () => {
    // A 4-column widget: 418px body at 125% display scaling, 384px for Team progress at 1440px. Both get two.
    expect(summaryRowCount(418)).toBe(2);
    expect(summaryRowCount(384)).toBe(2);
    expect(summaryRowCount(374)).toBe(2);
    expect(summaryRowCount(373)).toBe(1);
  });

  it('takes a third and fourth card on a wide body only when the widget asks for them', () => {
    // A wide 8-column Team attendance body (880px) gets three; 3 x 220 + 2 x 14 = 688px is the threshold.
    expect(summaryRowCount(880)).toBe(2);
    expect(summaryRowCount(880, 3)).toBe(3);
    expect(summaryRowCount(688, 3)).toBe(3);
    expect(summaryRowCount(687, 3)).toBe(2);
    expect(summaryRowCount(942, 4)).toBe(4);
    expect(summaryRowCount(373, 4)).toBe(1);
  });
});

describe('pickSummaryCards', () => {
  it('takes the first cards whose section the widget is not already showing', () => {
    expect(pickSummaryCards(CARDS, new Set(['a', 'c']), 2)?.map((c) => c.id)).toEqual(['b', 'd']);
  });

  it('gives nothing when fewer than the wanted cards are left, so the tiles stay', () => {
    expect(pickSummaryCards(CARDS, new Set(['a', 'b', 'c']), 2)).toBeNull();
    expect(pickSummaryCards([], new Set(), 1)).toBeNull();
  });

  it('a wide row asking for three takes what is left as long as that is two', () => {
    expect(pickSummaryCards(CARDS, new Set(['a']), 3)?.map((c) => c.id)).toEqual(['b', 'c', 'd']);
    expect(pickSummaryCards(CARDS, new Set(['a', 'c']), 3)?.map((c) => c.id)).toEqual(['b', 'd']);
    expect(pickSummaryCards(CARDS, new Set(['a', 'b', 'c']), 3)).toBeNull();
  });
});

describe('withSummaryRow', () => {
  interface P {
    tiles: boolean;
    trend: boolean;
    rowPx: number | undefined;
  }
  /** A fake planner: the summary row (140px) leaves no room for the trend; the tile row (52px) does. */
  const planFor = (rowPx?: number): P => ({ tiles: true, trend: rowPx === undefined, rowPx });

  it('plans with the taller row and swaps the tiles for two cards that are not shown elsewhere', () => {
    const r = withSummaryRow(planFor, CARDS, (p) => new Set(p.trend ? ['a'] : []), 2);
    expect(r.plan.rowPx).toBe(SUMMARY_ROW_PX);
    expect(r.cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('keeps the tiles plan when two new cards cannot be found', () => {
    const r = withSummaryRow(planFor, CARDS, () => new Set(['a', 'b', 'c']), 2);
    expect(r.plan.rowPx).toBeUndefined();
    expect(r.cards).toEqual([]);
  });

  it('keeps the tiles plan when even the cards row does not fit', () => {
    const none = (rowPx?: number): P => ({ tiles: rowPx === undefined, trend: false, rowPx });
    const r = withSummaryRow(none, CARDS, () => new Set(), 2);
    expect(r.plan.tiles).toBe(true);
    expect(r.cards).toEqual([]);
  });
});
