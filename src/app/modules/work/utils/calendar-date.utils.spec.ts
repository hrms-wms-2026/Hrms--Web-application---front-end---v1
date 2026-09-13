import { addCalendarMonths, intersectRanges, rangeToPercent } from './calendar-date.utils';

describe('intersectRanges', () => {
  it('returns the overlap of two inclusive ranges', () => {
    expect(intersectRanges('2026-03-01', '2026-03-31', '2026-03-20', '2026-04-10'))
      .toEqual({ start: '2026-03-20', end: '2026-03-31' });
  });

  it('returns null when the ranges do not touch', () => {
    expect(intersectRanges('2026-03-01', '2026-03-10', '2026-03-20', '2026-03-25')).toBeNull();
  });
});

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

describe('addCalendarMonths', () => {
  it('adds months within the same year', () => {
    expect(addCalendarMonths('2026-05-01', 2)).toBe('2026-07-01');
  });

  it('rolls over into the next year', () => {
    expect(addCalendarMonths('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('rolls back into the previous year', () => {
    expect(addCalendarMonths('2026-02-10', -3)).toBe('2025-11-10');
  });

  it('supports a zero-month no-op', () => {
    expect(addCalendarMonths('2026-05-01', 0)).toBe('2026-05-01');
  });
});
