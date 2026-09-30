import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { ExceptionAlertsApiService } from './exception-alerts-api.service';

describe('ExceptionAlertsApiService', () => {
  let service: ExceptionAlertsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/monitoring/exceptions`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExceptionAlertsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists alerts with paging and only the filters that are set', () => {
    service.list({ status: 'Open', page: 2, pageSize: 10 }).subscribe();

    const request = httpMock.expectOne((r) => r.url === base);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('Open');
    expect(request.request.params.get('type')).toBeNull();
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush({ items: [], pageNumber: 2, pageSize: 10, totalCount: 0 });
  });

  it('posts acknowledge, resolve and escalate to their own endpoints with the note', () => {
    service.acknowledge('a1').subscribe();
    service.resolve('a1', 'All good').subscribe();
    service.escalate('a1', null).subscribe();

    const ack = httpMock.expectOne(`${base}/a1/acknowledge`);
    expect(ack.request.method).toBe('POST');
    ack.flush(null);

    const resolve = httpMock.expectOne(`${base}/a1/resolve`);
    expect(resolve.request.body).toEqual({ note: 'All good' });
    resolve.flush(null);

    const escalate = httpMock.expectOne(`${base}/a1/escalate`);
    expect(escalate.request.body).toEqual({ note: null });
    escalate.flush(null);
  });
});
