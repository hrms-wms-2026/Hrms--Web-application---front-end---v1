import { describe, expect, it } from 'vitest';
import {
  FORECAST_COLORS,
  FORECAST_STATUS_META,
  forecastHeroCaption,
  forecastRankChip,
  overloadLimitText,
  rateVsRequiredShort,
  rateVsRequiredText,
  forecastHeroSub,
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
  it('splits the remaining hours into covered, higher rate and beyond the rate limit', () => {
    const s = forecastSlices({ remainingHours: 1500, predictedHours: 1100, capacityHours: 2600 });
    expect(s.map((x) => [x.key, x.value])).toEqual([
      ['covered', 1100],
      ['raise', 400],
      ['overload', 0],
    ]);
    expect(s[0].percentText).toBe('73%');
    // At the default 90% limit the team reaches at most 54 of the 60 capacity hours.
    const short = forecastSlices({ remainingHours: 100, predictedHours: 30, capacityHours: 60 });
    expect(short.map((x) => x.value)).toEqual([30, 24, 46]);
    expect(short[2].label).toBe('Beyond the 90% limit');
    const full = forecastSlices({ remainingHours: 100, predictedHours: 30, capacityHours: 60 }, 1);
    expect(full.map((x) => x.value)).toEqual([30, 30, 40]);
    expect(full[2].label).toBe('Beyond the 100% limit');
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
    expect(forecastHeroText(950)).toBe('~950 h');
    expect(forecastHeroSub(950)).toBe("won't fit at today's rate");
    expect(forecastHeroSub(0)).toBe("Everything fits at today's rate");
    expect(forecastHeroText(0)).toBe('On track');
    expect(forecastHeroCaption(0.42, 0.58)).toBe('Needs 58% task rate · now 42%');
    expect(forecastHeroCaption(null, 0.5)).toBe('No task history in the last 4 weeks');
    expect(forecastHeroCaption(0.4, null)).toBe('No working days left · now 40%');
    expect(overtimeChipText(12.5, 'overload')).toBe('+13 h');
    expect(overtimeChipText(0, 'raise_rate')).toBe('Overtime risk');
    expect(rateVsRequiredText(0.26, 0.45)).toBe('26% → needs 45%');
    expect(rateVsRequiredShort(0.26, null)).toBe('26% → —');
    expect(overloadLimitText(0.9)).toBe('Above 90% task rate is treated as overload.');
    expect(forecastRankChip(0.26, 1.2, 'overload')).toEqual({
      text: '⚠ 26% → 120%',
      tone: 'var(--color-widget-maroon)',
    });
    expect(forecastRankChip(0.26, 0.45, 'raise_rate').text).toBe('26% → 45%');
    // Monochrome: both are maroon; Overload is told apart by its filled ⚠ badge, not by a second red.
    expect(FORECAST_STATUS_META.overload.color).toBe(FORECAST_COLORS.overtime);
    expect(FORECAST_COLORS.overtime).toBe('var(--color-widget-maroon)');
  });

  it('prints dates and the rate window', () => {
    expect(shortDate('2026-11-20')).toBe('20 Nov');
    expect(shortDate(null)).toBe('—');
    expect(windowLabel('2026-10-11', '2026-11-07')).toBe('11 Oct – 7 Nov');
  });
});
