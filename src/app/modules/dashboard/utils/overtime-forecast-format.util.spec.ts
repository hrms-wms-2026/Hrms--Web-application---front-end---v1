import { describe, expect, it } from 'vitest';
import {
  forecastHeroCaption,
  forecastHeroText,
  forecastHoursText,
  forecastSlices,
  overtimeChipText,
  rateBarPercent,
  rateText,
  shortDate,
  windowLabel,
} from './overtime-forecast-format.util';

describe('overtime-forecast-format', () => {
  it('splits the remaining hours into covered, higher rate and overtime', () => {
    const s = forecastSlices({ remainingHours: 1500, predictedHours: 1100, capacityHours: 2600 });
    expect(s.map((x) => [x.key, x.value])).toEqual([
      ['covered', 1100],
      ['raise', 400],
      ['overtime', 0],
    ]);
    expect(s[0].percentText).toBe('73%');
    const short = forecastSlices({ remainingHours: 100, predictedHours: 30, capacityHours: 60 });
    expect(short.map((x) => x.value)).toEqual([30, 30, 40]);
  });

  it('nothing remaining draws an empty donut, never negative slices', () => {
    const s = forecastSlices({ remainingHours: 0, predictedHours: 50, capacityHours: 80 });
    expect(s.map((x) => x.value)).toEqual([0, 0, 0]);
    expect(s[0].percentText).toBe('0%');
  });

  it('prints rates, with dashes for no history and over 100% for a rate that cannot fit', () => {
    expect(rateText(null)).toBe('—');
    expect(rateText(0.42)).toBe('42%');
    expect(rateText(1.4)).toBe('140%');
    expect(rateText(0)).toBe('0%');
    expect(rateText(0.004)).toBe('0.4%');
    expect(rateBarPercent(1.4)).toBe(100);
    expect(rateBarPercent(null)).toBe(0);
  });

  it('prints hours, the hero and its caption', () => {
    expect(forecastHoursText(950.4)).toBe('950 h');
    expect(forecastHoursText(2.46)).toBe('2.5 h');
    expect(forecastHoursText(1234)).toBe('1,234 h');
    expect(forecastHeroText(950)).toBe('~950 h overtime');
    expect(forecastHeroText(0)).toBe('On track');
    expect(forecastHeroCaption(0.42, 0.58)).toBe('Needs 58% task rate · now 42%');
    expect(forecastHeroCaption(null, 0.5)).toBe('No task history in the last 4 weeks');
    expect(forecastHeroCaption(0.4, null)).toBe('No working days left · now 40%');
    expect(overtimeChipText(12.5, 'overtime')).toBe('~13 h');
    expect(overtimeChipText(0, 'raise_rate')).toBe('Raise rate');
  });

  it('prints dates and the rate window', () => {
    expect(shortDate('2026-11-20')).toBe('20 Nov');
    expect(shortDate(null)).toBe('—');
    expect(windowLabel('2026-10-11', '2026-11-07')).toBe('11 Oct – 7 Nov');
  });
});
