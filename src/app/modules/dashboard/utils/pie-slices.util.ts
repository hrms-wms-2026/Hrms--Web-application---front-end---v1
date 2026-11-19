export interface PieInput {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

export interface PieSlice extends PieInput {
  readonly percent: number;
  /** SVG path in a 72x72 viewBox; empty when `isFull`. */
  readonly path: string;
  /** The only non-zero slice - drawn as a full circle, since an arc can't close on itself. */
  readonly isFull: boolean;
}

const CX = 36;
const CY = 36;
const R = 34;

/** Pie slices for a 72x72 SVG, starting at 12 o'clock - the same geometry as the Employee Detail
 * Work Management pie, so the two charts read identically. Zero-count items are dropped. */
export function buildPieSlices(items: readonly PieInput[]): PieSlice[] {
  const present = items.filter((item) => item.count > 0);
  const total = present.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return [];
  if (present.length === 1) return [{ ...present[0], percent: 100, path: '', isFull: true }];

  let angle = -Math.PI / 2;
  return present.map((item, index) => {
    const sweep = (item.count / total) * 2 * Math.PI;
    const start = angle;
    const end = index === present.length - 1 ? (3 * Math.PI) / 2 : angle + sweep;
    angle = end;
    const x1 = CX + R * Math.cos(start);
    const y1 = CY + R * Math.sin(start);
    const x2 = CX + R * Math.cos(end);
    const y2 = CY + R * Math.sin(end);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return {
      ...item,
      percent: Math.round((item.count / total) * 100),
      path: `M ${CX} ${CY} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`,
      isFull: false
    };
  });
}
