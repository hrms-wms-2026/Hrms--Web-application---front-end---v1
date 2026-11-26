import { Injectable, InjectionToken, inject } from '@angular/core';

export interface LogEntry {
  readonly level: 'error' | 'warn';
  readonly message: string;
  readonly context: Record<string, unknown>;
}

/**
 * Where logs go besides the console. Backend Improvements task 17 has not chosen a log target for client errors yet,
 * so nothing provides this today; provide `{ report(entry) }` here once it has. A failing sink never breaks the app.
 */
export const LOG_SINK = new InjectionToken<{ report(entry: LogEntry): void }>('LOG_SINK');

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private readonly sink = inject(LOG_SINK, { optional: true });

  error(message: string, context: Record<string, unknown> = {}): void {
    console.error(message, context);
    this.report({ level: 'error', message, context });
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    console.warn(message, context);
    this.report({ level: 'warn', message, context });
  }

  private report(entry: LogEntry): void {
    if (!this.sink) return;
    try {
      this.sink.report(entry);
    } catch {
      // Logging must never be the reason the app breaks.
    }
  }
}
