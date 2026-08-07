import { Component, computed, input, output } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-select',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="selectId" class="text-xs font-medium text-[var(--color-text-secondary)]">{{ label() }}</label>
      }
      <select
        [id]="selectId"
        [disabled]="disabled()"
        (change)="onChange($event)"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? errorId() : null"
        class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        @if (placeholder()) {
          <option value="" disabled [selected]="!value()" hidden>{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()">{{ option.label }}</option>
        }
      </select>
      @if (error()) {
        <span [id]="errorId()" class="text-xs text-[var(--color-danger-text)]">{{ error() }}</span>
      }
    </div>
  `
})
export class SelectComponent {
  label = input<string>('');
  placeholder = input<string>('');
  options = input<readonly SelectOption[]>([]);
  disabled = input(false);
  value = input<string>('');
  error = input<string>('');

  valueChange = output<string>();

  readonly selectId = nextUniqueId('app-select');
  readonly errorId = computed(() => `${this.selectId}-error`);

  onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }
}
