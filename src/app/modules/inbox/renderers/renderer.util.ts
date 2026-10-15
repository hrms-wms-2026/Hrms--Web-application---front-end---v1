/** A property of a renderer payload, read camelCase or PascalCase (some snapshots are stored with default .NET casing). */
export function pick<T = unknown>(source: unknown, key: string): T | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const value = record[key] ?? record[key.charAt(0).toUpperCase() + key.slice(1)];
  return value === undefined || value === null ? null : value as T;
}

/** Shared look of the inbox detail renderers (matches the card's sections). */
export const RENDERER_STYLES = `
  .rnd { display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
  .rnd__label { margin-top: 4px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .rnd__box { display: flex; flex-direction: column; padding: 2px 12px; border: 1px solid var(--color-border); border-radius: 12px; }
  .rnd__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent); }
  .rnd__row:last-child { border-bottom: 0; }
  .rnd__key { color: var(--color-text-secondary); font-weight: 500; }
  .rnd__value { font-weight: 600; text-align: right; }
  .rnd__list { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 8px 12px 8px 26px; border: 1px solid var(--color-border); border-radius: 12px; }
  .rnd__list--warn { border-color: color-mix(in srgb, var(--color-warning, #d97706) 45%, var(--color-border)); background: color-mix(in srgb, var(--color-warning, #d97706) 6%, transparent); }
  .rnd__note { margin: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; color: var(--color-text-secondary); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
  .rnd__muted { color: var(--color-text-secondary); }
  .rnd__badge { display: inline-block; padding: 1px 8px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
`;
