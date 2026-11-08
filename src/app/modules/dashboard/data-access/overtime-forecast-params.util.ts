import { HttpParams } from '@angular/common/http';

/** A forecast query as HTTP params: sort, page and pageSize always; status, projectId and search only when set. */
export function forecastParams(query: {
  readonly status: string | null;
  readonly projectId?: string | null;
  readonly search: string;
  readonly sort: string;
  readonly page: number;
  readonly pageSize: number;
}): HttpParams {
  let params = new HttpParams().set('sort', query.sort).set('page', query.page).set('pageSize', query.pageSize);
  if (query.status) params = params.set('status', query.status);
  if (query.projectId) params = params.set('projectId', query.projectId);
  const search = query.search.trim();
  if (search) params = params.set('search', search);
  return params;
}
