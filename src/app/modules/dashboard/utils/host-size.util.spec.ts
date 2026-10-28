import { describe, expect, it } from 'vitest';
import { isCompactSize } from './host-size.util';

describe('isCompactSize', () => {
  it.each([
    [206, 204, true],
    [292, 204, true],
    [206, 420, true],
    [315, 312, false],
    [640, 420, false]
  ] as const)('%ix%i compact = %s', (width, height, compact) => {
    expect(isCompactSize({ width, height }, 260, 260)).toBe(compact);
  });

  it('is not compact before the first layout', () => {
    expect(isCompactSize({ width: 0, height: 0 }, 260, 260)).toBe(false);
    expect(isCompactSize({ width: 300, height: 0 }, 260, 260)).toBe(false);
  });
});
