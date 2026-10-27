import { PROGRESS_STATUS_BY_KEY, PROGRESS_STATUSES, formatHourValue, formatPercent, percentOf } from './team-progress-format.util';

describe('team-progress-format.util', () => {
  describe('formatPercent', () => {
    it('never shows a non-zero share as 0%', () => {
      expect(formatPercent(100, 20200)).toBe('0.5%');
      expect(formatPercent(1, 20200)).toBe('<0.1%');
    });

    it('uses one decimal under 10% and over 90%, whole numbers between', () => {
      expect(formatPercent(171, 20200)).toBe('0.8%');
      expect(formatPercent(1, 8)).toBe('13%');
      expect(formatPercent(1, 3)).toBe('33%');
      expect(formatPercent(19715, 20200)).toBe('97.6%');
      expect(formatPercent(91, 100)).toBe('91%');
    });

    it('never shows a partial share as 100%', () => {
      expect(formatPercent(19999, 20000)).toBe('>99.9%');
      expect(formatPercent(9990, 10000)).toBe('99.9%');
    });

    it('handles zero, missing and full values', () => {
      expect(formatPercent(0, 100)).toBe('0%');
      expect(formatPercent(10, 0)).toBe('0%');
      expect(formatPercent(Number.NaN, 100)).toBe('0%');
      expect(formatPercent(50, 50)).toBe('100%');
    });
  });

  it('percentOf returns 0 for non-positive inputs', () => {
    expect(percentOf(5, 0)).toBe(0);
    expect(percentOf(-1, 10)).toBe(0);
    expect(percentOf(5, 10)).toBe(50);
  });

  it('formatHourValue groups thousands and keeps one decimal', () => {
    expect(formatHourValue(19715)).toBe('19,715');
    expect(formatHourValue(12.54)).toBe('12.5');
    expect(formatHourValue(0)).toBe('0');
    expect(formatHourValue(null)).toBe('0');
  });

  it('keeps one consistent colour per status', () => {
    expect(PROGRESS_STATUSES.map((s) => s.key)).toEqual(['completed', 'inProgress', 'notStarted', 'untasked']);
    expect(PROGRESS_STATUS_BY_KEY.untasked.label).toBe('Not yet tasked');
  });
});
