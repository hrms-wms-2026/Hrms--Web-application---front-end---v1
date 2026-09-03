import { Component, computed, input, output } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectIcon = 'module' | 'status' | 'category' | 'sprint' | 'filter';

const SELECT_ICON_PATHS: Record<SelectIcon, string> = {
  module: 'M4 5h16v14H4z M8 9h8M8 13h5',
  status: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 8v4l2.5 2',
  category: 'M4 6h16M7 12h10M10 18h4',
  sprint: 'M4 5h16v14H4z M8 9h8M8 13h5',
  filter: 'M3 7h18M6 7v10M18 7v10M9 17h6'
};

@Component({
  selector: 'app-select',
  standalone: true,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="selectId" class="text-xs font-medium text-[var(--color-text-secondary)]">{{ label() }}</label>
      }
      <div class="relative flex items-center">
        @if (icon(); as iconName) {
          <svg
            data-testid="select-leading-icon"
            class="pointer-events-none absolute left-3 h-4 w-4 text-[var(--color-accent)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path [attr.d]="selectIconPath(iconName)" />
          </svg>
        }
        <select
        [id]="selectId"
        [disabled]="disabled()"
        (change)="onChange($event)"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? errorId() : null"
        class="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        [class.pl-10]="icon()"
      >
        @if (placeholder()) {
          <option value="" disabled [selected]="!value()" hidden>{{ placeholder() }}</option>
        }
        @for (option of options(); track option.value) {
          <option [value]="option.value" [selected]="option.value === value()" [disabled]="option.disabled || false">{{ option.label }}</option>
        }
        </select>
      </div>
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
  ariaLabel = input<string>('');
  icon = input<SelectIcon | undefined>(undefined);

  valueChange = output<string>();

  readonly selectId = nextUniqueId('app-select');
  readonly errorId = computed(() => `${this.selectId}-error`);

    selectIconPath(icon: SelectIcon): string {
    return SELECT_ICON_PATHS[icon];
  }

  onChange(event: Event): void {
    this.valueChange.emit((event.target as HTMLSelectElement).value);
  }

}
