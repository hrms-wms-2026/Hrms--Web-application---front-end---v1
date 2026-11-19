import { formatOldestWaiting } from './oldest-pending.util';

describe('formatOldestWaiting', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('returns null for a null timestamp', () => {
    expect(formatOldestWaiting(null, now)).toBeNull();
  });

  it('shows <1h for less than an hour', () => {
    expect(formatOldestWaiting('2026-09-30T11:40:00Z', now)).toBe('oldest waiting <1h');
  });

  it('shows hours under a day', () => {
    expect(formatOldestWaiting('2026-09-30T09:00:00Z', now)).toBe('oldest waiting 3h');
  });

  it('shows days at or beyond 24 hours', () => {
    expect(formatOldestWaiting('2026-09-28T12:00:00Z', now)).toBe('oldest waiting 2d');
  });
});
