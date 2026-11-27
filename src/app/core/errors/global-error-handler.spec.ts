import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LoggerService } from '../services/logger.service';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  function setup(logger: Partial<LoggerService>) {
    TestBed.configureTestingModule({ providers: [GlobalErrorHandler, { provide: LoggerService, useValue: logger }] });
    return TestBed.inject(GlobalErrorHandler);
  }

  it('reports an unexpected client error with its message, stack and a client error id', () => {
    const error = vi.fn();
    const handler = setup({ error });
    const boom = new Error('boom');

    handler.handleError(boom);

    expect(error).toHaveBeenCalledTimes(1);
    const [message, context] = error.mock.calls[0] as [string, Record<string, unknown>];
    expect(message).toBe('[client] Unhandled error');
    expect(context['message']).toBe('boom');
    expect(context['stack']).toBe(boom.stack);
    expect(context['clientErrorId']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reports a thrown non-Error value as text', () => {
    const error = vi.fn();
    setup({ error }).handleError('plain failure');
    expect((error.mock.calls[0] as [string, Record<string, unknown>])[1]['message']).toBe('plain failure');
  });

  it('never throws, even when reporting fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = setup({
      error: () => {
        throw new Error('logger down');
      },
    });
    expect(() => handler.handleError(new Error('boom'))).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('does not report a failed request again, because the error interceptor already did', () => {
    const error = vi.fn();
    setup({ error }).handleError(new HttpErrorResponse({ status: 500 }));
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps the raw error in the report', () => {
    const error = vi.fn();
    const boom = new Error('boom');
    setup({ error }).handleError(boom);
    expect((error.mock.calls[0] as [string, Record<string, unknown>])[1]['error']).toBe(boom);
  });
});
