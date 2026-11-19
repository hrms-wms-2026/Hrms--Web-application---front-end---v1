import { GridRect, WidgetSize } from '../models/dashboard-layout.model';
import { clampSize, overlaps, pack, pixelToCell, readingOrder, reorderTo, resizePacked } from './grid-math';

const r = (x: number, y: number, w: number, h: number): GridRect => ({ x, y, w, h });
const item = (id: string, rect: GridRect) => ({ id, rect });
const size: WidgetSize = { minW: 2, minH: 2, maxW: 8, maxH: 6 };

function anyOverlap(items: { rect: GridRect }[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlaps(items[i].rect, items[j].rect)) return true;
    }
  }
  return false;
}

describe('overlaps', () => {
  it('is false for edge-touching rects', () => {
    expect(overlaps(r(0, 0, 4, 2), r(4, 0, 4, 2))).toBe(false);
    expect(overlaps(r(0, 0, 4, 2), r(0, 2, 4, 2))).toBe(false);
  });
  it('is true when rects intersect', () => {
    expect(overlaps(r(0, 0, 4, 2), r(3, 1, 4, 2))).toBe(true);
  });
});

describe('clampSize', () => {
  it('clamps width and height into size limits', () => {
    expect(clampSize(r(0, 0, 1, 9), size, 12)).toEqual(r(0, 0, 2, 6));
  });
  it('limits width to the columns and keeps the rect inside them', () => {
    const out = clampSize(r(10, 0, 6, 2), { ...size, maxW: 12 }, 6);
    expect(out.w).toBe(6);
    expect(out.x + out.w).toBeLessThanOrEqual(6);
  });
  it('lowers minW to the column count on narrow breakpoints', () => {
    expect(clampSize(r(0, 0, 1, 2), { minW: 6, minH: 2, maxW: 12, maxH: 4 }, 4).w).toBe(4);
  });
});

describe('pixelToCell', () => {
  it('snaps a pixel distance to the nearest cell pitch', () => {
    expect(pixelToCell(0, 96, 12)).toBe(0);
    expect(pixelToCell(108, 96, 12)).toBe(1);
    expect(pixelToCell(160, 96, 12)).toBe(1);
    expect(pixelToCell(170, 96, 12)).toBe(2);
  });
  it('supports negative distances', () => {
    expect(pixelToCell(-108, 96, 12)).toBe(-1);
  });
  it('returns 0 for a non-positive pitch', () => {
    expect(pixelToCell(50, 0, 0)).toBe(0);
  });
});

describe('home-screen packing', () => {
  const ids = (items: { id: string }[]) => items.map(i => i.id);

  it('reads top to bottom, then left to right', () => {
    const items = [item('c', r(0, 3, 2, 2)), item('b', r(4, 0, 2, 2)), item('a', r(0, 0, 4, 2))];
    expect(ids(readingOrder(items))).toEqual(['a', 'b', 'c']);
  });

  it('packs in order into the first free slot after the previous item, never overlapping', () => {
    const out = pack([item('a', r(9, 9, 4, 2)), item('b', r(0, 0, 4, 3)), item('c', r(0, 0, 6, 2))], 12);
    expect(out.map(i => i.rect)).toEqual([r(0, 0, 4, 2), r(4, 0, 4, 3), r(0, 3, 6, 2)]);
    expect(anyOverlap(out)).toBe(false);
  });

  it('packs around reserved cells (the pinned corner), using the space beside them', () => {
    const corner = r(8, 0, 4, 1);
    const out = pack([item('a', r(0, 0, 4, 3)), item('b', r(0, 0, 4, 3)), item('c', r(0, 0, 4, 2))], 12, [corner]);
    expect(out.map(i => i.rect)).toEqual([r(0, 0, 4, 3), r(4, 0, 4, 3), r(8, 1, 4, 2)]);
    expect(out.some(i => overlaps(i.rect, corner))).toBe(false);
    const moved = reorderTo(out, 'c', 0, 12, [corner]);
    expect(moved.some(i => overlaps(i.rect, corner))).toBe(false);
    const resized = resizePacked(out, 'a', 8, 2, size, 12, [corner]);
    expect(resized.some(i => overlaps(i.rect, corner))).toBe(false);
  });

  it('dropping a widget onto an earlier place pushes the others along instead of covering them', () => {
    const items = [item('a', r(0, 0, 4, 2)), item('b', r(4, 0, 4, 2)), item('c', r(8, 0, 4, 2))];
    const out = reorderTo(items, 'c', 0, 12);
    expect(ids(readingOrder(out))).toEqual(['c', 'a', 'b']);
    expect(out.find(i => i.id === 'c')!.rect).toEqual(r(0, 0, 4, 2));
    expect(out.find(i => i.id === 'a')!.rect).toEqual(r(4, 0, 4, 2));
    expect(out.find(i => i.id === 'b')!.rect).toEqual(r(8, 0, 4, 2));
    expect(ids(out)).toEqual(['a', 'b', 'c']);
  });

  it('moving later lets the passed widgets step back, and wraps what no longer fits', () => {
    const items = [item('a', r(0, 0, 6, 2)), item('b', r(6, 0, 6, 2)), item('c', r(0, 2, 4, 2))];
    const out = reorderTo(items, 'a', 2, 12);
    expect(out.find(i => i.id === 'b')!.rect).toEqual(r(0, 0, 6, 2));
    expect(out.find(i => i.id === 'c')!.rect).toEqual(r(6, 0, 4, 2));
    expect(out.find(i => i.id === 'a')!.rect).toEqual(r(0, 2, 6, 2));
    expect(reorderTo(items, 'a', 99, 12).find(i => i.id === 'a')!.rect).toEqual(r(0, 2, 6, 2));
    expect(reorderTo(items, 'zzz', 0, 12)).toBe(items);
  });

  it('resizing re-packs the neighbours and respects the size limits', () => {
    const items = [item('a', r(0, 0, 4, 2)), item('b', r(4, 0, 4, 2)), item('c', r(8, 0, 4, 2))];
    const grown = resizePacked(items, 'a', 6, 2, size, 12);
    expect(grown.map(i => i.rect)).toEqual([r(0, 0, 6, 2), r(6, 0, 4, 2), r(0, 2, 4, 2)]);
    const shrunk = resizePacked(items, 'a', 1, 1, size, 12);
    expect(shrunk[0].rect).toEqual(r(0, 0, 2, 2));
    expect(shrunk[1].rect).toEqual(r(2, 0, 4, 2));
    expect(anyOverlap(grown) || anyOverlap(shrunk)).toBe(false);
  });
});
