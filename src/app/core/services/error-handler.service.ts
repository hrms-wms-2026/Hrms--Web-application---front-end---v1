import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

type ErrorBehaviour = 'banner' | 'inline' | 'silent';

interface ErrorAction {
  userMessage: string;
  behaviour: ErrorBehaviour;
  telemetryEvent: string;
}

const ERROR_TAXONOMY: Record<number, ErrorAction> = {
  401: { userMessage: '', behaviour: 'silent', telemetryEvent: 'auth_session_expired' },
  403: { userMessage: "You don't have access to this.", behaviour: 'banner', telemetryEvent: 'auth_forbidden' },
  404: { userMessage: 'This record no longer exists.', behaviour: 'inline', telemetryEvent: 'resource_not_found' },
  409: {
    userMessage: 'This record was just updated by someone else. Please refresh.',
    behaviour: 'inline',
    telemetryEvent: 'data_conflict'
  },
  422: { userMessage: 'Please check the highlighted fields.', behaviour: 'inline', telemetryEvent: 'validation_error' },
  429: { userMessage: 'Too many requests. Please wait a moment.', behaviour: 'banner', telemetryEvent: 'rate_limited' },
  500: { userMessage: 'Something went wrong. Please try again.', behaviour: 'banner', telemetryEvent: 'server_error' },
  503: { userMessage: 'Service temporarily unavailable.', behaviour: 'banner', telemetryEvent: 'service_unavailable' },
  0: { userMessage: 'You appear to be offline.', behaviour: 'banner', telemetryEvent: 'network_offline' }
};

const DEFAULT_ACTION: ErrorAction = {
  userMessage: 'An unexpected error occurred.',
  behaviour: 'banner',
  telemetryEvent: 'unknown_error'
};

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  handle(error: HttpErrorResponse): void {
    const action = ERROR_TAXONOMY[error.status] ?? DEFAULT_ACTION;

    this.logger.error(`[HTTP ${error.status}]`, { url: error.url ?? undefined, event: action.telemetryEvent });

    if (action.behaviour === 'banner') {
      this.notify.error(action.userMessage);
    }
  }
}
