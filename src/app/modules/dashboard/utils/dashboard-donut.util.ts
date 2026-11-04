/** The one donut diameter every dashboard widget uses, in every view. A bigger card shows more
 * detail around the donut, never a bigger donut; a view with no room for it leaves it out instead
 * of shrinking it. */
export const DASHBOARD_DONUT_PX = 140;

/** One legend row under (or beside) a donut: dot, label, value. Every widget's donut legend uses it. */
export const DASHBOARD_DONUT_LEGEND_ROW_PX = 28;

/** The donut's centre figure size for a text of this length, so it always fits inside the ring's hole
 * (about 86px wide at DASHBOARD_DONUT_PX). Every widget uses the same steps, so equal-length figures match. */
export function donutValueFontPx(text: string): number {
  const length = text.length;
  if (length <= 3) return 24;
  if (length <= 5) return 20;
  if (length <= 8) return 17;
  return length <= 10 ? 15 : 13;
}
