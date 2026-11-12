/**
 * The 2-row layout every dashboard widget shares: the mini donut, then its colour key once there is room,
 * then as many summary cards as fit (each summarises one section of the widget's popup). Measured on the
 * strip's own host width, in CSS pixels.
 */
export const SUMMARY_STRIP_PX = {
  donut: 140,
  gap: 14,
  keyMin: 200,
  cardMin: 220,
  /** Card padding left and right: the host width minus this is the body. */
  chrome: 32,
  maxCards: 4
} as const;

/** How far past a threshold the width must move before the plan changes back. */
export const SUMMARY_STRIP_HYSTERESIS = 20;

export interface SummaryStripPlan {
  readonly key: boolean;
  readonly cards: number;
}

const NOTHING: SummaryStripPlan = { key: false, cards: 0 };

function classify(hostWidth: number, available: number): SummaryStripPlan {
  const p = SUMMARY_STRIP_PX;
  const body = hostWidth - p.chrome;
  const keyNeeds = p.donut + p.gap + p.keyMin;
  if (body < keyNeeds) return NOTHING;
  const fit = Math.floor((body - keyNeeds) / (p.gap + p.cardMin));
  return { key: true, cards: Math.max(0, Math.min(fit, p.maxCards, available)) };
}

const same = (a: SummaryStripPlan, b: SummaryStripPlan): boolean => a.key === b.key && a.cards === b.cards;

/** The plan for a host width. `available` is how many cards the widget has. A host that is not laid out
 * keeps the previous plan; within the hysteresis band of the previous plan's threshold that plan is kept. */
export function planSummaryStrip(hostWidth: number, available: number, previous: SummaryStripPlan | null = null): SummaryStripPlan {
  if (!(hostWidth > 0)) return previous ?? NOTHING;
  const next = classify(hostWidth, available);
  if (!previous || same(next, previous)) return next;
  const h = SUMMARY_STRIP_HYSTERESIS;
  const kept = [hostWidth - h, hostWidth + h].some((w) => same(classify(w, available), previous));
  return kept ? previous : next;
}
