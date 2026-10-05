import { deriveMilestoneStatus } from './milestone-status.utils';

describe('deriveMilestoneStatus', () => {
  const event = { status: 'active', startDate: '2026-10-01', endDate: '2026-10-31' };

  it('returns completed for an archived event regardless of dates', () => {
    expect(deriveMilestoneStatus({ ...event, status: 'archived' }, '2026-09-01', false)).toBe('completed');
  });
  it('returns upcoming when today is before the start date', () => {
    expect(deriveMilestoneStatus(event, '2026-09-15', false)).toBe('upcoming');
  });
  it('returns at_risk when overdue', () => {
    expect(deriveMilestoneStatus(event, '2026-11-01', false)).toBe('at_risk');
  });
  it('returns at_risk when there is an open monitor alert, even if not overdue', () => {
    expect(deriveMilestoneStatus(event, '2026-10-15', true)).toBe('at_risk');
  });
  it('returns on_track otherwise', () => {
    expect(deriveMilestoneStatus(event, '2026-10-15', false)).toBe('on_track');
  });
});
