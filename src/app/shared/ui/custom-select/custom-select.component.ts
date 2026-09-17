import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { SelectOption } from '../select/select.component';
import { nextUniqueId } from '../../utils/unique-id';

@Component({
  selector: 'app-custom-select',
  standalone: true,
  template: `
    <div class="custom-select" [class.custom-select--disabled]="disabled()">
      @if (label()) {
        <label [id]="labelId" class="custom-select__label">{{ label() }}</label>
      }

      <div class="custom-select__control">
        <button
          #triggerBtn
          type="button"
          class="custom-select__trigger"
          [class.custom-select__trigger--open]="isOpen()"
          [class.custom-select__trigger--error]="!!error()"
          [disabled]="disabled()"
          [attr.aria-haspopup]="'listbox'"
          [attr.aria-expanded]="isOpen()"
          [attr.aria-labelledby]="label() ? labelId : null"
          [attr.aria-label]="!label() ? placeholder() : null"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? errorId() : null"
          (click)="toggleOpen($event)"
          (keydown)="onTriggerKeydown($event)"
        >
          <span
            class="custom-select__display"
            [class.custom-select__display--placeholder]="!selectedOption()"
          >
            {{ selectedOption() ? selectedOption()!.label : placeholder() }}
          </span>

          <svg
            class="custom-select__chevron"
            [class.custom-select__chevron--open]="isOpen()"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        @if (error()) {
          <span [id]="errorId()" class="custom-select__error" role="alert">{{ error() }}</span>
        }

        @if (isOpen()) {
          <div
            class="custom-select__menu"
            tabindex="-1"
            (keydown)="onMenuKeydown($event)"
          >
            @if (searchable() && options().length > 0) {
              <div class="custom-select__search-box" (click)="$event.stopPropagation()">
                <svg
                  class="custom-select__search-icon"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  #searchInput
                  type="text"
                  class="custom-select__search-input"
                  [placeholder]="searchPlaceholder()"
                  [value]="searchQuery()"
                  (input)="onSearchInput($event)"
                  (keydown)="onSearchKeydown($event)"
                  aria-label="Search options"
                />
                @if (searchQuery()) {
                  <button
                    type="button"
                    class="custom-select__search-clear"
                    (click)="clearSearch($event)"
                    tabindex="-1"
                    aria-label="Clear search"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                }
              </div>
            }

            <div
              class="custom-select__options-list"
              role="listbox"
              [attr.aria-labelledby]="label() ? labelId : null"
            >
              @if (options().length === 0) {
                <div class="custom-select__empty">No options available</div>
              } @else if (filteredOptions().length === 0) {
                <div class="custom-select__empty">No matches found</div>
              } @else {
                @for (option of filteredOptions(); track option.value; let idx = $index) {
                  <button
                    type="button"
                    class="custom-select__option"
                    [class.custom-select__option--selected]="option.value === value()"
                    [class.custom-select__option--disabled]="option.disabled"
                    [class.custom-select__option--active]="idx === activeIndex()"
                    [disabled]="option.disabled"
                    role="option"
                    [attr.aria-selected]="option.value === value()"
                    [attr.aria-disabled]="option.disabled ? 'true' : null"
                    (mouseenter)="onOptionHover(idx)"
                    (click)="onSelectOption(option, $event)"
                  >
                    <div class="custom-select__option-content">
                      <span class="custom-select__option-text">{{ option.displayName }}</span>
                      @if (option.badge) {
                        <span
                          class="custom-select__option-badge"
                          [class.custom-select__option-badge--empty]="option.badgeType === 'empty'"
                          [class.custom-select__option-badge--available]="option.badgeType === 'available'"
                        >
                          {{ option.badge }}
                        </span>
                      }
                    </div>

                    @if (option.value === value()) {
                      <svg
                        class="custom-select__check"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    }
                  </button>
                }
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .custom-select {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      width: 100%;
    }

    .custom-select__label {
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--color-text-secondary);
      line-height: 1.25;
    }

    .custom-select__control {
      position: relative;
      width: 100%;
    }

    .custom-select__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      height: 34px;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: 0.875rem;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: border-color 140ms ease, box-shadow 140ms ease, background-color 140ms ease;
    }

    .custom-select__trigger:hover:not(:disabled) {
      border-color: color-mix(in srgb, var(--color-border) 60%, var(--color-accent));
    }

    .custom-select__trigger:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 1px;
      border-color: var(--color-accent);
    }

    .custom-select__trigger--open {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 1px var(--color-accent);
    }

    .custom-select__trigger--error {
      border-color: var(--color-danger-text, #ef4444);
    }

    .custom-select__trigger:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      background: var(--color-surface-secondary);
    }

    .custom-select__display {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .custom-select__display--placeholder {
      color: var(--color-text-secondary);
      opacity: 0.75;
    }

    .custom-select__chevron {
      flex-shrink: 0;
      color: var(--color-text-secondary);
      transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    .custom-select__chevron--open {
      transform: rotate(180deg);
      color: var(--color-accent);
    }

    .custom-select__error {
      display: block;
      font-size: 0.75rem;
      color: var(--color-danger-text, #ef4444);
      margin-top: 0.125rem;
    }

    .custom-select__menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      z-index: 60;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      box-shadow: 0 12px 28px -4px rgba(15, 23, 42, 0.14), 0 4px 10px -2px rgba(15, 23, 42, 0.06);
      animation: customSelectMenuIn 140ms ease-out;
    }

    .custom-select__search-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.625rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      flex-shrink: 0;
    }

    .custom-select__search-icon {
      flex-shrink: 0;
      color: var(--color-text-secondary);
      opacity: 0.7;
    }

    .custom-select__search-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      padding: 0;
      font-size: 0.8125rem;
      color: var(--color-text-primary);
      outline: none;
    }

    .custom-select__search-input::placeholder {
      color: var(--color-text-secondary);
      opacity: 0.65;
    }

    .custom-select__search-clear {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.125rem;
      height: 1.125rem;
      padding: 0;
      border-radius: 9999px;
      border: none;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      cursor: pointer;
      flex-shrink: 0;
      transition: background-color 100ms ease, color 100ms ease;
    }

    .custom-select__search-clear:hover {
      background: var(--color-border);
      color: var(--color-text-primary);
    }

    .custom-select__options-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px;
      max-height: 142px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
    }

    .custom-select__options-list::-webkit-scrollbar {
      width: 5px;
    }

    .custom-select__options-list::-webkit-scrollbar-button {
      display: none;
      width: 0;
      height: 0;
    }

    .custom-select__options-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .custom-select__options-list::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.35);
      border-radius: 9999px;
    }

    .custom-select__options-list::-webkit-scrollbar-thumb:hover {
      background: rgba(148, 163, 184, 0.6);
    }

    .custom-select__empty {
      padding: 0.75rem 0.875rem;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      text-align: center;
    }

    .custom-select__option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      height: 32px;
      min-height: 32px;
      box-sizing: border-box;
      padding: 0 0.625rem;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: var(--color-text-primary);
      font-size: 0.8125rem;
      text-align: left;
      cursor: pointer;
      user-select: none;
      transition: background-color 100ms ease, color 100ms ease;
    }

    .custom-select__option:hover:not(:disabled),
    .custom-select__option--active:not(:disabled) {
      background: var(--color-surface-secondary);
    }

    .custom-select__option--selected {
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)) !important;
      color: var(--color-accent) !important;
      font-weight: 600;
    }

    .custom-select__option--disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .custom-select__option-content {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      flex: 1;
    }

    .custom-select__option-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .custom-select__option-badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.6875rem;
      font-weight: 500;
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      line-height: 1.2;
      flex-shrink: 0;
    }

    .custom-select__option-badge--empty {
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }

    .custom-select__option-badge--available {
      background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
      color: var(--color-accent);
      border: 1px solid color-mix(in srgb, var(--color-accent) 25%, var(--color-surface));
    }

    .custom-select__check {
      flex-shrink: 0;
      color: var(--color-accent);
    }

    @keyframes customSelectMenuIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomSelectComponent {
  label = input<string>('');
  placeholder = input<string>('Select an option');
  searchable = input(true);
  searchPlaceholder = input<string>('Search...');
  options = input<readonly SelectOption[]>([]);
  value = input<string | null | undefined>('');
  disabled = input(false);
  error = input<string>('');

  valueChange = output<string>();

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerBtn') triggerBtnRef?: ElementRef<HTMLButtonElement>;

  readonly isOpen = signal(false);
  readonly activeIndex = signal(-1);
  readonly searchQuery = signal('');

  readonly selectId = nextUniqueId('app-custom-select');
  readonly labelId = `${this.selectId}-label`;
  readonly errorId = computed(() => `${this.selectId}-error`);

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly selectedOption = computed(() => {
    const val = this.value();
    if (!val) return null;
    return this.options().find((opt) => opt.value === val) ?? null;
  });

  readonly parsedOptions = computed(() => {
    return this.options().map((opt) => {
      let displayName = opt.label;
      let badge: string | null = null;
      let badgeType: 'empty' | 'available' | null = null;

      if (opt.label.includes('[No vacancy]')) {
        displayName = opt.label.replace('[No vacancy]', '').trim();
        badge = 'No vacancy';
        badgeType = 'empty';
      } else {
        const match = opt.label.match(/\[(\d+)\]/);
        if (match) {
          displayName = opt.label.replace(match[0], '').trim();
          badge = `${match[1]} open`;
          badgeType = 'available';
        }
      }

      return {
        ...opt,
        displayName,
        badge,
        badgeType
      };
    });
  });

  readonly filteredOptions = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const parsed = this.parsedOptions();
    if (!query) return parsed;
    return parsed.filter(
      (opt) =>
        opt.displayName.toLowerCase().includes(query) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  });

  toggleOpen(event: MouseEvent): void {
    if (this.disabled()) return;
    event.stopPropagation();
    const nextOpen = !this.isOpen();
    this.isOpen.set(nextOpen);
    if (nextOpen) {
      this.searchQuery.set('');
      const idx = this.parsedOptions().findIndex((opt) => opt.value === this.value());
      this.activeIndex.set(idx >= 0 ? idx : 0);
      if (this.searchable()) {
        setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 0);
      }
    } else {
      this.close();
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.searchQuery.set('');
    this.activeIndex.set(-1);
  }

  onSelectOption(option: SelectOption, event?: Event): void {
    if (option.disabled) return;
    event?.stopPropagation();
    this.valueChange.emit(option.value);
    this.close();
    this.triggerBtnRef?.nativeElement?.focus();
  }

  onOptionHover(index: number): void {
    this.activeIndex.set(index);
  }

  onSearchInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.searchQuery.set(inputEl.value);
    this.activeIndex.set(0);
  }

  clearSearch(event?: Event): void {
    event?.stopPropagation();
    this.searchQuery.set('');
    this.activeIndex.set(0);
    this.searchInputRef?.nativeElement?.focus();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (opts.length > 0) {
        const next = (this.activeIndex() + 1) % opts.length;
        this.activeIndex.set(next);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (opts.length > 0) {
        const prev = (this.activeIndex() - 1 + opts.length) % opts.length;
        this.activeIndex.set(prev);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const active = opts[this.activeIndex()];
      if (active && !active.disabled) {
        this.onSelectOption(active);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.triggerBtnRef?.nativeElement?.focus();
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isOpen()) {
        this.isOpen.set(true);
        this.searchQuery.set('');
        const idx = this.parsedOptions().findIndex((opt) => opt.value === this.value());
        this.activeIndex.set(idx >= 0 ? idx : 0);
        if (this.searchable()) {
          setTimeout(() => this.searchInputRef?.nativeElement?.focus(), 0);
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        const active = this.filteredOptions()[this.activeIndex()];
        if (active && !active.disabled) {
          this.onSelectOption(active);
        }
      }
    } else if (event.key === 'Escape') {
      this.close();
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    const opts = this.filteredOptions();
    if (opts.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (this.activeIndex() + 1) % opts.length;
      this.activeIndex.set(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (this.activeIndex() - 1 + opts.length) % opts.length;
      this.activeIndex.set(prev);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const active = opts[this.activeIndex()];
      if (active && !active.disabled) {
        this.onSelectOption(active);
      }
    } else if (event.key === 'Escape') {
      this.close();
      this.triggerBtnRef?.nativeElement?.focus();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}

