import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { LoggerService } from '../services/logger.service';

function clientErrorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Reports unexpected client errors (Improvements task 20). Failed requests are handled by the error interceptor;
 * this catches what escapes the code: a thrown error in a component, an unhandled promise rejection. Each report gets
 * a client error id so a user's report can be matched to the log. It does not toast: most of these are not something
 * the user can act on. It must never throw, or Angular would call it again.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly logger = inject(LoggerService);

  handleError(error: unknown): void {
    // A failed request that a caller did not catch was already logged and shown by the error interceptor.
    if (error instanceof HttpErrorResponse) return;
    try {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      // The raw error stays in the context so the console keeps its clickable stack and cause.
      this.logger.error('[client] Unhandled error', { message, stack, clientErrorId: clientErrorId(), error });
    } catch {
      console.error('[client] Unhandled error (reporting failed)', error);
    }
  }
}
