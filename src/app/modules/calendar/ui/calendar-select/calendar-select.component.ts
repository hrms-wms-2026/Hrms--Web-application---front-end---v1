import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal
} from '@angular/core';

export interface CalendarSelectOption {
  value: string;
  label: string;
}

/**
 * A small custom-styled dropdown for the calendar module. Drop-in for the Repeat
 * field: same `options` / `value` / `valueChange` shape as the shared `app-select`,
 * but the open list is our own styled panel (a native `<select>`'s option list can't
 * be themed). Not shared - keeps the app-wide `app-select` untouched.
 */
@Component({
  selector: 'app-calendar-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <button
        type="button"
        data-testid="calendar-select-trigger"
        class="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() || null"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)"
      >
        <span [class.text-[var(--color-text-secondary)]]="!selectedLabel()">{{ selectedLabel() || placeholder() }}</span>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             class="shrink-0 text-[var(--color-text-secondary)] transition-transform"
             [style.transform]="open() ? 'rotate(180deg)' : null">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      @if (open()) {
        <ul
          role="listbox"
          data-testid="calendar-select-panel"
          class="absolute z-20 mt-1 flex w-full flex-col gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg"
        >
          @for (option of options(); track option.value) {
            <li role="none">
              <button
                type="button"
                role="option"
                data-testid="calendar-select-option"
                [attr.aria-selected]="option.value === value()"
                class="w-full rounded px-2.5 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-surface-secondary)] focus-visible:outline-none"
                [class.bg-[var(--color-accent-subtle)]]="option.value === value()"
                [class.font-medium]="option.value === value()"
                (click)="select(option.value)"
                (keydown)="onOptionKeydown($event)"
              >{{ option.label }}</button>
            </li>
          }
        </ul>
      }
    </div>
  `
})
export class CalendarSelectComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  options = input<readonly CalendarSelectOption[]>([]);
  value = input<string>('');
  placeholder = input<string>('Select…');
  ariaLabel = input<string>('');

  valueChange = output<string>();

  readonly open = signal(false);
  readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? ''
  );

  toggle(): void {
    this.open.update((v) => !v);
    if (this.open()) this.focusOption(this.currentIndex());
  }

  select(value: string): void {
    this.valueChange.emit(value);
    this.open.set(false);
    this.trigger()?.focus();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) this.open.set(true);
      this.focusOption(this.currentIndex());
    }
  }

  onOptionKeydown(event: KeyboardEvent): void {
    const options = this.optionButtons();
    const idx = options.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      this.open.set(false);
      this.trigger()?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusOption(Math.min(idx + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (idx <= 0) this.trigger()?.focus();
      else this.focusOption(idx - 1);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.open.set(false);
      this.trigger()?.focus();
    }
  }

  private currentIndex(): number {
    const i = this.options().findIndex((o) => o.value === this.value());
    return i < 0 ? 0 : i;
  }

  private trigger(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector('[data-testid="calendar-select-trigger"]');
  }

  private optionButtons(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll('[data-testid="calendar-select-option"]'));
  }

  private focusOption(index: number): void {
    // let the panel render first
    setTimeout(() => this.optionButtons()[index]?.focus(), 0);
  }
}
