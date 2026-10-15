/** A property of a renderer payload, read camelCase or PascalCase (some snapshots are stored with default .NET casing). */
export function pick<T = unknown>(source: unknown, key: string): T | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  const value = record[key] ?? record[key.charAt(0).toUpperCase() + key.slice(1)];
  return value === undefined || value === null ? null : value as T;
}
