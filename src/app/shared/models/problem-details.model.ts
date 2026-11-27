/**
 * An error body from the backend API. Every field is optional because the bodies differ today: the exception
 * middleware sends the full problem shape with `errors` and `correlationId`, the auth/CSRF/rate-limit middlewares
 * leave out `correlationId`, controller `Problem(...)` sends `traceId`, the tray check sends `code`, and tenant
 * enforcement sends only `status` and `detail`. Backend Improvements task 24 makes this one shape with a stable
 * `code`; until then read it through `toApiError()` (core/errors/api-error.ts), never field by field.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Field errors from a 400, keyed by the backend property name (PascalCase, possibly nested: `Addresses[0].Type`). */
  errors?: Record<string, string[] | string | undefined>;
  /** A stable machine-readable code for errors the frontend must react to (for example `active_tray_required`). */
  code?: string;
  correlationId?: string;
  traceId?: string;
}
