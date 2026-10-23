import { toOffsetIso, toZonedParts } from './meeting-time';

describe('meeting-time', () => {
  it('turns a wall-clock time in a zone into an ISO string with that zone\'s offset', () => {
    expect(toOffsetIso('2026-11-02', '09:00', 'Asia/Colombo')).toBe('2026-11-02T09:00:00+05:30');
    expect(toOffsetIso('2026-11-02', '09:00', 'UTC')).toBe('2026-11-02T09:00:00+00:00');
  });

  it('uses the offset in force on that date (daylight saving)', () => {
    expect(toOffsetIso('2026-07-01', '09:00', 'America/New_York')).toBe('2026-07-01T09:00:00-04:00');
    expect(toOffsetIso('2026-12-01', '09:00', 'America/New_York')).toBe('2026-12-01T09:00:00-05:00');
  });

  it('shows a UTC instant as date and time in the meeting\'s zone', () => {
    expect(toZonedParts('2026-11-02T03:30:00Z', 'Asia/Colombo')).toEqual({ date: '2026-11-02', time: '09:00' });
  });
});
