import { formatAmount, formatHours } from './leave-amount';

describe('leave amount formatting', () => {
  it('formats an amount with its period', () => {
    expect(formatAmount(8, 'month')).toBe('8 h / month');
    expect(formatAmount(112, 'year')).toBe('112 h / year');
    expect(formatAmount(8.17, 'month')).toBe('8.17 h / month');
  });

  it('formats hours including negative balances', () => {
    expect(formatHours(8)).toBe('8 h');
    expect(formatHours(-4.5)).toBe('-4.5 h');
    expect(formatHours(0)).toBe('0 h');
  });
});
