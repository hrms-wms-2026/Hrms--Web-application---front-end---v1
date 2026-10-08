import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal
} from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export interface ListboxSelectOption {
  value: string;
  label: string;
}

/**
 * Custom-styled single-select dropdown: same `options` / `value` / `valueChange` shape as `app-select`,
 * but the open list is our own themed panel (a native `<select>`'s option list can't be styled).
 * `searchable` adds a filter box at the top of the panel for long lists such as timezones.
 */
@Component({
  selector: 'app-listbox-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1">
      @if (label()) {
        <label [for]="triggerId" class="text-xs font-medium text-[var(--color-text-secondary)]">{{ label() }}</label>
      }
      <div class="relative">
        <button
          type="button"
          [id]="triggerId"
          data-testid="listbox-select-trigger"
          class="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="disabled()"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="ariaLabel() || null"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="error() ? errorId : null"
          (click)="toggle()"
          (keydown)="onTriggerKeydown($event)"
        >
          <span class="truncate" [class.text-[var(--color-text-secondary)]]="!selectedLabel()">{{ selectedLabel() || placeholder() }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
               class="shrink-0 text-[var(--color-text-secondary)] transition-transform"
               [style.transform]="open() ? 'rotate(180deg)' : null">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        @if (open()) {
          <div
            data-testid="listbox-select-panel"
            class="absolute z-30 mt-1 flex w-full min-w-[14rem] flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
          >
            @if (searchable()) {
              <div class="flex items-center gap-1.5 border-b border-[var(--color-border)] px-2.5 py-1.5">
                <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 shrink-0 fill-none stroke-[var(--color-text-secondary)]" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  autocomplete="off"
                  data-testid="listbox-select-search"
                  class="w-full border-0 bg-transparent py-0.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]"
                  [placeholder]="searchPlaceholder()"
                  [value]="query()"
                  (input)="query.set($any($event.target).value)"
                  (keydown)="onSearchKeydown($event)"
                />
              </div>
            }
            <ul role="listbox" class="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1">
              @for (option of filteredOptions(); track option.value) {
                <li role="none">
                  <button
                    type="button"
                    role="option"
                    data-testid="listbox-select-option"
                    [attr.aria-selected]="option.value === value()"
                    class="w-full rounded px-2.5 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-surface-secondary)] focus-visible:outline-none"
                    [class.bg-[var(--color-accent-subtle)]]="option.value === value()"
                    [class.font-medium]="option.value === value()"
                    (click)="select(option.value)"
                    (keydown)="onOptionKeydown($event)"
                  >{{ option.label }}</button>
                </li>
              } @empty {
                <li class="px-2.5 py-2 text-xs text-[var(--color-text-secondary)]">No matches</li>
              }
            </ul>
          </div>
        }
      </div>
      @if (error()) {
        <span [id]="errorId" class="text-xs text-[var(--color-danger-text)]">{{ error() }}</span>
      }
    </div>
  `
})
export class ListboxSelectComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  options = input<readonly ListboxSelectOption[]>([]);
  value = input<string>('');
  placeholder = input<string>('Select…');
  ariaLabel = input<string>('');
  label = input<string>('');
  error = input<string>('');
  disabled = input(false);
  searchable = input(false);
  searchPlaceholder = input<string>('Search…');

  valueChange = output<string>();
  /** Fires whenever the open list closes - by picking, Escape, or a click outside. */
  closed = output<void>();

  readonly triggerId = nextUniqueId('app-listbox-select');
  readonly errorId = `${this.triggerId}-error`;
  readonly open = signal(false);
  readonly query = signal('');
  readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label ?? ''
  );
  readonly filteredOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.options().filter((o) => o.label.toLowerCase().includes(q)) : this.options();
  });

  toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  /** Opens the list with the current value in view - lets a caller open it straight from its own trigger. */
  openPanel(): void {
    if (this.disabled()) return;
    this.query.set('');
    this.open.set(true);
    if (this.searchable()) {
      // let the panel render first
      setTimeout(() => {
        this.optionButtons()[this.currentIndex()]?.scrollIntoView?.({ block: 'nearest' });
        this.searchInput()?.focus();
      }, 0);
    } else {
      this.focusOption(this.currentIndex());
    }
  }

  private close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
  }

  select(value: string): void {
    this.valueChange.emit(value);
    this.close();
    this.trigger()?.focus();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) this.openPanel();
      else this.focusOption(this.currentIndex());
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusOption(0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const first = this.filteredOptions()[0];
      if (first) this.select(first.value);
    } else if (event.key === 'Escape') {
      this.closeFromEscape(event);
    }
  }

  onOptionKeydown(event: KeyboardEvent): void {
    const options = this.optionButtons();
    const idx = options.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'Escape') {
      this.closeFromEscape(event);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusOption(Math.min(idx + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (idx > 0) this.focusOption(idx - 1);
      else if (this.searchable()) this.searchInput()?.focus();
      else this.trigger()?.focus();
    }
  }

  /** Escape closes just this list - stopped here so a surrounding modal's own Escape doesn't close too. */
  private closeFromEscape(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.close();
    this.trigger()?.focus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.close();
      this.trigger()?.focus();
    }
  }

  private currentIndex(): number {
    const i = this.filteredOptions().findIndex((o) => o.value === this.value());
    return i < 0 ? 0 : i;
  }

  private trigger(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector('[data-testid="listbox-select-trigger"]');
  }

  private searchInput(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector('[data-testid="listbox-select-search"]');
  }

  private optionButtons(): HTMLButtonElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll('[data-testid="listbox-select-option"]'));
  }

  private focusOption(index: number): void {
    // let the panel render first
    setTimeout(() => this.optionButtons()[index]?.focus(), 0);
  }
}
