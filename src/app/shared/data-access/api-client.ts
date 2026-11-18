import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { toHttpParams } from './api-params';

export interface ApiRequestOptions {
  /** Plain object; goes through toHttpParams (skips empty values, keeps false/0, key order kept). */
  readonly params?: object;
}

/**
 * Thin HttpClient wrapper for the ONEVO API. Always targets environment.apiUrl and always builds the
 * query string with toHttpParams. Module API services use this instead of HttpClient/HttpParams and
 * return backend DTOs unchanged; mapping to view models lives in the store or a mapper file.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  /** `path` must start with '/', e.g. '/leave/types'. */
  url(path: string): string {
    if (!path.startsWith('/')) throw new Error(`ApiClient: path must start with '/': ${path}`);
    return `${environment.apiUrl}${path}`;
  }

  get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }

  getPage<T>(path: string, options: ApiRequestOptions = {}): Observable<PagedResult<T>> {
    return this.http.get<PagedResult<T>>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }

  getBlob(path: string, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), { params: toHttpParams(options.params ?? {}), responseType: 'blob' });
  }

  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, { params: toHttpParams(options.params ?? {}) });
  }

  postBlob(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.post(this.url(path), body, { params: toHttpParams(options.params ?? {}), responseType: 'blob' });
  }

  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.put<T>(this.url(path), body, { params: toHttpParams(options.params ?? {}) });
  }

  delete<T = void>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }
}
