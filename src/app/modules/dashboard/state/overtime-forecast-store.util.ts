/** The popup tables' page size (the card asks for 10). */
export const FORECAST_TABLE_PAGE_SIZE = 25;
/** The CSV export asks for every row of the current filter in one page. */
export const FORECAST_EXPORT_PAGE_SIZE = 500;

interface HttpErrorLike {
  error?: { detail?: string; message?: string } | null;
  message?: string;
}

export function forecastErrorText(err: unknown, fallback: string): string {
  const e = err as HttpErrorLike | null | undefined;
  return e?.error?.detail || e?.error?.message || e?.message || fallback;
}

/** The next table query: a patch that changes anything but the page starts again at page 1. */
export function nextTableQuery<Q extends { readonly page: number }>(current: Q, patch: Partial<Q>): Q {
  const next = { ...current, ...patch };
  const filterChanged = (Object.keys(patch) as (keyof Q)[]).some((k) => k !== 'page' && patch[k] !== current[k]);
  return filterChanged && patch.page === undefined ? { ...next, page: 1 } : next;
}
