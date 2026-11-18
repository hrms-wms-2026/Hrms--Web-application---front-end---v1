import { dateOnly, toHttpParams } from './api-params';

describe('toHttpParams', () => {
  it('returns empty params for an empty object', () => {
    expect(toHttpParams({}).keys()).toEqual([]);
  });

  it('skips null, undefined and empty strings', () => {
    const params = toHttpParams({ a: null, b: undefined, c: '', d: 'x' });
    expect(params.keys()).toEqual(['d']);
    expect(params.get('d')).toBe('x');
  });

  it('keeps false and 0', () => {
    const params = toHttpParams({ includeInactive: false, employmentStatusId: 0 });
    expect(params.get('includeInactive')).toBe('false');
    expect(params.get('employmentStatusId')).toBe('0');
  });

  it('keeps strings unchanged, including whitespace-only ones', () => {
    expect(toHttpParams({ fromDate: '2026-01-01', search: ' ' }).toString()).toBe('fromDate=2026-01-01&search=%20');
  });

  it('keeps the key order of the object literal', () => {
    expect(toHttpParams({ year: 2026, departmentId: 'd1', search: 'anu' }).toString()).toBe('year=2026&departmentId=d1&search=anu');
  });

  it('sends a Date as a full UTC ISO instant', () => {
    const at = new Date(Date.UTC(2026, 0, 15, 9, 30, 0));
    expect(toHttpParams({ at }).get('at')).toBe('2026-01-15T09:30:00.000Z');
  });

  it('repeats the key for arrays and skips empty items', () => {
    const params = toHttpParams({ ids: ['a', '', null, 'b'] });
    expect(params.getAll('ids')).toEqual(['a', 'b']);
    expect(params.toString()).toBe('ids=a&ids=b');
  });

  it('sends nothing for an empty array', () => {
    expect(toHttpParams({ ids: [] }).keys()).toEqual([]);
  });

  it('throws on an invalid Date', () => {
    expect(() => toHttpParams({ at: new Date('nope') })).toThrowError('toHttpParams: "at" is an invalid Date');
  });

  it('throws on NaN', () => {
    expect(() => toHttpParams({ page: Number.NaN })).toThrowError('toHttpParams: "page" is not a finite number');
  });

  it('throws on a nested object', () => {
    expect(() => toHttpParams({ filter: { a: 1 } })).toThrowError('toHttpParams: "filter" has unsupported type object');
  });

  it('accepts an interface-typed value', () => {
    interface Filter { search?: string; leaveTypeId?: string; }
    const filter: Filter = { search: 'anu' };
    expect(toHttpParams(filter).toString()).toBe('search=anu');
  });
});

describe('dateOnly', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(dateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('keeps the local day late in the evening (no UTC shift)', () => {
    expect(dateOnly(new Date(2026, 0, 15, 23, 30))).toBe('2026-01-15');
  });

  it('keeps the local day just after midnight (no UTC shift)', () => {
    expect(dateOnly(new Date(2026, 11, 31, 0, 15))).toBe('2026-12-31');
  });

  it('throws on an invalid Date', () => {
    expect(() => dateOnly(new Date('nope'))).toThrowError('dateOnly: invalid Date');
  });
});
