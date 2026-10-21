import { GridRect, WidgetSize } from '../models/dashboard-layout.model';

/**
 * Pure dashboard grid math. Mirrors the backend DashboardGrid (Overlaps / AutoPlace / Compact) so the client
 * preview and the server validation agree. Nothing here mutates its input.
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

/** First free slot scanning rows top to bottom, then columns left to right. */
export function autoPlace(occupied: GridRect[], w: number, h: number, cols: number): GridRect {
  if (w < 1 || h < 1 || w > cols) {
    throw new RangeError('Widget size must be at least 1x1 and fit within the column count.');
  }
  if (h > MAX_ROWS) {
    throw new RangeError('Widget height exceeds the maximum row count.');
  }
  for (let y = 0; y + h <= MAX_ROWS; y++) {
    for (let x = 0; x <= cols - w; x++) {
      const candidate: GridRect = { x, y, w, h };
      if (!occupied.some(o => overlaps(o, candidate))) {
        return candidate;
      }
    }
  }
  throw new Error(`No free slot within ${MAX_ROWS} rows.`);
}

/**
 * Gravity compaction: each item (visited top-to-bottom, then left-to-right) drops straight to the bottom edge of
 * the lowest already-placed item above it that shares columns, or to row 0 when there is none.
 */
export function compact<T extends { rect: GridRect }>(items: T[]): T[] {
  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.rect.y - b.item.rect.y || a.item.rect.x - b.item.rect.x || a.index - b.index);
  const placed: GridRect[] = [];
  const result = new Map<T, T>();
  for (const { item } of ordered) {
    const rect = item.rect;
    let floor = 0;
    for (const p of placed) {
      const sharesColumns = p.x < rect.x + rect.w && rect.x < p.x + p.w;
      const bottom = p.y + p.h;
      if (sharesColumns && bottom <= rect.y && bottom > floor) {
        floor = bottom;
      }
    }
    const next: GridRect = { ...rect, y: Math.min(floor, rect.y) };
    placed.push(next);
    result.set(item, { ...item, rect: next });
  }
  return items.map(item => result.get(item) as T);
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

/** Pushes every item overlapping the anchor below it, recursively. Mutates the working list only. */
function pushColliders(list: GridItem[], anchorId: string): void {
  const queue = [anchorId];
  let guard = list.length * list.length + 8;
  while (queue.length > 0 && guard-- > 0) {
    const anchorKey = queue.shift();
    const anchor = list.find(i => i.id === anchorKey);
    if (!anchor) continue;
    for (let i = 0; i < list.length; i++) {
      const other = list[i];
      if (other.id !== anchor.id && overlaps(anchor.rect, other.rect)) {
        list[i] = { ...other, rect: { ...other.rect, y: anchor.rect.y + anchor.rect.h } };
        queue.push(other.id);
      }
    }
  }
}

function place<T extends GridItem>(items: T[], id: string, rect: GridRect): T[] {
  const list = items.map(i => (i.id === id ? { ...i, rect } : { ...i }));
  pushColliders(list, id);
  return compact(list);
}

/**
 * Moving down: the others are compacted first (as if the moved item were lifted out), then the moved item settles
 * below every neighbour that starts above its target row (they swap places with it); neighbours starting at or
 * below the target row are pushed down. Without this, pushing the lower neighbour down and compacting would just
 * float the moved item back to where it started.
 */
function placeBelow<T extends GridItem>(items: T[], id: string, rect: GridRect): T[] {
  const moved = items.find(i => i.id === id) as T;
  const others = compact(items.filter(i => i.id !== id));
  const target = { ...rect };
  let guard = others.length + 1;
  let passed = others.filter(o => overlaps(o.rect, target) && o.rect.y < target.y);
  while (passed.length > 0 && guard-- > 0) {
    target.y = Math.max(...passed.map(o => o.rect.y + o.rect.h));
    passed = others.filter(o => overlaps(o.rect, target) && o.rect.y < target.y);
  }
  const byId = new Map<string, T>(others.map(o => [o.id, o]));
  byId.set(id, { ...moved, rect: target });
  const list = items.map(i => ({ ...(byId.get(i.id) as T) }));
  pushColliders(list, id);
  return compact(list);
}

/**
 * Moves an item to (x, y) (snapped, clamped to the grid). Moving up or sideways pushes colliders down; moving
 * down swaps with the neighbours passed over (see placeBelow). The result is always compacted with no overlap.
 */
export function moveTo<T extends GridItem>(items: T[], id: string, x: number, y: number, cols: number): T[] {
  const current = items.find(i => i.id === id);
  if (!current) return items;
  const rect: GridRect = {
    ...current.rect,
    x: clamp(Math.round(x), 0, Math.max(cols - current.rect.w, 0)),
    y: Math.max(Math.round(y), 0)
  };
  return rect.y > current.rect.y ? placeBelow(items, id, rect) : place(items, id, rect);
}

/** Resizes an item (snapped to integers within its size limits and the columns), pushes colliders down, compacts. */
export function resizeTo<T extends GridItem>(
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
  return place(items, id, rect);
}

/** Snaps a pixel distance/offset to the nearest whole number of cells (cell pitch = cell size + gap). */
export function pixelToCell(px: number, cellPx: number, gapPx: number): number {
  const pitch = cellPx + gapPx;
  if (pitch <= 0) return 0;
  const cell = Math.round(px / pitch);
  return cell === 0 ? 0 : cell;
}
