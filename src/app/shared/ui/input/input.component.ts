import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';
import { FieldIcon, FieldIconComponent } from '../field-icon/field-icon.component';

export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'search'
  | 'tel'
  | 'url'
  | 'date'
  | 'time';

/** Leading icon each type gets unless the caller passes `icon` (or `icon="none"`). */
const DEFAULT_TYPE_ICON: Partial<Record<InputType, FieldIcon>> = {
  email: 'mail',
  password: 'lock',
  search: 'search',
  tel: 'phone',
  url: 'link'
};

/**
 * The app's text field, in the standard `.ui-field` style (see shared/styles/fields.css):
 * optional leading icon or prefix with a divider, accent border on focus, green when `success`,
 * red with a message when `error`, grey when disabled. `multiline` renders a textarea.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FieldIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    <div class="flex flex-col gap-1.5">
      @if (label()) {
        <label [for]="inputId" class="ui-field-label">{{ label() }}@if (required()) {<span class="ui-field-required" aria-hidden="true">*</span>}</label>
      }
      <div
        class="ui-field"
        [class.ui-field--sm]="size() === 'sm'"
        [class.ui-field--multiline]="multiline()"
        [class.ui-field--error]="!!error()"
        [class.ui-field--success]="success() && !error()"
        [class.ui-field--disabled]="disabled()"
      >
        @if (leadingIcon(); as iconName) {
          <span class="ui-field__addon" aria-hidden="true"><app-field-icon [name]="iconName" /></span>
        } @else if (prefix()) {
          <span class="ui-field__addon">{{ prefix() }}</span>
        }
        @if (multiline()) {
          <textarea
            [id]="inputId"
            class="ui-field__control"
            [rows]="rows()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [value]="value()"
            (input)="onInput($event)"
            (blur)="blurred.emit()"
            [attr.maxlength]="maxlength()"
            [attr.aria-invalid]="error() ? true : null"
            [attr.aria-describedby]="error() ? errorId() : hint() ? hintId() : null"
          ></textarea>
        } @else {
          <input
            [id]="inputId"
            class="ui-field__control"
            [type]="effectiveType()"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [value]="value()"
            (input)="onInput($event)"
            (blur)="blurred.emit()"
            [attr.maxlength]="maxlength()"
            [attr.aria-invalid]="error() ? true : null"
            [attr.aria-describedby]="error() ? errorId() : hint() ? hintId() : null"
          />
        }
        @if (type() === 'password') {
          <span class="ui-field__trailing">
            <button
              type="button"
              class="ui-field__icon-btn"
              (click)="toggleShowPassword()"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            >
              @if (showPassword()) {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              }
            </button>
          </span>
        } @else if (error() && !multiline()) {
          <span class="ui-field__trailing ui-field__trailing--error" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
          </span>
        } @else if (success() && !multiline()) {
          <span class="ui-field__trailing ui-field__trailing--success" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
        }
      </div>
      @if (error()) {
        <span [id]="errorId()" class="ui-field-error">{{ error() }}</span>
      } @else if (hint()) {
        <span [id]="hintId()" class="ui-field-hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: [`
    input::-ms-reveal,
    input::-ms-clear {
      display: none;
    }
  `]
})
export class InputComponent {
  label = input<string>('');
  /** Shows a red asterisk after the label. */
  required = input(false);
  type = input<InputType>('text');
  placeholder = input<string>('');
  disabled = input(false);
  value = input<string>('');
  error = input<string>('');
  hint = input<string>('');
  maxlength = input<number | null>(null);
  /** Leading icon. Defaults by type (email, password, search, tel, url); 'none' turns it off. */
  icon = input<FieldIcon | 'none' | null>(null);
  /** Leading text addon such as "Rs" or "+94", shown when there is no icon. */
  prefix = input<string>('');
  /** Green border and check - e.g. a code that was just verified as available. */
  success = input(false);
  size = input<'md' | 'sm'>('md');
  multiline = input(false);
  rows = input(3);

  valueChange = output<string>();
  blurred = output<void>();

  readonly showPassword = signal(false);

  readonly effectiveType = computed(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  });

  readonly leadingIcon = computed<FieldIcon | null>(() => {
    const icon = this.icon();
    if (icon === 'none') return null;
    return icon ?? DEFAULT_TYPE_ICON[this.type()] ?? null;
  });

  readonly inputId = nextUniqueId('app-input');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }
}
