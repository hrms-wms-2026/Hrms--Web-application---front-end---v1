/** The donut diameter every dashboard widget uses, in every view but the 2x2 mini one (168px since
 * 2026-11-06, 20% over the old 140px). A bigger card shows more detail around the donut, never a
 * bigger donut; a view with no room for it leaves it out instead of shrinking it. */
export const DASHBOARD_DONUT_PX = 168;

/** The mini (2x2) views' donut: a 204px-tall card has no room for the full size under its title. */
export const DASHBOARD_MINI_DONUT_PX = 140;

/** The donut diameter for a widget view: the mini size in the 2x2 views ('mini', 'mini-wide'), else the full size. */
export function dashboardDonutPx(view: string): number {
  return view.startsWith('mini') ? DASHBOARD_MINI_DONUT_PX : DASHBOARD_DONUT_PX;
}

/** One legend row under (or beside) a donut: dot, label, value. Every widget's donut legend uses it. */
export const DASHBOARD_DONUT_LEGEND_ROW_PX = 28;

/** The donut's centre figure size for a text of this length, so it always fits inside the ring's hole
 * (about 104px wide at DASHBOARD_DONUT_PX). Every widget uses the same steps, so equal-length figures match. */
export function donutValueFontPx(text: string): number {
  const length = text.length;
  if (length <= 3) return 22;
  if (length <= 5) return 18;
  if (length <= 8) return 15;
  return length <= 10 ? 14 : 12;
}
