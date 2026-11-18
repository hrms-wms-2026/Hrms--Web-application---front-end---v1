import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('builds urls on environment.apiUrl with exactly one slash', () => {
    expect(api.url('/leave/types')).toBe(`${environment.apiUrl}/leave/types`);
    expect(api.url('/leave/types')).not.toContain('//leave');
  });

  it('rejects a path without a leading slash', () => {
    expect(() => api.url('leave/types')).toThrowError("ApiClient: path must start with '/': leave/types");
  });

  it('get sends params through toHttpParams', () => {
    let body: readonly string[] | undefined;
    api.get<readonly string[]>('/leave/types', { params: { includeInactive: false, search: '' } }).subscribe((r) => (body = r));
    const req = http.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`);
    expect(req.request.method).toBe('GET');
    req.flush(['a']);
    expect(body).toEqual(['a']);
  });

  it('get without params sends no query string', () => {
    api.get<unknown>('/leave/balances/work-window').subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/work-window`).flush({});
  });

  it('getPage returns the paged shape', () => {
    const page: PagedResult<string> = { items: ['a'], pageNumber: 2, pageSize: 25, totalCount: 26 };
    let result: PagedResult<string> | undefined;
    api.getPage<string>('/employees', { params: { pageNumber: 2, pageSize: 25 } }).subscribe((r) => (result = r));
    http.expectOne(`${environment.apiUrl}/employees?pageNumber=2&pageSize=25`).flush(page);
    expect(result).toEqual(page);
  });

  it('getBlob asks for a blob response', () => {
    api.getBlob('/leave/balance-audit/export', { params: { leaveTypeId: 'type-1' } }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/balance-audit/export?leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('post sends the body and optional params', () => {
    api.post<void>('/leave/types/t1/deactivate', {}, { params: { confirmed: false } }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/types/t1/deactivate?confirmed=false`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('post passes FormData through untouched', () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'x.pdf'));
    api.post<unknown>('/leave/requests/documents', form).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/requests/documents`);
    expect(req.request.body).toBe(form);
    req.flush({});
  });

  it('postBlob posts the body and asks for a blob response', () => {
    api.postBlob('/leave/entitlements/generate/preview/export', { year: 2026 }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview/export`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.body).toEqual({ year: 2026 });
    req.flush(new Blob(['x']));
  });

  it('put sends the body', () => {
    api.put<void>('/employees/e1/leave-policies/t1', { policyId: 'p1' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/employees/e1/leave-policies/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ policyId: 'p1' });
    req.flush(null);
  });

  it('delete sends a DELETE', () => {
    api.delete('/leave/holidays/h1').subscribe();
    expect(http.expectOne(`${environment.apiUrl}/leave/holidays/h1`).request.method).toBe('DELETE');
  });
});
