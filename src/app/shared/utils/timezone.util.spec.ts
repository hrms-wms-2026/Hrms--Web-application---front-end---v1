import { describe, expect, it } from 'vitest';
import { dateOnlyInTimezone, isValidTimezone, localPartsToUtcIso, utcIsoToLocalParts } from './timezone.util';

describe('timezone.util', () => {
  describe('isValidTimezone', () => {
    it('accepts a real IANA id', () => {
      expect(isValidTimezone('Asia/Colombo')).toBe(true);
    });

    it('rejects a bogus id', () => {
      expect(isValidTimezone('Not/AZone')).toBe(false);
    });
  });

  describe('dateOnlyInTimezone', () => {
    it('returns the UTC calendar date for the UTC timezone', () => {
      expect(dateOnlyInTimezone('2026-09-01T09:00:00Z', 'UTC')).toBe('2026-09-01');
    });

    it('returns the earlier calendar date for a timezone behind UTC', () => {
      // 2026-09-01T02:00:00Z is still 2026-08-31 in America/New_York (UTC-4 in September, DST)
      expect(dateOnlyInTimezone('2026-09-01T02:00:00Z', 'America/New_York')).toBe('2026-08-31');
    });

    it('returns the later calendar date for a timezone ahead of UTC', () => {
      // 2026-09-01T20:00:00Z is already 2026-09-02 in Asia/Colombo (UTC+5:30)
      expect(dateOnlyInTimezone('2026-09-01T20:00:00Z', 'Asia/Colombo')).toBe('2026-09-02');
    });
  });

  describe('utcIsoToLocalParts', () => {
    it('splits a UTC instant into local date and time for the given timezone', () => {
      expect(utcIsoToLocalParts('2026-09-01T09:00:00Z', 'Asia/Colombo')).toEqual({ date: '2026-09-01', time: '14:30' });
    });
  });

  describe('localPartsToUtcIso', () => {
    it('converts local wall-clock parts back to the correct UTC instant', () => {
      const iso = localPartsToUtcIso('2026-09-01', '14:30', 'Asia/Colombo');
      expect(new Date(iso).toISOString()).toBe('2026-09-01T09:00:00.000Z');
    });

    it('round-trips through utcIsoToLocalParts', () => {
      const original = '2026-03-10T15:45:00Z';
      const { date, time } = utcIsoToLocalParts(original, 'America/New_York');
      const iso = localPartsToUtcIso(date, time, 'America/New_York');
      expect(new Date(iso).toISOString()).toBe(new Date(original).toISOString());
    });
  });
});
