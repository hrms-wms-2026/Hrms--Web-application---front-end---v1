import { attentionLabel, formatClock, hourLabel, shortMonth, visibleHours } from './employee-work-activity.utils';

describe('employee-work-activity utils', () => {
  it('attentionLabel', () => {
    expect(attentionLabel({ reason: 'overdue', overdueDays: 1, daysUntilDue: null })).toBe('1 day overdue');
    expect(attentionLabel({ reason: 'overdue', overdueDays: 3, daysUntilDue: null })).toBe('3 days overdue');
    expect(attentionLabel({ reason: 'due_soon', overdueDays: null, daysUntilDue: 0 })).toBe('Due today');
    expect(attentionLabel({ reason: 'due_soon', overdueDays: null, daysUntilDue: 2 })).toBe('Due in 2 days');
  });

  it('shortMonth', () => {
    expect(shortMonth('2026-09')).toBe('Sep');
    expect(shortMonth('2026-01')).toBe('Jan');
  });

  it('hourLabel', () => {
    expect(hourLabel(0)).toBe('12AM');
    expect(hourLabel(9)).toBe('9AM');
    expect(hourLabel(13)).toBe('1PM');
  });

  it('formatClock renders a time or a dash', () => {
    expect(formatClock(null)).toBe('—');
    expect(formatClock('2026-09-15T09:11:00Z', 'UTC')).toContain('9:11');
  });

  it('visibleHours keeps at least 9..17 and widens to any hour with activity', () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: hour === 7 || hour === 20 ? 5 : 0 }));
    const shown = visibleHours(hours);
    expect(shown[0].hour).toBe(7);
    expect(shown[shown.length - 1].hour).toBe(20);

    const quiet = visibleHours(Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: 0 })));
    expect(quiet.map((h) => h.hour)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });
});
