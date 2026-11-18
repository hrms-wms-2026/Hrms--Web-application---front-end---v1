import { HttpParams } from '@angular/common/http';

/**
 * The one place that turns a plain object into query-string params for the ONEVO API.
 *
 * - skips null, undefined and '' (an empty filter must not reach the backend as a value)
 * - keeps false and 0
 * - strings pass through unchanged; use dateOnly() for date-only values
 * - a Date becomes a full UTC ISO instant
 * - arrays repeat the key (ids=a&ids=b), skipping empty items
 * - keys keep the order of the object literal
 *
 * Takes `object` rather than a Record so interface-typed filters can be passed in.
 */
export function toHttpParams<T extends object>(values: T): HttpParams {
  let params = new HttpParams();
  for (const [key, raw] of Object.entries(values) as [string, unknown][]) {
    const items: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      const value = formatParam(key, item);
      if (value !== null) params = params.append(key, value);
    }
  }
  return params;
}

/** A date-only value (yyyy-MM-dd) for the local calendar day. Never shifts the day through UTC. */
export function dateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error('dateOnly: invalid Date');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatParam(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`toHttpParams: "${key}" is not a finite number`);
    return String(value);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`toHttpParams: "${key}" is an invalid Date`);
    return value.toISOString();
  }
  throw new Error(`toHttpParams: "${key}" has unsupported type ${typeof value}`);
}
