import { GridRect, WidgetSize } from '../models/dashboard-layout.model';

/**
 * Pure dashboard grid math for the customize mode: home-screen packing (reading order, pack, reorder, resize) and
 * the size clamp the backend validates against. Nothing here mutates its input.
 */

/** Same cap as the backend DashboardGrid.MaxRows. */
export const MAX_ROWS = 200;

export interface GridItem {
  id: string;
  rect: GridRect;
}

export function overlaps(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

function sizeBounds(size: WidgetSize, cols: number) {
  const maxW = Math.min(size.maxW, cols);
  const minW = Math.min(size.minW, maxW);
  return { minW, maxW, minH: size.minH, maxH: Math.max(size.maxH, size.minH) };
}

/** Clamps width/height into the widget size limits (and the column count) and keeps the rect inside the grid. */
export function clampSize(rect: GridRect, size: WidgetSize, cols: number): GridRect {
  const b = sizeBounds(size, cols);
  const w = clamp(Math.round(rect.w), b.minW, b.maxW);
  const h = clamp(Math.round(rect.h), b.minH, b.maxH);
  const x = clamp(Math.round(rect.x), 0, Math.max(cols - w, 0));
  const y = Math.max(Math.round(rect.y), 0);
  return { x, y, w, h };
}

/** Reading order: top to bottom, then left to right (ties keep their input order). */
export function readingOrder<T extends GridItem>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.rect.y - b.item.rect.y || a.item.rect.x - b.item.rect.x || a.index - b.index)
    .map(e => e.item);
}

/**
 * Home-screen packing: the items keep the given order and each takes the first free slot at or after the previous
 * item's slot (row by row, left to right). Moving one item earlier in the order pushes the later ones along instead
 * of covering them, the way icons make room on a phone's home screen. Never overlaps. Returns the items in `ordered`
 * order with their new rects.
 */
export function pack<T extends GridItem>(ordered: T[], cols: number): T[] {
  const placed: GridRect[] = [];
  let cursorY = 0;
  let cursorX = 0;
  return ordered.map(item => {
    const w = Math.min(Math.max(1, item.rect.w), cols);
    const h = Math.max(1, item.rect.h);
    for (let y = cursorY; y + h <= MAX_ROWS; y++) {
      for (let x = y === cursorY ? cursorX : 0; x <= cols - w; x++) {
        const candidate: GridRect = { x, y, w, h };
        if (!placed.some(p => overlaps(p, candidate))) {
          placed.push(candidate);
          cursorY = y;
          cursorX = x;
          return { ...item, rect: candidate };
        }
      }
    }
    throw new Error(`No free slot within ${MAX_ROWS} rows.`);
  });
}

/** Packs the items in their reading order. The result keeps the input array order. */
export function packInPlace<T extends GridItem>(items: T[], cols: number): T[] {
  const byId = new Map(pack(readingOrder(items), cols).map(i => [i.id, i]));
  return items.map(i => byId.get(i.id) as T);
}

/**
 * Moves an item to position `index` of the reading order (clamped), then packs: the items between its old and new
 * place shift by one slot to make room. The result keeps the input array order.
 */
export function reorderTo<T extends GridItem>(items: T[], id: string, index: number, cols: number): T[] {
  const order = readingOrder(items);
  const from = order.findIndex(i => i.id === id);
  if (from < 0) return items;
  const [moving] = order.splice(from, 1);
  order.splice(clamp(Math.round(index), 0, order.length), 0, moving);
  const byId = new Map(pack(order, cols).map(i => [i.id, i]));
  return items.map(i => byId.get(i.id) as T);
}

/** Resizes an item within its size limits and the columns, then packs in reading order. Keeps the input order. */
export function resizePacked<T extends GridItem>(
  items: T[],
  id: string,
  w: number,
  h: number,
  size: WidgetSize,
  cols: number
): T[] {
  const current = items.find(i => i.id === id);
  if (!current) return items;
  const rect = clampSize({ ...current.rect, w, h }, size, cols);
  return packInPlace(items.map(i => (i.id === id ? { ...i, rect } : i)), cols);
}

/** Snaps a pixel distance/offset to the nearest whole number of cells (cell pitch = cell size + gap). */
export function pixelToCell(px: number, cellPx: number, gapPx: number): number {
  const pitch = cellPx + gapPx;
  if (pitch <= 0) return 0;
  const cell = Math.round(px / pitch);
  return cell === 0 ? 0 : cell;
}
