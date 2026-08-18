import { getDeadlineStatus } from './deadline.util';

describe('getDeadlineStatus', () => {
  const today = new Date('2026-08-13T00:00:00Z');

  it('returns days left for a future date', () => {
    expect(getDeadlineStatus('2026-12-15', today)).toEqual({ label: '124 days left', overdue: false });
  });

  it('returns singular "day left" for exactly one day away', () => {
    expect(getDeadlineStatus('2026-08-14', today)).toEqual({ label: '1 day left', overdue: false });
  });

  it('returns "Due today" when the end date is today', () => {
    expect(getDeadlineStatus('2026-08-13', today)).toEqual({ label: 'Due today', overdue: false });
  });

  it('returns overdue with days count for a past date', () => {
    expect(getDeadlineStatus('2026-08-01', today)).toEqual({ label: '12 days overdue', overdue: true });
  });

  it('returns singular "day overdue" for exactly one day past', () => {
    expect(getDeadlineStatus('2026-08-12', today)).toEqual({ label: '1 day overdue', overdue: true });
  });

  it('returns null for a missing end date', () => {
    expect(getDeadlineStatus(null, today)).toBeNull();
    expect(getDeadlineStatus(undefined, today)).toBeNull();
  });

  it('returns null for an unparsable end date', () => {
    expect(getDeadlineStatus('not-a-date', today)).toBeNull();
  });
});
