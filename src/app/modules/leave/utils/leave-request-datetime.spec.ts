import { formatHours, resolveLeaveEndDate, toLeaveSubmitDateTimes } from './leave-request-datetime';

describe('leave-request-datetime', () => {
  it('maps afternoon 14:00–18:00 on 2026-09-09 in UTC to StartAt/EndAt ISO', () => {
    expect(
      toLeaveSubmitDateTimes(
        { startDate: '2026-09-09', startTime: '14:00', endDate: '2026-09-09', endTime: '18:00' },
        '09:00',
        '18:00',
        'UTC'
      )
    ).toEqual({
      startAt: '2026-09-09T14:00:00.000Z',
      endAt: '2026-09-09T18:00:00.000Z'
    });
  });

  it('defaults empty times to the work window', () => {
    expect(
      toLeaveSubmitDateTimes(
        { startDate: '2026-09-09', startTime: '', endDate: '2026-09-09', endTime: '' },
        '09:00',
        '18:00',
        'UTC'
      )
    ).toEqual({
      startAt: '2026-09-09T09:00:00.000Z',
      endAt: '2026-09-09T18:00:00.000Z'
    });
  });

  it('returns null when the work window is missing and times are empty', () => {
    expect(
      toLeaveSubmitDateTimes(
        { startDate: '2026-09-09', startTime: '', endDate: '2026-09-09', endTime: '' },
        null,
        null,
        'UTC'
      )
    ).toBeNull();
  });

  it('bumps overnight same-day end to the next calendar day', () => {
    expect(resolveLeaveEndDate('2026-09-09', '2026-09-09', '22:00', '06:00')).toBe('2026-09-10');
    expect(
      toLeaveSubmitDateTimes(
        { startDate: '2026-09-09', startTime: '22:00', endDate: '2026-09-09', endTime: '06:00' },
        '22:00',
        '06:00',
        'UTC'
      )
    ).toEqual({
      startAt: '2026-09-09T22:00:00.000Z',
      endAt: '2026-09-10T06:00:00.000Z'
    });
  });

  it('formats hours with two decimals', () => {
    expect(formatHours(8)).toBe('8.00');
    expect(formatHours(16.5)).toBe('16.50');
  });
});
