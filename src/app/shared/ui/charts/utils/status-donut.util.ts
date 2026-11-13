export interface DonutInput {
  readonly key: string;
  readonly count: number;
  readonly color: string;
}

export interface DonutArc {
  readonly key: string;
  readonly color: string;
  /** Share of the ring, on a circle whose circumference is 100 (r = 15.9155 in a 42x42 viewBox). */
  readonly length: number;
  readonly offset: number;
}

/** Arcs for a stroke-dasharray donut, the same geometry as the Team Progress donut. Zero counts are dropped. */
export function donutArcs(items: readonly DonutInput[]): DonutArc[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.count), 0);
  if (total <= 0) return [];
  let start = 0;
  const arcs: DonutArc[] = [];
  for (const item of items) {
    if (!(item.count > 0)) continue;
    const length = (item.count / total) * 100;
    // The circle starts at 3 o'clock; an offset of 25 moves the first arc to 12 o'clock.
    arcs.push({ key: item.key, color: item.color, length, offset: 25 - start });
    start += length;
  }
  return arcs;
}
