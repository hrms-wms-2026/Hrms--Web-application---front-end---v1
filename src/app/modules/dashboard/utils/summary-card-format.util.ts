import { SummaryDelta } from '../models/summary-card.model';

export type SummaryDeltaUnit = 'pp' | '%' | 'h' | '';

/**
 * A summary card's change line: "+2.0 pp" (one decimal for percentage points, whole numbers otherwise),
 * "±0" for no change, with whether the change is good news. Null without a value.
 */
export function summaryDelta(value: number | null | undefined, unit: SummaryDeltaUnit, higherIsBetter: boolean, suffix: string): SummaryDelta | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const digits = unit === 'pp' ? 1 : 0;
  const rounded = Number(value.toFixed(digits));
  const shown = rounded === 0 ? 0 : digits;
  const magnitude = Math.abs(rounded).toLocaleString('en-US', { minimumFractionDigits: shown, maximumFractionDigits: shown });
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '±';
  const tail = unit === '' ? '' : unit === '%' ? '%' : ` ${unit}`;
  const good = rounded === 0 || rounded > 0 === higherIsBetter;
  return { text: `${sign}${magnitude}${tail}`, good, suffix };
}

/** The first number in a figure ("2,390 h" → 2390), for the count-up animation. Null when there is none. */
export function firstNumber(text: string): { match: string; value: number } | null {
  const found = /\d[\d,]*(?:\.\d+)?/.exec(text);
  if (!found) return null;
  return { match: found[0], value: Number(found[0].replace(/,/g, '')) };
}
