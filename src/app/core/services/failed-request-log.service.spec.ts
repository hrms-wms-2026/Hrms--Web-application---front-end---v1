import { TestBed } from '@angular/core/testing';
import {
  FAILED_REQUEST_LOG_SIZE,
  FailedRequestLogService,
  requestPath,
} from './failed-request-log.service';

describe('FailedRequestLogService', () => {
  let service: FailedRequestLogService;
  const at = new Date('2026-01-15T10:00:00Z');

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FailedRequestLogService);
  });

  it('starts empty', () => {
    expect(service.recent()).toEqual([]);
  });

  it('keeps only the last 5, newest first', () => {
    for (let i = 1; i <= 7; i++) {
      service.record({
        correlationId: `id-${i}`,
        method: 'post',
        url: `/api/v1/leave/${i}`,
        status: 500,
        at,
      });
    }

    expect(service.recent()).toHaveLength(FAILED_REQUEST_LOG_SIZE);
    expect(service.recent().map((e) => e.correlationId)).toEqual([
      'id-7',
      'id-6',
      'id-5',
      'id-4',
      'id-3',
    ]);
  });

  it('stores method, path, status and time but no query string', () => {
    service.record({
      correlationId: 'abc-123',
      method: 'get',
      url: 'https://localhost:7229/api/v1/employees?search=jane&page=2#top',
      status: 403,
      at,
    });

    expect(service.recent()[0]).toEqual({
      correlationId: 'abc-123',
      method: 'GET',
      path: '/api/v1/employees',
      status: 403,
      at: '2026-01-15T10:00:00.000Z',
    });
  });

  it('moves a repeated reference to the top instead of listing it twice', () => {
    service.record({ correlationId: 'a', method: 'GET', url: '/x', status: 500, at });
    service.record({ correlationId: 'b', method: 'GET', url: '/y', status: 500, at });
    service.record({ correlationId: 'a', method: 'GET', url: '/x', status: 500, at });

    expect(service.recent().map((e) => e.correlationId)).toEqual(['a', 'b']);
  });
});

describe('requestPath', () => {
  it.each([
    ['/api/v1/leave?x=1', '/api/v1/leave'],
    ['https://api.example.com/api/v1/leave?x=1', '/api/v1/leave'],
    ['https://api.example.com', '/'],
    ['api/v1/leave#frag', 'api/v1/leave'],
  ])('%s -> %s', (url, path) => {
    expect(requestPath(url)).toBe(path);
  });
});
