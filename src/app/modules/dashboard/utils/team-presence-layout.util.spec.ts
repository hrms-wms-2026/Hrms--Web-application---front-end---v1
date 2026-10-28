import { describe, expect, it } from 'vitest';
import { PRESENCE_BREAKPOINTS, classifyPresenceSize, presenceView } from './team-presence-layout.util';

/** Card host size for grid columns / rows (about 97px columns at 1440px, 96px rows, 12px gaps). */
const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

describe('Working / Break / Leave layout', () => {
  it.each([
    [cols(2), rows(2), 'mini'],
    [cols(8), rows(2), 'mini'],
    [cols(2), rows(6), 'mini'],
    [cols(4), rows(4), 'medium'],
    [cols(8), rows(4), 'medium'],
    [cols(8), rows(6), 'large'],
    [cols(12), rows(8), 'large']
  ] as const)('%ix%i is %s', (w, h, view) => {
    expect(classifyPresenceSize(w, h)).toBe(view);
  });

  it('switches exactly at each breakpoint', () => {
    const b = PRESENCE_BREAKPOINTS;
    expect(classifyPresenceSize(b.mediumWidth - 1, 400)).toBe('mini');
    expect(classifyPresenceSize(b.mediumWidth, 400)).toBe('medium');
    expect(classifyPresenceSize(400, b.mediumHeight - 1)).toBe('mini');
    expect(classifyPresenceSize(400, b.mediumHeight)).toBe('medium');
    expect(classifyPresenceSize(b.largeWidth - 1, 600)).toBe('medium');
    expect(classifyPresenceSize(b.largeWidth, 600)).toBe('large');
    expect(classifyPresenceSize(800, b.largeHeight - 1)).toBe('medium');
    expect(classifyPresenceSize(800, b.largeHeight)).toBe('large');
    expect(classifyPresenceSize(b.largeWidth + 1, b.largeHeight + 1)).toBe('large');
  });

  it('keeps the previous view inside the 20px hysteresis band, in both directions', () => {
    const b = PRESENCE_BREAKPOINTS;
    expect(presenceView(b.largeWidth - 15, 600, 'large')).toBe('large');
    expect(presenceView(b.largeWidth - 25, 600, 'large')).toBe('medium');
    expect(presenceView(b.largeWidth + 15, 600, 'medium')).toBe('medium');
    expect(presenceView(b.largeWidth + 25, 600, 'medium')).toBe('large');
    expect(presenceView(400, b.mediumHeight - 15, 'medium')).toBe('medium');
    expect(presenceView(400, b.mediumHeight + 15, 'mini')).toBe('mini');
    expect(presenceView(400, b.mediumHeight + 25, 'mini')).toBe('medium');
  });

  it('keeps the previous view (or medium) for a zero size', () => {
    expect(presenceView(0, 0, 'large')).toBe('large');
    expect(presenceView(0, 300)).toBe('medium');
  });
});
