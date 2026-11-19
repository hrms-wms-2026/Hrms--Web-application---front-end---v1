import { describe, expect, it } from 'vitest';
import { firstNumber, summaryDelta } from './summary-card-format.util';

describe('summaryDelta', () => {
  it('formats a rise in percentage points as good when higher is better', () => {
    expect(summaryDelta(2, 'pp', true, 'vs last week')).toEqual({ text: '+2.0 pp', good: true, suffix: 'vs last week' });
  });

  it('treats a fall as good when lower is better', () => {
    expect(summaryDelta(-3, 'h', false, '')).toEqual({ text: '−3 h', good: true, suffix: '' });
  });

  it('shows no change as ±0 and good', () => {
    expect(summaryDelta(0, 'pp', true, '')).toEqual({ text: '±0 pp', good: true, suffix: '' });
  });

  it('rounds hours and percent to whole numbers and keeps the unit tight for %', () => {
    expect(summaryDelta(18.4, '%', true, 'vs last week')?.text).toBe('+18%');
    expect(summaryDelta(9, '', true, '')?.text).toBe('+9');
  });

  it('marks a rise as bad when lower is better', () => {
    expect(summaryDelta(4, 'h', false, '')?.good).toBe(false);
  });

  it('returns null without a value', () => {
    expect(summaryDelta(null, 'pp', true, '')).toBeNull();
    expect(summaryDelta(Number.NaN, 'pp', true, '')).toBeNull();
  });
});

describe('firstNumber', () => {
  it('finds the first number with separators and decimals', () => {
    expect(firstNumber('2,390 h')).toEqual({ match: '2,390', value: 2390 });
    expect(firstNumber('4.6 / 5')).toEqual({ match: '4.6', value: 4.6 });
    expect(firstNumber('—')).toBeNull();
  });
});
