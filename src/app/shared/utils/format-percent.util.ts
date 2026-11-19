/** Share of `part` in `whole` as a number (0-100), or 0 when either is not positive. */
export function percentOf(part: number, whole: number): number {
  if (!(whole > 0) || !(part > 0)) return 0;
  return (part / whole) * 100;
}

/**
 * A percentage that never hides a real value: a non-zero share never shows as "0%" and a partial
 * share never shows as "100%". Near either end, where whole numbers would hide the difference, one
 * decimal is kept: under 10% (0.5%) and over 90% (97.6%); under 0.1% shows "<0.1%".
 */
export function formatPercent(part: number, whole: number): string {
  const p = percentOf(part, whole);
  if (p === 0) return '0%';
  if (p < 0.1) return '<0.1%';
  if (part < whole && p > 99.9) return '>99.9%';
  if (p >= 100) return '100%';
  const rounded = p < 10 || p > 90 ? Math.round(p * 10) / 10 : Math.round(p);
  if (part < whole && rounded >= 100) return '>99.9%';
  return `${rounded}%`;
}
