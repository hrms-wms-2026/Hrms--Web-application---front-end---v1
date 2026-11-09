import { describe, expect, it } from 'vitest';
import { planSummaryStrip } from './summary-strip-layout.util';

describe('planSummaryStrip', () => {
  it.each([
    [292, 4, { key: false, cards: 0 }],
    [424, 4, { key: true, cards: 0 }],
    [900, 4, { key: true, cards: 2 }],
    // A full-width 2-row card on a 1920px screen at 125% display scaling (1536 CSS px): still all four cards.
    [1374, 4, { key: true, cards: 4 }],
    [1812, 4, { key: true, cards: 4 }],
    [1812, 2, { key: true, cards: 2 }],
    [1812, 0, { key: true, cards: 0 }]
  ])('host %i with %i cards available', (width, available, expected) => {
    expect(planSummaryStrip(width, available)).toEqual(expected);
  });

  it('keeps the previous plan for a host that is not laid out', () => {
    expect(planSummaryStrip(0, 4, { key: true, cards: 2 })).toEqual({ key: true, cards: 2 });
    expect(planSummaryStrip(0, 4)).toEqual({ key: false, cards: 0 });
  });

  it('keeps a card within the hysteresis band and drops it beyond', () => {
    // One card needs a 620px host: 32 chrome + 140 donut + 14 + 200 key + 14 + 220 card.
    expect(planSummaryStrip(620, 4)).toEqual({ key: true, cards: 1 });
    expect(planSummaryStrip(610, 4)).toEqual({ key: true, cards: 0 });
    expect(planSummaryStrip(610, 4, { key: true, cards: 1 })).toEqual({ key: true, cards: 1 });
    expect(planSummaryStrip(590, 4, { key: true, cards: 1 })).toEqual({ key: true, cards: 0 });
  });

  it('never keeps more cards than are available', () => {
    expect(planSummaryStrip(1812, 1, { key: true, cards: 4 })).toEqual({ key: true, cards: 1 });
  });
});
