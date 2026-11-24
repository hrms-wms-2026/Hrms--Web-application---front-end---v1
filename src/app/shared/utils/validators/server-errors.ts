import { FormGroup } from '@angular/forms';
import type { ApiError } from '../../../core/errors/api-error';

/** `Addresses[0].AddressType` → `addresses`: the top-level backend property with its first letter lowercased. */
function controlNameFor(backendKey: string): string {
  const top = backendKey.split(/[.[]/)[0] ?? backendKey;
  return top.charAt(0).toLowerCase() + top.slice(1);
}

/**
 * Shows a 400's field errors next to their fields (Improvements task 20). Each matching control gets a `server`
 * error carrying the backend message, which `fieldError()`/`validationMessage()` show as it is. The control's next
 * validation run (any value change) replaces it. Returns the first message whose key matches no control, so the
 * caller can show it as a form-level message, or null when every message found a field.
 */
export function applyServerFieldErrors(form: FormGroup, apiError: ApiError): string | null {
  let unmatched: string | null = null;
  for (const [key, messages] of Object.entries(apiError.fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    const control = form.get(controlNameFor(key));
    // A disabled control shows no error, so its message goes to the form level instead.
    if (control?.enabled) {
      control.setErrors({ ...(control.errors ?? {}), server: { message } });
      control.markAsTouched();
    } else {
      unmatched ??= message;
    }
  }
  return unmatched;
}

/** Kinds whose toast the error handler already showed (core/services/error-handler.service.ts). */
const TOASTED_BY_ERROR_HANDLER = new Set<ApiError['kind']>(['server', 'network', 'forbidden', 'rate-limited', 'other']);

/**
 * The toast a page shows after a save failed, or null when nothing more is needed: the form shows the field errors
 * itself, or the error handler already toasted the failure (server, network, 403, 429, unknown status). Use it with
 * the store's ApiError so a failed save gives one message, not two.
 */
export function failedSaveToast(apiError: ApiError | null, fallback: string): string | null {
  if (!apiError) return fallback;
  if (apiError.status !== null && TOASTED_BY_ERROR_HANDLER.has(apiError.kind)) return null;
  if (Object.keys(apiError.fieldErrors).length > 0) return null;
  return apiError.message;
}
