import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { toSafeErrorMessage } from '../services/error-handler.service';
import { rememberCorrelationId, toApiError } from './api-error';

function httpError(status: number, body?: unknown, headers?: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({ status, url: '/api/v1/x', error: body, headers: new HttpHeaders(headers ?? {}) });
}

describe('toApiError', () => {
  it.each([
    [400, 'validation'],
    [422, 'validation'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'conflict'],
    [429, 'rate-limited'],
    [500, 'server'],
    [503, 'server'],
    [0, 'network'],
    [418, 'other'],
  ] as const)('status %i is kind %s', (status, kind) => {
    expect(toApiError(httpError(status)).kind).toBe(kind);
  });

  it('uses the same safe message as toSafeErrorMessage, so existing screens keep their text', () => {
    const err = httpError(409, { title: 'Conflict', detail: 'Code already used.' });
    expect(toApiError(err).message).toBe(toSafeErrorMessage(err));
    expect(toApiError(httpError(500), 'Failed to save.').message).toBe('Failed to save.');
  });

  it('reads the stable code when the backend sends one', () => {
    expect(toApiError(httpError(428, { code: 'active_tray_required' })).code).toBe('active_tray_required');
    expect(toApiError(httpError(400, { detail: 'x' })).code).toBeNull();
  });

  it('keeps human field errors and drops technical ones', () => {
    const err = httpError(400, {
      errors: { Name: ['Company name must be 200 characters or fewer.'], CompanyCode: ['System.FormatException at Foo()'], Email: 'Email address is invalid.' },
    });
    expect(toApiError(err).fieldErrors).toEqual({
      Name: ['Company name must be 200 characters or fewer.'],
      Email: ['Email address is invalid.'],
    });
  });

  it('finds the correlation id in the body, then the request, then the response header', () => {
    expect(toApiError(httpError(500, { correlationId: 'body-id' })).correlationId).toBe('body-id');

    const remembered = httpError(500, { detail: 'x' }, { 'X-Correlation-Id': 'response-id' });
    rememberCorrelationId(remembered, 'request-id');
    expect(toApiError(remembered).correlationId).toBe('request-id');

    expect(toApiError(httpError(500, null, { 'X-Correlation-Id': 'response-id' })).correlationId).toBe('response-id');
    expect(toApiError(httpError(500)).correlationId).toBeNull();
  });

  it('reads Retry-After in seconds when the browser can see it', () => {
    expect(toApiError(httpError(429, null, { 'Retry-After': '30' })).retryAfterSeconds).toBe(30);
    expect(toApiError(httpError(429, null, { 'Retry-After': 'soon' })).retryAfterSeconds).toBeNull();
    expect(toApiError(httpError(429)).retryAfterSeconds).toBeNull();
  });

  it('turns a non-HTTP error into kind other with a safe message', () => {
    const apiError = toApiError(new Error('boom'), 'Could not load.');
    expect(apiError.kind).toBe('other');
    expect(apiError.status).toBeNull();
    expect(apiError.message).toBe(toSafeErrorMessage(new Error('boom'), 'Could not load.'));
  });
});
