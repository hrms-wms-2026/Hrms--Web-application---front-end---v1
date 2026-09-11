import { buildRecurrenceRule, describeRecurrence } from './recurrence-rule.util';

describe('buildRecurrenceRule', () => {
  it('returns null for "none"', () => {
    expect(buildRecurrenceRule('none', 'never', null)).toBeNull();
  });

  it('returns a bare FREQ for "never" end mode', () => {
    expect(buildRecurrenceRule('daily', 'never', null)).toBe('FREQ=DAILY');
    expect(buildRecurrenceRule('weekly', 'never', null)).toBe('FREQ=WEEKLY');
    expect(buildRecurrenceRule('monthly', 'never', null)).toBe('FREQ=MONTHLY');
  });

  it('appends UNTIL for "until" end mode with a date', () => {
    expect(buildRecurrenceRule('weekly', 'until', '2026-12-31')).toBe('FREQ=WEEKLY;UNTIL=20261231T235959Z');
  });

  it('falls back to bare FREQ if "until" mode has no date yet', () => {
    expect(buildRecurrenceRule('weekly', 'until', null)).toBe('FREQ=WEEKLY');
  });
});

describe('describeRecurrence', () => {
  it('describes "none" as "Does not repeat"', () => {
    expect(describeRecurrence('none', 'never', null)).toBe('Does not repeat');
  });

  it('describes a never-ending frequency', () => {
    expect(describeRecurrence('daily', 'never', null)).toBe('Daily');
  });

  it('describes an until-dated frequency', () => {
    expect(describeRecurrence('weekly', 'until', '2026-12-31')).toBe('Weekly, until 2026-12-31');
  });
});
