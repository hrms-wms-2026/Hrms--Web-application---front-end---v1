import { describe, expect, it } from 'vitest';
import { buildPieSlices } from './pie-slices.util';

describe('buildPieSlices', () => {
  it('returns nothing when every count is zero', () => {
    expect(buildPieSlices([{ key: 'a', label: 'A', count: 0, color: '#000' }])).toEqual([]);
  });

  it('draws a single non-zero item as a full circle', () => {
    const slices = buildPieSlices([
      { key: 'a', label: 'A', count: 3, color: '#000' },
      { key: 'b', label: 'B', count: 0, color: '#fff' }
    ]);
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ key: 'a', isFull: true, percent: 100 });
  });

  it('splits the circle by count with rounded percentages, dropping zero items', () => {
    const slices = buildPieSlices([
      { key: 'a', label: 'A', count: 1, color: '#000' },
      { key: 'b', label: 'B', count: 0, color: '#111' },
      { key: 'c', label: 'C', count: 3, color: '#222' }
    ]);
    expect(slices.map((s) => [s.key, s.percent])).toEqual([['a', 25], ['c', 75]]);
    expect(slices.every((s) => s.path.startsWith('M 36 36'))).toBe(true);
  });
});
