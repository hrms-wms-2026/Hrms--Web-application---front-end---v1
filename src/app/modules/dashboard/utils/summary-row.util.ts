import { SummaryCardModel } from '../models/summary-card.model';
import { SUMMARY_STRIP_PX } from './summary-strip-layout.util';

/**
 * Taller dashboard views (design 2026-11-07, follow-up): the KPI tile row becomes a row of summary cards. The cards
 * summarise popup sections the widget is NOT already showing at that size; when two such cards can't be found the
 * tiles stay. Summary cards never appear inside a popup.
 */

/** The cards row's height, the same as a 2-row strip card. */
export const SUMMARY_ROW_PX = 140;

/** A row card's narrowest width. Narrower than a strip card: the row is a fixed 140px tall and a 4-column widget
 * (a 384px body at 1440px, 418px at 125% display scaling) must still fit two. */
export const SUMMARY_ROW_CARD_MIN_PX = 180;

/** The narrowest card once a wide row holds three or more (as wide as a 2-row strip card). */
const SUMMARY_ROW_WIDE_CARD_MIN_PX = SUMMARY_STRIP_PX.cardMin;

/**
 * How many cards fit side by side in a body this wide: two from 2 x row card minimum + gap, else one. A widget with
 * more cards to offer may pass `max` (3 or 4): a wide body then takes a third and fourth card once each still gets a
 * strip card's width.
 */
export function summaryRowCount(bodyWidth: number, max: 2 | 3 | 4 = 2): number {
  if (bodyWidth < SUMMARY_ROW_CARD_MIN_PX * 2 + SUMMARY_STRIP_PX.gap) return 1;
  const wide = Math.floor((bodyWidth + SUMMARY_STRIP_PX.gap) / (SUMMARY_ROW_WIDE_CARD_MIN_PX + SUMMARY_STRIP_PX.gap));
  return Math.max(2, Math.min(wide, max));
}

/** Up to `count` cards, in the widget's order, whose card id is not already shown; null when fewer than
 * min(count, 2) are left (a wide row asking for three still takes two). */
export function pickSummaryCards(cards: readonly SummaryCardModel[], shown: ReadonlySet<string>, count: number): SummaryCardModel[] | null {
  const picked = cards.filter((c) => !shown.has(c.id)).slice(0, count);
  return count > 0 && picked.length >= Math.min(count, 2) ? picked : null;
}

/**
 * Plans a taller view with the cards row in the tiles' place, then picks its cards. `planFor(rowPx)` is the widget's
 * layout planner with the tile row's height replaced by `rowPx` (no argument: the normal tile row). `shown` lists the
 * card ids the planned view already shows as its own sections. Without room or without enough cards, the tiles plan.
 */
export function withSummaryRow<P extends { readonly tiles: boolean }>(
  planFor: (rowPx?: number) => P,
  cards: readonly SummaryCardModel[],
  shown: (plan: P) => ReadonlySet<string>,
  count: number
): { plan: P; cards: SummaryCardModel[] } {
  const withRow = planFor(SUMMARY_ROW_PX);
  if (withRow.tiles) {
    const picked = pickSummaryCards(cards, shown(withRow), count);
    if (picked) return { plan: withRow, cards: picked };
  }
  return { plan: planFor(), cards: [] };
}
