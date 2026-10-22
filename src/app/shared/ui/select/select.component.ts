import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { nextUniqueId } from '../../utils/unique-id';
import { FieldIcon, FieldIconComponent } from '../field-icon/field-icon.component';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/** Kept for existing callers; any field icon works. */
export type SelectIcon = FieldIcon;

/** Below the trigger first, flipping above when there isn't room. */
const MENU_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 }
];

interface DisplayOption extends SelectOption {
  /** Label with any "[No vacancy]" / "[3]" marker stripped (only when `vacancyBadges`). */
  readonly text: string;
  readonly badge: string | null;
  readonly badgeType: 'empty' | 'available' | null;
}

/**
 * The app's one single-select dropdown. Stable hooks for host restyling via ::ng-deep:
 * .app-select, .app-select__label, .app-select__control, .app-select__trigger, .app-select__value. The trigger looks like our text inputs; the open list is
 * our own themed panel (a native <select>'s list can't be styled), rendered in the CDK overlay so a
 * scrolling parent such as a modal body can never clip it. The panel has a search box (turn it off
 * with [searchable]="false") and is as wide as the field; `panelAnchor` widens it to a host's frame.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [OverlayModule, FieldIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Fill the container, even when a host lays it out as a flex item, so the chevron sits at the field's end.
  host: { class: 'block min-w-0' },
  template: `
    <div class="app-select flex w-full min-w-0 flex-col gap-1.5">
      @if (label()) {
        <label [for]="selectId" class="app-select__label ui-field-label">{{ label() }}</label>
      }
      <div
        class="app-select__control ui-field"
        [class.ui-field--sm]="size() === 'sm'"
        [class.ui-field--error]="!!error()"
        [class.ui-field--success]="success() && !error()"
        [class.ui-field--disabled]="disabled()"
        cdkOverlayOrigin
        #origin="cdkOverlayOrigin"
      >
        @if (icon(); as iconName) {
          <span data-testid="select-leading-icon" class="ui-field__addon" aria-hidden="true"><app-field-icon [name]="iconName" /></span>
        }
        <button
          #trigger
          type="button"
          [id]="selectId"
          data-testid="select-trigger"
          class="app-select__trigger ui-field__control flex items-center justify-between gap-2 cursor-pointer disabled:cursor-not-allowed"
          [disabled]="disabled()"
          aria-haspopup="listbox"
          [attr.aria-expanded]="open()"
          [attr.aria-label]="ariaLabel() || null"
          [attr.aria-invalid]="error() ? true : null"
          [attr.aria-describedby]="error() ? errorId : null"
          (click)="toggle()"
          (keydown)="onTriggerKeydown($event)"
        >
          <span class="app-select__value truncate" [class.text-[var(--color-text-secondary)]]="!selectedOption()">{{ selectedOption()?.text || placeholder() }}</span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
               class="shrink-0 text-[var(--color-text-secondary)] transition-transform"
               [style.transform]="open() ? 'rotate(180deg)' : null">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      @if (error()) {
        <span [id]="errorId" class="ui-field-error">{{ error() }}</span>
      }
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="panelAnchor() ?? origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="menuPositions"
      [cdkConnectedOverlayWidth]="menuWidth()"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onOverlayKeydown($event)"
    >
      <div
        #panel
        data-testid="select-panel"
        class="flex w-full min-w-[14rem] flex-col rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
      >
        @if (showSearch()) {
          <div class="flex items-center gap-1.5 border-b border-[var(--color-border)] px-2.5 py-1.5">
            <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 shrink-0 fill-none stroke-[var(--color-text-secondary)]" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              autocomplete="off"
              data-testid="select-search"
              class="w-full border-0 bg-transparent py-0.5 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]"
              [placeholder]="searchPlaceholder()"
              aria-label="Search options"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              (keydown)="onSearchKeydown($event)"
            />
          </div>
        }
        <ul role="listbox" class="flex max-h-64 flex-col gap-0.5 overflow-y-auto p-1 scroll-fade" [attr.aria-labelledby]="label() ? selectId : null">
          @for (option of filteredOptions(); track option.value) {
            <li role="none">
              <button
                type="button"
                role="option"
                data-testid="select-option"
                [attr.aria-selected]="option.value === currentValue()"
                [disabled]="option.disabled || false"
                class="flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] focus-visible:bg-[var(--color-surface-secondary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                [class.bg-[var(--color-accent-subtle)]]="option.value === currentValue()"
                [class.font-medium]="option.value === currentValue()"
                (click)="select(option)"
                (keydown)="onOptionKeydown($event)"
              >
                <span class="truncate">{{ option.text }}</span>
                @if (option.badge) {
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
                    [class.bg-[var(--color-surface-secondary)]]="option.badgeType === 'empty'"
                    [class.text-[var(--color-text-secondary)]]="option.badgeType === 'empty'"
                    [class.bg-[var(--color-accent-subtle)]]="option.badgeType === 'available'"
                    [class.text-[var(--color-accent)]]="option.badgeType === 'available'"
                  >{{ option.badge }}</span>
                }
              </button>
            </li>
          } @empty {
            <li class="px-2.5 py-2 text-xs text-[var(--color-text-secondary)]">{{ options().length ? 'No matches' : 'No options' }}</li>
          }
        </ul>
      </div>
    </ng-template>
  `
})
export class SelectComponent {
  label = input<string>('');
  placeholder = input<string>('Select…');
  options = input<readonly SelectOption[]>([]);
  disabled = input(false);
  value = input<string | null | undefined>('');
  error = input<string>('');
  ariaLabel = input<string>('');
  icon = input<FieldIcon | undefined>(undefined);
  size = input<'md' | 'sm'>('md');
  success = input(false);
  /** The search box at the top of the open list; on by default, like the Time zone dropdown. */
  searchable = input(true);
  searchPlaceholder = input<string>('Search…');
  /** Shows "[No vacancy]" / "[3]" label markers as badges (position pickers). */
  vacancyBadges = input(false);
  /** Element the open list aligns to and matches in width - e.g. a host frame that wraps an icon
   * plus this select. Defaults to the select's own field. */
  panelAnchor = input<HTMLElement | null>(null);

  valueChange = output<string>();
  /** Fires whenever the open list closes - by picking, Escape, or a click outside. */
  closed = output<void>();

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  readonly selectId = nextUniqueId('app-select');
  readonly errorId = `${this.selectId}-error`;
  readonly menuPositions = MENU_POSITIONS;
  readonly open = signal(false);
  readonly query = signal('');
  /** Trigger width captured on open so the list lines up with the field. */
  readonly menuWidth = signal<number | string>('auto');

  readonly currentValue = computed(() => this.value() ?? '');

  readonly displayOptions = computed<readonly DisplayOption[]>(() =>
    this.options().map((option) => (this.vacancyBadges() ? withVacancyBadge(option) : { ...option, text: option.label, badge: null, badgeType: null }))
  );

  readonly selectedOption = computed(() => this.displayOptions().find((o) => o.value === this.currentValue()) ?? null);

  readonly showSearch = computed(() => this.searchable() && this.options().length > 0);

  readonly filteredOptions = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.displayOptions();
    return this.displayOptions().filter(
      (o) => o.text.toLowerCase().includes(q) || (o.badge?.toLowerCase().includes(q) ?? false)
    );
  });

  toggle(): void {
    if (this.open()) this.close();
    else this.openPanel();
  }

  /** Opens the list with the current value in view. */
  openPanel(): void {
    if (this.disabled()) return;
    const anchor = this.panelAnchor() ?? this.trigger()?.nativeElement.parentElement;
    const width = anchor?.getBoundingClientRect().width ?? 0;
    this.menuWidth.set(width > 0 ? width : 'auto');
    this.query.set('');
    this.open.set(true);
    // let the overlay render first
    setTimeout(() => {
      const index = this.currentIndex();
      this.optionButtons()[index]?.scrollIntoView?.({ block: 'nearest' });
      if (this.showSearch()) this.searchInput()?.focus();
      else this.optionButtons()[index]?.focus();
    }, 0);
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
  }

  select(option: SelectOption): void {
    if (option.disabled) return;
    this.valueChange.emit(option.value);
    this.close();
    this.trigger()?.nativeElement.focus();
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.open()) this.openPanel();
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusOption(0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const first = this.filteredOptions().find((o) => !o.disabled);
      if (first) this.select(first);
    }
  }

  onOptionKeydown(event: KeyboardEvent): void {
    const options = this.optionButtons();
    const idx = options.indexOf(event.target as HTMLButtonElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusOption(Math.min(idx + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (idx > 0) this.focusOption(idx - 1);
      else if (this.showSearch()) this.searchInput()?.focus();
    }
  }

  /** Escape closes just this list - stopped here so a surrounding modal's own Escape doesn't close too. */
  onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      this.close();
      this.trigger()?.nativeElement.focus();
    }
  }

  private currentIndex(): number {
    const i = this.filteredOptions().findIndex((o) => o.value === this.currentValue());
    return i < 0 ? 0 : i;
  }

  private searchInput(): HTMLInputElement | null {
    return this.panel()?.nativeElement.querySelector('[data-testid="select-search"]') ?? null;
  }

  private optionButtons(): HTMLButtonElement[] {
    return Array.from(this.panel()?.nativeElement.querySelectorAll<HTMLButtonElement>('[data-testid="select-option"]') ?? []);
  }

  private focusOption(index: number): void {
    this.optionButtons()[index]?.focus();
  }
}

function withVacancyBadge(option: SelectOption): DisplayOption {
  if (option.label.includes('[No vacancy]')) {
    return { ...option, text: option.label.replace('[No vacancy]', '').trim(), badge: 'No vacancy', badgeType: 'empty' };
  }
  const match = /\[(\d+)\]/.exec(option.label);
  if (match) {
    return { ...option, text: option.label.replace(match[0], '').trim(), badge: `${match[1]} open`, badgeType: 'available' };
  }
  return { ...option, text: option.label, badge: null, badgeType: null };
}
