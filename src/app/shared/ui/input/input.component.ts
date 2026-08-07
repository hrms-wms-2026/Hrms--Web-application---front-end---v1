import { Component, computed, input, output } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';

@Component({
  selector: 'app-input',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="inputId" class="text-xs font-medium text-[var(--color-text-secondary)]">{{ label() }}</label>
      }
      <input
        [id]="inputId"
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="value()"
        (input)="onInput($event)"
        (blur)="blurred.emit()"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? errorId() : hint() ? hintId() : null"
        class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      />
      @if (error()) {
        <span [id]="errorId()" class="text-xs text-[var(--color-danger-text)]">{{ error() }}</span>
      } @else if (hint()) {
        <span [id]="hintId()" class="text-xs text-[var(--color-text-secondary)]">{{ hint() }}</span>
      }
    </div>
  `
})
export class InputComponent {
  label = input<string>('');
  type = input<InputType>('text');
  placeholder = input<string>('');
  disabled = input(false);
  value = input<string>('');
  error = input<string>('');
  hint = input<string>('');

  valueChange = output<string>();
  blurred = output<void>();

  readonly inputId = nextUniqueId('app-input');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
