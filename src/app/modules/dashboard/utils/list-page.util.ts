/** One page of a client-side list. `page` is clamped into 1..totalPages, so a shrinking list never shows an empty page. */
export interface ListPage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly totalPages: number;
  /** Index of the first item on the page, for running row numbers. */
  readonly offset: number;
}

export function listPage<T>(items: readonly T[], page: number, size: number): ListPage<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const offset = (current - 1) * size;
  return { items: items.slice(offset, offset + size), page: current, totalPages, offset };
}
