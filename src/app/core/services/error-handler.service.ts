import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';
import { NetworkStatusService } from '../network/network-status.service';
import { toApiError } from '../errors/api-error';

type ErrorBehaviour = 'banner' | 'inline' | 'silent';

interface ErrorAction {
  userMessage: string;
  behaviour: ErrorBehaviour;
  telemetryEvent: string;
}

const KNOWN_CODE_MAPPINGS: Record<string, string> = {
  storage_not_entitled: 'This feature is not included in your current plan.',
  not_entitled: 'This feature is not included in your current plan.',
  quota_exceeded: 'Storage limit reached. Please upgrade your plan or free up space.',
  storage_quota_exceeded: 'Storage limit reached. Please upgrade your plan or free up space.',
  tenant_context_missing: 'Session context missing. Please try signing in again.',
  invalid_file_size: 'The selected file exceeds the maximum allowed size.',
  meeting_provider_not_connected: 'Connect a Microsoft account under Settings → Calendar Connections to add a Teams meeting.'
};

const HTTP_STATUS_MAPPINGS: Record<number, string> = {
  400: 'Please check the highlighted fields.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have access to perform this action.',
  404: 'The requested record could not be found.',
  409: 'This change conflicts with existing data. Please review and try again.',
  422: 'Please check the highlighted fields.',
  429: 'Too many requests. Please wait a moment.',
  500: 'Something went wrong while saving your changes.',
  503: 'The service is temporarily unavailable. Please try again.',
  0: 'We could not reach the server. Check your connection and try again.'
};

const DEFAULT_SAFE_MESSAGE = 'Something went wrong. Please try again.';
const SESSION_SECURITY_SAFE_MESSAGE = 'Your session security check failed. Refresh the page and try again.';
/** ExceptionHandlerMiddleware's static ValidationProblemDetails wording for FluentValidation
 *  failures - "title" is "Validation Error", this exact sentence is always "detail". Neither
 *  names the field that actually failed, so both must be skipped whenever a field-keyed
 *  errors dictionary is available instead. */
const GENERIC_VALIDATION_DETAIL = 'One or more validation errors occurred.';

export function isSecurityError(str: string): boolean {
  if (!str) return false;
  return /(csrf|xsrf|anti-forgery|antiforgery|security\s+token|token\s+header|missing\s+token|invalid\s+token|expired\s+token|cookie|x-csrf-token|x-xsrf-token)/i.test(str);
}

