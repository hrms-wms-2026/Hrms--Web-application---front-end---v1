import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandlerService, isMachineValue, toSafeErrorMessage } from './error-handler.service';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

describe('ErrorHandlerService & Safe Error Mapper', () => {
  function makeError(status: number, body?: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status, url: '/api/v1/employees', error: body });
  }

  it('shows a banner for a 500 with safe status message', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(500));

    expect(notify.notifications()[0].message).toBe('Something went wrong while saving your changes.');
  });

  it('maps storage_not_entitled to plan feature error', () => {
    const err = makeError(403, { detail: 'storage_not_entitled' });
    expect(toSafeErrorMessage(err)).toBe('This feature is not included in your current plan.');
  });

  it('maps not_entitled to plan feature error', () => {
    const err = makeError(403, { detail: 'not_entitled' });
    expect(toSafeErrorMessage(err)).toBe('This feature is not included in your current plan.');
  });

  it('sanitizes snake_case error codes and returns status fallback', () => {
    const err = makeError(400, { detail: 'invalid_company_code_format' });
    expect(toSafeErrorMessage(err)).toBe('Please check the highlighted fields.');
  });

  it('sanitizes camelCase error codes and returns status fallback', () => {
    const err = makeError(409, { detail: 'companyCodeConflict' });
    expect(toSafeErrorMessage(err)).toBe('This change conflicts with existing data. Please review and try again.');
  });

  it('sanitizes GUIDs and raw JSON', () => {
    const errGuid = makeError(500, { detail: 'Failed for id 123e4567-e89b-12d3-a456-426614174000' });
    expect(toSafeErrorMessage(errGuid)).toBe('Something went wrong while saving your changes.');

    const errJson = makeError(400, '{"code": 400, "message": "bad"}');
    expect(toSafeErrorMessage(errJson)).toBe('Please check the highlighted fields.');
  });

  it('sanitizes stack traces, exception names, and database table names', () => {
    const errStack = makeError(500, { detail: 'System.NullReferenceException: Object reference at CompanyController.cs:line 45' });
    expect(toSafeErrorMessage(errStack)).toBe('Something went wrong while saving your changes.');

    const errDb = makeError(500, { detail: 'Violation of UNIQUE KEY constraint in dbo.LegalEntities' });
    expect(toSafeErrorMessage(errDb)).toBe('Something went wrong while saving your changes.');
  });

  it('sanitizes permission implementation details', () => {
    const errPerm = makeError(403, { detail: 'Required permission legal_entity:update missing' });
    expect(toSafeErrorMessage(errPerm)).toBe('You do not have access to perform this action.');
  });

  it('maps CSRF, XSRF, anti-forgery, and security token/header/cookie details to safe session security message', () => {
    const safeSecurityMessage = 'Your session security check failed. Refresh the page and try again.';

    expect(toSafeErrorMessage(makeError(400, { detail: 'A valid CSRF token is required for this request.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(403, { detail: 'XSRF token validation failed.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(400, { detail: 'Anti-forgery token is missing.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(400, { detail: 'Antiforgery cookie missing.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(400, { detail: 'Invalid token header provided.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(401, { detail: 'Missing security token in request.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(401, { detail: 'Expired token.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(400, { detail: 'Header X-CSRF-Token is invalid.' }))).toBe(safeSecurityMessage);
    expect(toSafeErrorMessage(makeError(400, { detail: 'Header X-XSRF-TOKEN is missing.' }))).toBe(safeSecurityMessage);
  });

  it('preserves known safe business messages and does not over-sanitize', () => {
    const errSafe = makeError(400, { detail: 'Company name is already in use.' });
    expect(toSafeErrorMessage(errSafe)).toBe('Company name is already in use.');

    const errInvitation = makeError(400, { detail: 'This invitation link is invalid or has expired.' });
    expect(toSafeErrorMessage(errInvitation)).toBe('This invitation link is invalid or has expired.');
    expect(toSafeErrorMessage('This invitation link is invalid or has expired.')).toBe('This invitation link is invalid or has expired.');

    const errEmail = makeError(400, { detail: 'This work email is already in use.' });
    expect(toSafeErrorMessage(errEmail)).toBe('This work email is already in use.');
  });

  it('uses status fallbacks for 400, 401, 403, 404, 409, 422, 429, 500, 503, 0', () => {
    expect(toSafeErrorMessage(makeError(400))).toBe('Please check the highlighted fields.');
    expect(toSafeErrorMessage(makeError(401))).toBe('Your session has expired. Please sign in again.');
    expect(toSafeErrorMessage(makeError(403))).toBe('You do not have access to perform this action.');
    expect(toSafeErrorMessage(makeError(404))).toBe('The requested record could not be found.');
    expect(toSafeErrorMessage(makeError(409))).toBe('This change conflicts with existing data. Please review and try again.');
    expect(toSafeErrorMessage(makeError(422))).toBe('Please check the highlighted fields.');
    expect(toSafeErrorMessage(makeError(429))).toBe('Too many requests. Please wait a moment.');
    expect(toSafeErrorMessage(makeError(500))).toBe('Something went wrong while saving your changes.');
    expect(toSafeErrorMessage(makeError(503))).toBe('The service is temporarily unavailable. Please try again.');
    expect(toSafeErrorMessage(makeError(0))).toBe('We could not reach the server. Check your connection and try again.');
  });

  it('falls back to generic friendly message for unmapped unknown status', () => {
    expect(toSafeErrorMessage(makeError(418))).toBe('Something went wrong. Please try again.');
  });

  it('logs original technical details through LoggerService', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const logger = TestBed.inject(LoggerService);
    const spy = vi.spyOn(logger, 'error');

    service.handle(makeError(404, { detail: 'raw_db_not_found' }));

    expect(spy).toHaveBeenCalledWith('[HTTP 404]', {
      url: '/api/v1/employees',
      event: 'resource_not_found',
      detail: 'raw_db_not_found'
    });
  });
});
