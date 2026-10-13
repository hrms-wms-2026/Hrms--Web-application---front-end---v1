import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  InboxActionBody,
  InboxActionResultDto,
  InboxCountsDto,
  InboxFilterFieldDto,
  InboxItemDetailDto,
  InboxItemRef,
  InboxPageDto,
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

  counts(): Observable<InboxCountsDto> {
    return this.http.get<InboxCountsDto>(`${this.base}/counts`);
  }

  detail(ref: InboxItemRef): Observable<InboxItemDetailDto> {
    return this.http.get<InboxItemDetailDto>(`${this.base}/${itemPath(ref)}`);
  }

  runAction(ref: InboxItemRef, action: string, body: InboxActionBody = {}): Observable<InboxActionResultDto> {
    return this.http.post<InboxActionResultDto>(`${this.base}/${itemPath(ref)}/actions/${encodeURIComponent(action)}`, body);
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
  return params;
}