export function isMachineValue(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();

  // Known machine code check
  if (KNOWN_CODE_MAPPINGS[trimmed.toLowerCase()]) {
    return true;
  }

  // Technical security terms
  if (isSecurityError(trimmed)) {
    return true;
  }

  // Starts with {, [, <, or " (raw JSON, XML, HTML, quoted string)
  if (/^\s*[{[<"]/.test(trimmed)) {
    return true;
  }

  // Snake case code (e.g., storage_not_entitled, invalid_file_type)
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/i.test(trimmed)) {
    return true;
  }

  // CamelCase single internal code (e.g., storageNotEntitled, tenantContextMissing)
  if (/^[a-z]+[A-Z0-9][a-zA-Z0-9]*$/.test(trimmed)) {
    return true;
  }

  // GUIDs
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(trimmed)) {
    return true;
  }

  // URLs or API endpoints
  if (/https?:\/\/|\/api\/v\d+/i.test(trimmed)) {
    return true;
  }

  // Exception names or stack traces
  if (
    /\b(Exception|Error|Fault|System\.|Microsoft\.|Npgsql\.|EFCore|StackTrace|Traceback)\b/i.test(trimmed) ||
    /\bat\s+[a-zA-Z0-9_.]+\(/i.test(trimmed)
  ) {
    return true;
  }

  // Raw SQL / database table / column names
  // Structural only: a plain sentence like "Only the author can delete." must still reach the user.
  if (/\bSELECT\b[\s\S]+\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]+\bSET\b|\bDELETE\s+FROM\b|\bdbo\.|\b(FK|IX|PK)_\w/i.test(trimmed)) {
    return true;
  }

  // Permission implementation details (e.g. legal_entity:update, org:manage)
  if (/\b[a-z_]+:[a-z_]+\b/i.test(trimmed)) {
    return true;
  }

  return false;
}

/** The server's own human message (detail / message / title / first field error), or null when there is none or it
 *  looks technical (URL, exception, SQL, internal code). For callers that pick their own fallback per status. */
export function safeServerDetail(err: unknown): string | null {
  const body = err && typeof err === 'object' && 'error' in err ? (err as { error?: unknown }).error : null;
  if (!body || typeof body !== 'object') return null;
  const b = body as { detail?: unknown; message?: unknown; title?: unknown; errors?: unknown };
  let candidate: unknown = null;
  if (b.errors && typeof b.errors === 'object' && !Array.isArray(b.errors)) {
    const first = Object.values(b.errors as Record<string, unknown>)[0];
    candidate = Array.isArray(first) ? first[0] : first;
  }
  if (typeof candidate !== 'string' && typeof b.detail === 'string' && b.detail !== GENERIC_VALIDATION_DETAIL) candidate = b.detail;
  if (typeof candidate !== 'string' && typeof b.message === 'string') candidate = b.message;
  if (typeof candidate !== 'string' && typeof b.title === 'string' && b.title !== GENERIC_VALIDATION_DETAIL) candidate = b.title;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  const known = KNOWN_CODE_MAPPINGS[trimmed.toLowerCase()];
  if (known) return known;
  return trimmed.length > 0 && trimmed.length < 300 && !isMachineValue(trimmed) ? trimmed : null;
}

export function toSafeErrorMessage(err: unknown, fallbackMessage?: string): string {
  let rawCandidate: string | null = null;
  let statusCode: number | null = null;

  if (err instanceof HttpErrorResponse) {
    statusCode = err.status;
    const body = err.error;

    if (typeof body === 'string') {
      rawCandidate = body;
    } else if (body && typeof body === 'object') {
      // Field-keyed validation errors (ValidationProblemDetails.errors) are checked first and
      // take priority over detail/message/title - those carry only the generic "Validation
      // Error" / "One or more validation errors occurred." wording, which names no field and
      // tells the user nothing actionable, even though a specific message is available.
      if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) {
        const firstKey = Object.keys(body.errors)[0];
        if (firstKey && body.errors[firstKey]) {
          const val = body.errors[firstKey];
          rawCandidate = Array.isArray(val) ? val[0] : String(val);
        }
      }
      if (!rawCandidate && body.detail && typeof body.detail === 'string' && body.detail !== GENERIC_VALIDATION_DETAIL) {
        rawCandidate = body.detail;
      } else if (!rawCandidate && body.message && typeof body.message === 'string') {
        rawCandidate = body.message;
      } else if (!rawCandidate && body.title && typeof body.title === 'string' && body.title !== GENERIC_VALIDATION_DETAIL) {
        rawCandidate = body.title;
      }
    }
    if (!rawCandidate && err.message) {
      rawCandidate = err.message;
    }
  } else if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if ('status' in obj && typeof obj['status'] === 'number') {
      statusCode = obj['status'];
    }
    if ('error' in obj && obj['error']) {
      return toSafeErrorMessage(obj['error'], fallbackMessage);
    }
    if ('detail' in obj && typeof obj['detail'] === 'string') {
      rawCandidate = obj['detail'];
    } else if ('message' in obj && typeof obj['message'] === 'string') {
      rawCandidate = obj['message'];
    }
  } else if (typeof err === 'string') {
    rawCandidate = err;
  }

  if (rawCandidate) {
    const trimmed = rawCandidate.trim();
    const knownSafe = KNOWN_CODE_MAPPINGS[trimmed.toLowerCase()];
    if (knownSafe) {
      return knownSafe;
    }
    if (isSecurityError(trimmed)) {
      return SESSION_SECURITY_SAFE_MESSAGE;
    }
    if (!isMachineValue(trimmed) && trimmed.length > 0 && trimmed.length < 300) {
      return trimmed;
    }
  }

  // A caller's own fallback ("Failed to load projects.") says more than the generic server-error line.
  if (fallbackMessage && statusCode !== null && statusCode >= 500) {
    return fallbackMessage;
  }

  if (statusCode !== null && HTTP_STATUS_MAPPINGS[statusCode]) {
    return HTTP_STATUS_MAPPINGS[statusCode];
  }

  return fallbackMessage || DEFAULT_SAFE_MESSAGE;
}

