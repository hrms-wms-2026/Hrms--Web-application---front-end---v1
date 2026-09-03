import { Component, computed, input, output, signal } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

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

@Component({
  selector: 'app-input',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="inputId" class="text-xs font-medium text-[var(--color-text-secondary)]">{{ label() }}</label>
      }
      <div class="relative flex items-center w-full">
        <input
          [id]="inputId"
          [type]="effectiveType()"
          [placeholder]="placeholder()"
          [disabled]="disabled()"
          [value]="value()"
          (input)="onInput($event)"
          (blur)="blurred.emit()"
          [attr.maxlength]="maxlength()"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="error() ? errorId() : hint() ? hintId() : null"
          class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          [class.pr-10]="type() === 'password'"
        />
        @if (type() === 'password') {
          <button
            type="button"
            (click)="toggleShowPassword()"
            [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
            class="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center p-1 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 cursor-pointer focus:outline-none transition-colors"
          >
            @if (showPassword()) {
              <!-- Eye Slash Icon (Hide) -->
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            } @else {
              <!-- Eye Icon (Show) -->
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4.5 h-4.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            }
          </button>
        }
      </div>
      @if (error()) {
        <span [id]="errorId()" class="text-xs text-[var(--color-danger-text)]">{{ error() }}</span>
      } @else if (hint()) {
        <span [id]="hintId()" class="text-xs text-[var(--color-text-secondary)]">{{ hint() }}</span>
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
  type = input<InputType>('text');
  placeholder = input<string>('');
  disabled = input(false);
  value = input<string>('');
  error = input<string>('');
  hint = input<string>('');
  maxlength = input<number | null>(null);

  valueChange = output<string>();
  blurred = output<void>();

  readonly showPassword = signal(false);

  readonly effectiveType = computed(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  });

  readonly inputId = nextUniqueId('app-input');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}