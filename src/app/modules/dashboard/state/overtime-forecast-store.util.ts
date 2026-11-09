import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

/** The popup tables' page size (the card asks for 10). */
export const FORECAST_TABLE_PAGE_SIZE = 25;
/** The backend clamps pageSize to 1..100, so the CSV export reads every page of this size. */
export const FORECAST_EXPORT_PAGE_SIZE = 100;

/**
 * Every row of a paged forecast read: page 1, then the other pages in parallel, with their items joined in order
 * (the response's other fields come from page 1).
 */
export function fetchAllForecastPages<
  Q extends { readonly page: number; readonly pageSize: number },
  R extends { readonly items: readonly unknown[]; readonly total: number },
>(get: (query: Q) => Observable<R>, query: Q): Observable<R> {
  const first: Q = { ...query, page: 1, pageSize: FORECAST_EXPORT_PAGE_SIZE };
  return get(first).pipe(
    switchMap((page1) => {
      const pages = Math.ceil(page1.total / FORECAST_EXPORT_PAGE_SIZE);
      if (pages <= 1) return of(page1);
      const rest = Array.from({ length: pages - 1 }, (_, i) => get({ ...first, page: i + 2 }));
      return forkJoin(rest).pipe(
        map(
          (more) => ({ ...page1, items: [...page1.items, ...more.flatMap((r) => r.items)] }) as R,
        ),
      );
    }),
  );
}

interface HttpErrorLike {
  error?: { detail?: string; message?: string } | null;
  message?: string;
}

export function forecastErrorText(err: unknown, fallback: string): string {
  const e = err as HttpErrorLike | null | undefined;
  return e?.error?.detail || e?.error?.message || e?.message || fallback;
}

/** The next table query: a patch that changes anything but the page starts again at page 1. */
export function nextTableQuery<Q extends { readonly page: number }>(
  current: Q,
  patch: Partial<Q>,
): Q {
  const next = { ...current, ...patch };
  const filterChanged = (Object.keys(patch) as (keyof Q)[]).some(
    (k) => k !== 'page' && patch[k] !== current[k],
  );
  return filterChanged && patch.page === undefined ? { ...next, page: 1 } : next;
}