const ERROR_TAXONOMY: Record<number, ErrorAction> = {
  400: { userMessage: 'Please check the highlighted fields.', behaviour: 'inline', telemetryEvent: 'bad_request' },
  401: { userMessage: 'Your session has expired. Please sign in again.', behaviour: 'silent', telemetryEvent: 'auth_session_expired' },
  403: { userMessage: 'You do not have access to perform this action.', behaviour: 'banner', telemetryEvent: 'auth_forbidden' },
  404: { userMessage: 'The requested record could not be found.', behaviour: 'inline', telemetryEvent: 'resource_not_found' },
  409: {
    userMessage: 'This change conflicts with existing data. Please review and try again.',
    behaviour: 'inline',
    telemetryEvent: 'data_conflict'
  },
  422: { userMessage: 'Please check the highlighted fields.', behaviour: 'inline', telemetryEvent: 'validation_error' },
  429: { userMessage: 'Too many requests. Please wait a moment.', behaviour: 'banner', telemetryEvent: 'rate_limited' },
  500: { userMessage: 'Something went wrong while saving your changes.', behaviour: 'banner', telemetryEvent: 'server_error' },
  503: { userMessage: 'The service is temporarily unavailable. Please try again.', behaviour: 'banner', telemetryEvent: 'service_unavailable' },
  0: { userMessage: 'We could not reach the server. Check your connection and try again.', behaviour: 'banner', telemetryEvent: 'network_offline' }
};

const DEFAULT_ACTION: ErrorAction = {
  userMessage: 'Something went wrong. Please try again.',
  behaviour: 'banner',
  telemetryEvent: 'unknown_error'
};

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);
  private network = inject(NetworkStatusService);

  toSafeMessage(err: unknown, fallbackMessage?: string): string {
    return toSafeErrorMessage(err, fallbackMessage);
  }

  handle(error: HttpErrorResponse): void {
    const key = error.status === 0 ? 0 : error.status;
    const action = ERROR_TAXONOMY[key] ?? DEFAULT_ACTION;
    const apiError = toApiError(error, action.userMessage);

    this.logger.error(`[HTTP ${error.status}]`, {
      url: error.url ?? undefined,
      event: action.telemetryEvent,
      correlationId: apiError.correlationId ?? undefined,
      detail: typeof error.error === 'object' ? error.error?.detail : error.message
    });

    if (action.behaviour !== 'banner') return;
    // The offline banner already explains a failed request; a toast per poll would only add noise.
    if (apiError.kind === 'network' && !this.network.online()) return;
    this.notify.error(this.toastText(apiError));
  }

  private toastText(apiError: ReturnType<typeof toApiError>): string {
    if (apiError.kind === 'rate-limited' && apiError.retryAfterSeconds !== null) {
      return `Too many requests. Please wait ${apiError.retryAfterSeconds} seconds and try again.`;
    }
    // Server errors carry the request's correlation id so support can find it in the backend logs.
    if (apiError.kind === 'server' && apiError.correlationId) {
      return `${apiError.message} Reference: ${apiError.correlationId}`;
    }
    return apiError.message;
  }
}
