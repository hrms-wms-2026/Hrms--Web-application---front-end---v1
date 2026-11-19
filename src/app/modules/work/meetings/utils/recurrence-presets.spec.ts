import { recurrencePresets } from './recurrence-presets';

describe('recurrencePresets', () => {
  // 2026-11-02 is a Monday; 2026-11-05 a Thursday.
  it('weekly preset produces FREQ=WEEKLY;BYDAY=<start day>', () => {
    expect(recurrencePresets.toRule('weekly', '2026-11-02')).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(recurrencePresets.toRule('weekly', '2026-11-05')).toBe('FREQ=WEEKLY;BYDAY=TH');
  });

  it('builds every preset from the start date', () => {
    expect(recurrencePresets.toRule('none', '2026-11-02')).toBeNull();
    expect(recurrencePresets.toRule('daily', '2026-11-02')).toBe('FREQ=DAILY');
    expect(recurrencePresets.toRule('biweekly', '2026-11-02')).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
    expect(recurrencePresets.toRule('monthly', '2026-11-05')).toBe('FREQ=MONTHLY;BYMONTHDAY=5');
  });

  it('reads a rule back into its preset, and anything else as custom', () => {
    expect(recurrencePresets.fromRule(null)).toBe('none');
    expect(recurrencePresets.fromRule('FREQ=DAILY')).toBe('daily');
    expect(recurrencePresets.fromRule('FREQ=WEEKLY;BYDAY=WE')).toBe('weekly');
    expect(recurrencePresets.fromRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=FR')).toBe('biweekly');
    expect(recurrencePresets.fromRule('FREQ=MONTHLY;BYMONTHDAY=12')).toBe('monthly');
    expect(recurrencePresets.fromRule('FREQ=WEEKLY;BYDAY=MO,WE')).toBe('custom');
    expect(recurrencePresets.fromRule('FREQ=YEARLY')).toBe('custom');
  });
});
