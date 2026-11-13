import { describe, expect, it } from 'vitest';
import { MIN_SLICE_SWEEP, donutSweeps } from './rounded-donut.util';

describe('donutSweeps', () => {
  it('turns shares of 100 into angles from 12 o\'clock', () => {
    expect(donutSweeps([25, 75])).toEqual([
      { start: 0, sweep: 90 },
      { start: 90, sweep: 270 }
    ]);
  });

  it('gives a tiny non-zero slice room for its rounded corners and gaps, taken from the bigger slices', () => {
    const sweeps = donutSweeps([12, 21, 6.5, 0.02, 60.48]);
    expect(sweeps[3].sweep).toBeCloseTo(MIN_SLICE_SWEEP, 6);
    // Still a whole ring, still in order, no overlaps.
    expect(sweeps.reduce((sum, s) => sum + s.sweep, 0)).toBeCloseTo(360, 6);
    sweeps.slice(1).forEach((s, i) => expect(s.start).toBeCloseTo(sweeps[i].start + sweeps[i].sweep, 6));
    // The bigger slices give the room up in proportion, so their order by size is unchanged.
    expect(sweeps[4].sweep).toBeGreaterThan(sweeps[1].sweep);
    expect(sweeps[2].sweep).toBeGreaterThan(MIN_SLICE_SWEEP);
  });

  it('leaves zero slices at zero and a lone slice whole', () => {
    expect(donutSweeps([0, 100]).map((s) => s.sweep)).toEqual([0, 360]);
    expect(donutSweeps([100]).map((s) => s.sweep)).toEqual([360]);
  });
});
