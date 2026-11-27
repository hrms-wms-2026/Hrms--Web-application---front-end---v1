import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A field error for controls that are not `app-input` (colour pickers, chip groups, custom pickers). `app-input`
 * already shows its own `[error]`. Pass the message from `fieldError()` or `validationMessage()` (Improvements task 24).
 */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (message()) {
    <p class="ui-field-error" role="alert">{{ message() }}</p>
  }`,
})
export class FieldErrorComponent {
  readonly message = input<string>('');
}
