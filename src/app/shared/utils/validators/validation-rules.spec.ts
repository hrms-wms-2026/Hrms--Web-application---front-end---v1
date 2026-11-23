import { dateRange, email, maxLength, pattern, phone, positiveNumber, requiredText, richTextLength } from './validation-rules';

describe('validation rules', () => {
  it('requiredText fails on null, empty and whitespace, like the backend ValidName', () => {
    expect(requiredText(null)).toEqual({ required: true });
    expect(requiredText('')).toEqual({ required: true });
    expect(requiredText('   ')).toEqual({ required: true });
    expect(requiredText(' a ')).toBeNull();
  });

  it('maxLength counts characters and passes empty values', () => {
    expect(maxLength('abc', 3)).toBeNull();
    expect(maxLength('abcd', 3)).toEqual({ maxlength: { requiredLength: 3, actualLength: 4 } });
    expect(maxLength(null, 3)).toBeNull();
  });

  it('email and phone pass empty values and check the format otherwise', () => {
    expect(email('')).toBeNull();
    expect(email('a@b.co')).toBeNull();
    expect(email('a@b')).toEqual({ email: true });
    expect(phone(null)).toBeNull();
    expect(phone('+94 77 123 4567')).toBeNull();
    expect(phone('12ab')).toEqual({ phone: true });
  });

  it('pattern checks the trimmed value under a named key', () => {
    const code = /^[A-Za-z0-9_-]{1,20}$/;
    expect(pattern(' HR-1 ', code, 'code')).toBeNull();
    expect(pattern('R&D', code, 'code')).toEqual({ code: true });
    expect(pattern('', code, 'code')).toBeNull();
  });

  it('positiveNumber needs a number above zero and passes empty values', () => {
    expect(positiveNumber(null)).toBeNull();
    expect(positiveNumber(0.5)).toBeNull();
    expect(positiveNumber(0)).toEqual({ positive: true });
    expect(positiveNumber(-1)).toEqual({ positive: true });
  });

  it('richTextLength counts the stored HTML, not the visible text', () => {
    expect(richTextLength('<b>hi</b>', 9)).toBeNull();
    expect(richTextLength('<b>hi</b>', 8)).toEqual({ richTextLength: { requiredLength: 8, actualLength: 9 } });
  });

  it('dateRange checks order, then the maximum span, and skips when an end is missing', () => {
    expect(dateRange('2026-01-02', '2026-01-01')).toEqual({ dateOrder: true });
    expect(dateRange('2026-01-01', '2026-01-01')).toBeNull();
    expect(dateRange('2026-01-01', '2026-01-31', 30)).toBeNull();
    expect(dateRange('2026-01-01', '2026-02-01', 30)).toEqual({ dateSpan: { maxDays: 30 } });
    expect(dateRange('', '2026-01-01')).toBeNull();
  });

  it('dateRange ignores a malformed date instead of passing it as in range', () => {
    expect(dateRange('2026-01-01', 'not-a-date', 30)).toBeNull();
    expect(dateRange('2026-13-45', '2026-12-31', 30)).toBeNull();
  });

  it('text rules treat a non-string value as empty instead of throwing', () => {
    expect(requiredText(42 as unknown as string)).toEqual({ required: true });
    expect(maxLength(12345 as unknown as string, 3)).toBeNull();
  });
});
