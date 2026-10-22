import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { SILENT_HTTP_ERRORS } from '../../../core/interceptors/error.interceptor';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  InboxActionBody,
  InboxActionResultDto,
  InboxCountsDto,
  InboxHistoryPageDto,
  InboxHistoryQuery,
  InboxFilterFieldDto,
  InboxItemDetailDto,
  InboxItemRef,
  InboxKindDescriptorDto,
  InboxCategory,
  InboxPageDto,
  InboxPersonCaseDto,
  InboxPersonCaseMonthsDto,
  InboxQuery
} from '../models/inbox.dto';

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/inbox`;

  list(query: InboxQuery): Observable<InboxPageDto> {
    return this.http.get<InboxPageDto>(this.base, { params: toParams(query) });
  }

  filters(): Observable<InboxFilterFieldDto[]> {
    return this.http.get<InboxFilterFieldDto[]>(`${this.base}/filters`);
  }

  kinds(): Observable<InboxKindDescriptorDto[]> {
    return this.http.get<InboxKindDescriptorDto[]>(`${this.base}/kinds`);
  }

  counts(): Observable<InboxCountsDto> {
    return this.http.get<InboxCountsDto>(`${this.base}/counts`);
  }

  detail(ref: InboxItemRef): Observable<InboxItemDetailDto> {
    return this.http.get<InboxItemDetailDto>(`${this.base}/${itemPath(ref)}`);
  }

  runAction(ref: InboxItemRef, action: string, body: InboxActionBody = {}): Observable<InboxActionResultDto> {
    return this.http.post<InboxActionResultDto>(`${this.base}/${itemPath(ref)}/actions/${encodeURIComponent(action)}`, body);
  }

  /** The History tab: decisions the caller took, newest first. */
  history(query: InboxHistoryQuery): Observable<InboxHistoryPageDto> {
    let params = new HttpParams();
    for (const key of ['from', 'to', 'source', 'kind'] as const) {
      const value = query[key];
      if (value) params = params.set(key, value);
    }
    if (query.page) params = params.set('page', String(query.page));
    if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
    return this.http.get<InboxHistoryPageDto>(`${this.base}/history`, { params });
  }

  /** The investigation bundle (HTML) - deciders and HR only. */
  exportItem(ref: InboxItemRef): Observable<Blob> {
    return this.http.get(`${this.base}/${itemPath(ref)}/export`, { responseType: 'blob' });
  }

  /** A person's alerts or requests created in [from, to) (ISO), newest first - the ticket details' Past cases. */
  personCases(employeeId: string, category: InboxCategory, from: string, to: string): Observable<InboxPersonCaseDto[]> {
    const params = new HttpParams().set('category', category).set('from', from).set('to', to);
    // A person the caller can't see (403) just hides the section: no error banner.
    return this.http.get<InboxPersonCaseDto[]>(`${this.base}/people/${encodeURIComponent(employeeId)}/cases`, { params, context: silent() });
  }

  /** Months of `year` (grouped at the viewer's UTC offset) that hold the person's history, plus their hire date. */
  personCaseMonths(employeeId: string, category: InboxCategory, year: number, offsetMinutes: number): Observable<InboxPersonCaseMonthsDto> {
    const params = new HttpParams().set('category', category).set('year', String(year)).set('offsetMinutes', String(offsetMinutes));
    return this.http.get<InboxPersonCaseMonthsDto>(`${this.base}/people/${encodeURIComponent(employeeId)}/cases/months`, { params, context: silent() });
  }
}

function itemPath(ref: InboxItemRef): string {
  return [ref.source, ref.kind, ref.id].map(encodeURIComponent).join('/');
}

function toParams(query: InboxQuery): HttpParams {
  let params = new HttpParams();
  const multi: (keyof InboxQuery)[] = ['category', 'source', 'project', 'status', 'direction', 'type', 'requestedBy'];
  for (const key of multi) {
    for (const value of (query[key] as string[] | undefined) ?? []) params = params.append(key, value);
  }
  for (const [facet, values] of Object.entries(query.facets ?? {})) {
    for (const value of values) params = params.append('facet', `${facet}:${value}`);
  }
  if (query.from) params = params.set('from', query.from);
  if (query.to) params = params.set('to', query.to);
  const search = query.search?.trim();
  if (search) params = params.set('search', search);
  if (query.page) params = params.set('page', String(query.page));
  if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
  if (query.sort && query.sort !== 'latest') params = params.set('sort', query.sort);
  return params;
}

function silent(): HttpContext {
  return new HttpContext().set(SILENT_HTTP_ERRORS, true);
}
