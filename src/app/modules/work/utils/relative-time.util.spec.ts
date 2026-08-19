import { formatRelativeTime } from './relative-time.util';

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-13T12:00:00Z');

  it('returns null for a null date', () => {
    expect(formatRelativeTime(null, now)).toBeNull();
  });

  it('returns null for an unparsable date', () => {
    expect(formatRelativeTime('not-a-date', now)).toBeNull();
  });

  it('returns "Updated just now" for under a minute', () => {
    expect(formatRelativeTime('2026-08-13T11:59:30Z', now)).toBe('Updated just now');
  });

  it('returns singular minute', () => {
    expect(formatRelativeTime('2026-08-13T11:59:00Z', now)).toBe('Updated 1 minute ago');
  });

  it('returns plural minutes', () => {
    expect(formatRelativeTime('2026-08-13T11:45:00Z', now)).toBe('Updated 15 minutes ago');
  });

  it('returns singular hour', () => {
    expect(formatRelativeTime('2026-08-13T11:00:00Z', now)).toBe('Updated 1 hour ago');
  });

  it('returns plural hours', () => {
    expect(formatRelativeTime('2026-08-13T07:00:00Z', now)).toBe('Updated 5 hours ago');
  });

  it('returns singular day', () => {
    expect(formatRelativeTime('2026-08-12T12:00:00Z', now)).toBe('Updated 1 day ago');
  });

  it('returns plural days', () => {
    expect(formatRelativeTime('2026-08-08T12:00:00Z', now)).toBe('Updated 5 days ago');
  });

  it('returns plural months for over 30 days', () => {
    expect(formatRelativeTime('2026-06-08T12:00:00Z', now)).toBe('Updated 2 months ago');
  });

  it('returns plural years for over 12 months', () => {
    expect(formatRelativeTime('2024-08-13T12:00:00Z', now)).toBe('Updated 2 years ago');
  });
});
