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
