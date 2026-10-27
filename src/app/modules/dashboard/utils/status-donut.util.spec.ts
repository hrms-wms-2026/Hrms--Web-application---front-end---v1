import { describe, expect, it } from 'vitest';
import { donutArcs } from './status-donut.util';

describe('donutArcs', () => {
  it('turns counts into arcs on a circumference of 100, starting at 12 o\'clock', () => {
    const arcs = donutArcs([
      { key: 'a', count: 3, color: 'green' },
      { key: 'b', count: 0, color: 'red' },
      { key: 'c', count: 1, color: 'amber' }
    ]);

    expect(arcs).toEqual([
      { key: 'a', color: 'green', length: 75, offset: 25 },
      { key: 'c', color: 'amber', length: 25, offset: -50 }
    ]);
  });

  it('is empty when nothing was counted', () => {
    expect(donutArcs([{ key: 'a', count: 0, color: 'green' }])).toEqual([]);
  });
});
