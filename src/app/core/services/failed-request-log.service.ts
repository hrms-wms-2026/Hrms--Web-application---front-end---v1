import { Injectable, signal } from '@angular/core';

/** One failed API call the user saw, kept so a support ticket can carry its reference. Never a body or a query. */
export interface FailedRequest {
  readonly correlationId: string;
  readonly method: string;
  /** URL path only: no host, no query string, no fragment. */
  readonly path: string;
  readonly status: number;
  /** ISO time the failure was recorded. */
  readonly at: string;
}

export const FAILED_REQUEST_LOG_SIZE = 5;

/** The path part of a request URL. Query strings and fragments can carry personal data, so they are dropped. */
export function requestPath(url: string): string {
  const withoutQuery = url.split(/[?#]/, 1)[0];
  const match = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i.exec(withoutQuery);
  if (match) return match[1] ?? '/';
  return withoutQuery;
}

/**
 * The last few failed requests (newest first), in memory only, for the support ticket form's "Recent errors".
 * Cleared on reload. Each entry holds the correlation id the backend logged the request under.
 */
@Injectable({ providedIn: 'root' })
export class FailedRequestLogService {
  private readonly entries = signal<readonly FailedRequest[]>([]);
  readonly recent = this.entries.asReadonly();

  record(entry: {
    correlationId: string;
    method: string;
    url: string;
    status: number;
    at?: Date;
  }): void {
    const item: FailedRequest = {
      correlationId: entry.correlationId,
      method: entry.method.toUpperCase(),
      path: requestPath(entry.url),
      status: entry.status,
      at: (entry.at ?? new Date()).toISOString(),
    };
    this.entries.update((list) =>
      [item, ...list.filter((e) => e.correlationId !== item.correlationId)].slice(
        0,
        FAILED_REQUEST_LOG_SIZE,
      ),
    );
  }
}
