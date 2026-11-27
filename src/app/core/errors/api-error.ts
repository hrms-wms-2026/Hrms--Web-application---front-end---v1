import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetails } from '../../shared/models/problem-details.model';
import { isMachineValue, toSafeErrorMessage } from '../services/error-handler.service';

/** How a screen should treat a failure (Improvements task 20, rules in docs/core/ARCHITECTURE.md §7.1). */
export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'server'
  | 'network'
  | 'other';

/** One shape for any failed request. Build it with `toApiError()`; the thrown value stays an HttpErrorResponse. */
export interface ApiError {
  /** HTTP status, 0 for a network failure, null when the error did not come from HTTP. */
  readonly status: number | null;
  readonly kind: ApiErrorKind;
  /** The backend's stable code when it sends one (backend task 24), otherwise null. */
  readonly code: string | null;
  /** Safe to show the user: the same text `toSafeErrorMessage` gives. */
  readonly message: string;
  /** Field errors from a 400, keyed by backend property name, with technical messages removed. */
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  /** Lets support find the request in the backend logs. */
  readonly correlationId: string | null;
  /** From the Retry-After header of a 429, when the browser can read it. */
  readonly retryAfterSeconds: number | null;
}

/** The X-Correlation-ID each failed request was sent with, recorded by the error interceptor. */
const requestCorrelationIds = new WeakMap<HttpErrorResponse, string>();

/** Called by the error interceptor so the request's own id is known even when the body and headers lack it. */
export function rememberCorrelationId(error: HttpErrorResponse, correlationId: string | null): void {
  if (correlationId) requestCorrelationIds.set(error, correlationId);
}

function kindOf(status: number): ApiErrorKind {
  if (status === 0) return 'network';
  if (status === 400 || status === 422) return 'validation';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'server';
  return 'other';
}

function bodyOf(error: HttpErrorResponse): ProblemDetails | null {
  return error.error && typeof error.error === 'object' ? (error.error as ProblemDetails) : null;
}

function readFieldErrors(body: ProblemDetails | null): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!body?.errors || typeof body.errors !== 'object' || Array.isArray(body.errors)) return result;
  for (const [key, raw] of Object.entries(body.errors)) {
    const messages = (Array.isArray(raw) ? raw : [raw]).filter(
      (m): m is string => typeof m === 'string' && m.trim() !== '' && !isMachineValue(m),
    );
    if (messages.length > 0) result[key] = messages;
  }
  return result;
}

function readRetryAfter(error: HttpErrorResponse): number | null {
  const raw = error.headers.get('Retry-After');
  if (raw === null || !/^\d+$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Turns any caught error into an ApiError. `fallbackMessage` works as it does for `toSafeErrorMessage`. */
export function toApiError(err: unknown, fallbackMessage?: string): ApiError {
  const message = toSafeErrorMessage(err, fallbackMessage);
  if (!(err instanceof HttpErrorResponse)) {
    return { status: null, kind: 'other', code: null, message, fieldErrors: {}, correlationId: null, retryAfterSeconds: null };
  }
  const body = bodyOf(err);
  const code = typeof body?.code === 'string' && body.code !== '' ? body.code : null;
  const correlationId =
    (typeof body?.correlationId === 'string' && body.correlationId !== '' ? body.correlationId : null) ??
    requestCorrelationIds.get(err) ??
    err.headers.get('X-Correlation-Id');
  return {
    status: err.status,
    kind: kindOf(err.status),
    code,
    message,
    fieldErrors: readFieldErrors(body),
    correlationId,
    retryAfterSeconds: readRetryAfter(err),
  };
}
