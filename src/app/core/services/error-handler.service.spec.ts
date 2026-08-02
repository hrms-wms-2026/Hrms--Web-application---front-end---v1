import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

describe('ErrorHandlerService', () => {
  function makeError(status: number): HttpErrorResponse {
    return new HttpErrorResponse({ status, url: '/api/v1/employees' });
  }

  it('shows a banner for a 500', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(500));

    expect(notify.notifications()[0].message).toBe('Something went wrong. Please try again.');
  });

  it('does not show a banner for a 401 (silent)', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(401));

    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not show a banner for a 404 (inline)', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(404));

    expect(notify.notifications()).toHaveLength(0);
  });

  it('shows the offline banner for status 0', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(0));

    expect(notify.notifications()[0].message).toBe('You appear to be offline.');
  });

  it('logs every error regardless of behaviour', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const logger = TestBed.inject(LoggerService);
    const spy = vi.spyOn(logger, 'error');

    service.handle(makeError(404));

    expect(spy).toHaveBeenCalledWith('[HTTP 404]', { url: '/api/v1/employees', event: 'resource_not_found' });
  });

  it('falls back to a generic banner for an unmapped status', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(418));

    expect(notify.notifications()[0].message).toBe('An unexpected error occurred.');
  });
});
