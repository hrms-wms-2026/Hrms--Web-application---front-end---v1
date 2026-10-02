import { rangeToPercent } from './calendar-date.utils';

describe('rangeToPercent', () => {
  it('places a range as left/width percentages of the window, clamped to [0,100]', () => {
    const r = rangeToPercent('2026-03-11', '2026-03-20', '2026-03-01', '2026-03-31');
    expect(Math.round(r.leftPct)).toBe(32);
    expect(Math.round(r.widthPct)).toBe(32);
  });

  it('clamps a range that starts before the window', () => {
    const r = rangeToPercent('2026-02-01', '2026-03-05', '2026-03-01', '2026-03-31');
    expect(r.leftPct).toBe(0);
  });
});
