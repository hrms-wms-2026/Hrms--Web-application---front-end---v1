/**
 * Geometry for the rounded, spaced donut (2026-11-07): each slice is a ring sector with softly rounded corners and a
 * small gap to its neighbours. Drawn in the dashboard donut's 42x42 viewBox, on the same ring as before (centre
 * radius 15.9155, 6 wide), with angles in degrees clockwise from 12 o'clock.
 *
 * The rounding is a stroke trick: the sector is drawn inset by the corner radius, then stroked in its own colour
 * with a round line join twice that width, which grows it back to full size with round corners
 * (`ROUNDED_DONUT_STROKE`).
 */

const CENTRE = 21;
const RING_RADIUS = 15.9155;
const RING_WIDTH = 6;
const OUTER = RING_RADIUS + RING_WIDTH / 2;
const INNER = RING_RADIUS - RING_WIDTH / 2;
/** Corner radius of a slice, in viewBox units (about 4.5px on the 168px donut). */
const CORNER = 1.1;
/** Gap between two slices, in viewBox units (about 6px on the 168px donut). */
const GAP = 1.5;

/** The stroke width that rounds a sector's corners (see the file comment). */
export const ROUNDED_DONUT_STROKE = CORNER * 2;

/** One slice's angles: where it starts and how far it reaches, in degrees. */
export interface DonutSweep {
  readonly start: number;
  readonly sweep: number;
}

/** Slice angles from shares of a ring whose whole is 100 (donutArcs' `length`), in order from 12 o'clock. */
export function donutSweeps(lengths: readonly number[]): DonutSweep[] {
  let start = 0;
  return lengths.map((length) => {
    const sweep = (length / 100) * 360;
    const slice = { start, sweep };
    start += sweep;
    return slice;
  });
}

function point(radius: number, degrees: number): string {
  const rad = (degrees * Math.PI) / 180;
  const x = CENTRE + radius * Math.sin(rad);
  const y = CENTRE - radius * Math.cos(rad);
  return `${round(x)} ${round(y)}`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The whole ring as one shape (fill-rule evenodd): a lone slice has no neighbour to leave a gap for. */
export function fullRingPath(): string {
  const ring = (r: number, sweepFlag: 0 | 1) =>
    `M ${CENTRE} ${round(CENTRE - r)} A ${r} ${r} 0 1 ${sweepFlag} ${CENTRE} ${round(CENTRE + r)} ` +
    `A ${r} ${r} 0 1 ${sweepFlag} ${CENTRE} ${round(CENTRE - r)} Z`;
  return `${ring(OUTER, 1)} ${ring(INNER, 0)}`;
}

/**
 * The path of one rounded slice from `start` through `sweep` degrees, already inset for the rounding stroke.
 * `spaced` leaves half a gap at each end (false for a lone slice growing in). A slice too thin for its
 * corners collapses to a sliver, which the stroke draws as a small rounded tick.
 */
export function roundedSlicePath(start: number, sweep: number, spaced = true): string {
  const outer = OUTER - CORNER;
  const inner = INNER + CORNER;
  const pad = (spaced ? GAP / 2 : 0) + CORNER;
  const toDeg = (length: number, radius: number) => (length / radius) * (180 / Math.PI);

  const span = (radius: number): [number, number] => {
    const inset = toDeg(pad, radius);
    const from = start + inset;
    const to = start + sweep - inset;
    if (to > from) return [from, to];
    const mid = start + sweep / 2;
    return [mid, mid];
  };

  const [o0, o1] = span(outer);
  const [i0, i1] = span(inner);
  const largeOuter = o1 - o0 > 180 ? 1 : 0;
  const largeInner = i1 - i0 > 180 ? 1 : 0;
  return (
    `M ${point(outer, o0)} A ${outer} ${outer} 0 ${largeOuter} 1 ${point(outer, o1)} ` +
    `L ${point(inner, i1)} A ${round(inner)} ${round(inner)} 0 ${largeInner} 0 ${point(inner, i0)} Z`
  );
}

/** Ease-out cubic: fast start, gentle settle. */
export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}
