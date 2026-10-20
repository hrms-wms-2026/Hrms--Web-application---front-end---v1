import { GridRect, WidgetSize } from '../models/dashboard-layout.model';
import { MAX_ROWS, autoPlace, clampSize, compact, moveTo, overlaps, pixelToCell, resizeTo } from './grid-math';

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

describe('autoPlace', () => {
  it('places at the origin on an empty grid', () => {
    expect(autoPlace([], 4, 2, 12)).toEqual(r(0, 0, 4, 2));
  });
  it('fills the first free slot scanning rows then columns', () => {
    expect(autoPlace([r(0, 0, 4, 2)], 4, 2, 12)).toEqual(r(4, 0, 4, 2));
  });
  it('wraps to the next row when the row is full', () => {
    expect(autoPlace([r(0, 0, 6, 2), r(6, 0, 6, 2)], 4, 2, 12)).toEqual(r(0, 2, 4, 2));
  });
  it('finds a hole below an obstruction', () => {
    expect(autoPlace([r(0, 0, 12, 1), r(0, 1, 6, 3)], 6, 2, 12)).toEqual(r(6, 1, 6, 2));
  });
  it('throws when the width exceeds the columns', () => {
    expect(() => autoPlace([], 13, 1, 12)).toThrow();
  });
  it('throws when no free slot exists within MAX_ROWS', () => {
    expect(() => autoPlace([r(0, 0, 4, MAX_ROWS)], 4, 1, 4)).toThrow();
  });
});

describe('compact', () => {
  it('floats items up to the top', () => {
    const out = compact([item('a', r(0, 5, 4, 2))]);
    expect(out[0].rect).toEqual(r(0, 0, 4, 2));
  });
  it('stacks below an item in the same columns', () => {
    const out = compact([item('a', r(0, 0, 4, 2)), item('b', r(0, 6, 4, 2))]);
    expect(out.find(i => i.id === 'b')!.rect.y).toBe(2);
  });
  it('lets non-overlapping columns float independently', () => {
    const out = compact([item('a', r(0, 0, 4, 3)), item('b', r(4, 7, 4, 2))]);
    expect(out.find(i => i.id === 'b')!.rect.y).toBe(0);
  });
  it('does not mutate its input', () => {
    const input = [item('a', r(0, 5, 4, 2))];
    compact(input);
    expect(input[0].rect.y).toBe(5);
  });
  it('is idempotent', () => {
    const once = compact([item('a', r(0, 4, 4, 2)), item('b', r(2, 9, 6, 3)), item('c', r(8, 1, 4, 2))]);
    expect(compact(once)).toEqual(once);
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

describe('moveTo', () => {
  it('moveTo_pushes_collider_down_without_overlap', () => {
    const items = [item('a', r(0, 0, 4, 2)), item('b', r(4, 0, 4, 2)), item('c', r(4, 2, 4, 2))];
    const out = moveTo(items, 'a', 4, 0, 12);
    expect(anyOverlap(out)).toBe(false);
    expect(out.find(i => i.id === 'a')!.rect).toEqual(r(4, 0, 4, 2));
    expect(out.find(i => i.id === 'b')!.rect.y).toBeGreaterThanOrEqual(2);
    expect(out.find(i => i.id === 'c')!.rect.y).toBeGreaterThanOrEqual(out.find(i => i.id === 'b')!.rect.y + 2);
  });
  it('clamps x so the item stays within the columns', () => {
    const out = moveTo([item('a', r(0, 0, 4, 2))], 'a', 99, 0, 12);
    expect(out[0].rect.x).toBe(8);
  });
  it('clamps negative coordinates to zero', () => {
    const out = moveTo([item('a', r(2, 2, 4, 2)), item('b', r(0, 6, 2, 2))], 'a', -3, -3, 12);
    expect(out.find(i => i.id === 'a')!.rect.x).toBe(0);
    expect(out.find(i => i.id === 'a')!.rect.y).toBe(0);
  });
  it('compacts the result', () => {
    const out = moveTo([item('a', r(0, 0, 4, 2)), item('b', r(4, 5, 4, 2))], 'a', 8, 0, 12);
    expect(out.find(i => i.id === 'b')!.rect.y).toBe(0);
  });
  it('snaps fractional targets to integers', () => {
    const out = moveTo([item('a', r(0, 0, 4, 2))], 'a', 2.6, 0, 12);
    expect(out[0].rect.x).toBe(3);
  });
  it('does not mutate its input', () => {
    const input = [item('a', r(0, 0, 4, 2)), item('b', r(4, 0, 4, 2))];
    moveTo(input, 'a', 4, 0, 12);
    expect(input[0].rect).toEqual(r(0, 0, 4, 2));
  });
  it('returns the items unchanged for an unknown id', () => {
    const input = [item('a', r(0, 0, 4, 2))];
    expect(moveTo(input, 'zzz', 1, 1, 12)).toEqual(input);
  });
});

describe('resizeTo', () => {
  it('resizeTo_never_exceeds_max_or_columns', () => {
    const items = [item('a', r(8, 0, 4, 2))];
    const big = resizeTo(items, 'a', 50, 50, size, 12);
    expect(big[0].rect.w).toBeLessThanOrEqual(8);
    expect(big[0].rect.h).toBeLessThanOrEqual(6);
    expect(big[0].rect.x + big[0].rect.w).toBeLessThanOrEqual(12);
    const narrow = resizeTo([item('a', r(0, 0, 3, 2))], 'a', 50, 2, { ...size, maxW: 12 }, 4);
    expect(narrow[0].rect.w).toBeLessThanOrEqual(4);
    expect(narrow[0].rect.x + narrow[0].rect.w).toBeLessThanOrEqual(4);
  });
  it('never goes below the minimum', () => {
    const out = resizeTo([item('a', r(0, 0, 4, 4))], 'a', 0, 0, size, 12);
    expect(out[0].rect.w).toBe(2);
    expect(out[0].rect.h).toBe(2);
  });
  it('snaps fractional sizes to integers', () => {
    const out = resizeTo([item('a', r(0, 0, 4, 4))], 'a', 5.4, 3.6, size, 12);
    expect(out[0].rect.w).toBe(5);
    expect(out[0].rect.h).toBe(4);
  });
  it('pushes colliders down without overlap', () => {
    const items = [item('a', r(0, 0, 4, 2)), item('b', r(4, 0, 4, 2)), item('c', r(4, 2, 4, 2))];
    const out = resizeTo(items, 'a', 6, 2, size, 12);
    expect(anyOverlap(out)).toBe(false);
    expect(out.find(i => i.id === 'a')!.rect.w).toBe(6);
  });
  it('pulls a shrinking neighbour column up via compaction', () => {
    const items = [item('a', r(0, 0, 4, 4)), item('b', r(0, 4, 4, 2))];
    const out = resizeTo(items, 'a', 4, 2, size, 12);
    expect(out.find(i => i.id === 'b')!.rect.y).toBe(2);
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
