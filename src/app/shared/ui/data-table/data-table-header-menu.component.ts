import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, HostListener, inject, input, output, signal } from '@angular/core';

export interface DataTableFilterOption { readonly value: string; readonly label: string; }

/** A column's header filter. It mirrors one field of the page's own filter bar - the page owns the values. */
export interface DataTableColumnFilter {
  readonly kind: 'single' | 'multi';
  readonly options: readonly DataTableFilterOption[];
  /** Shown instead of the list while options are loading or when a prerequisite is missing. */
  readonly hint?: string | null;
}

export type DataTableSortState = 'asc' | 'desc' | null;

/**
 * Header cell menu (ClickUp style): the header label is a button; clicking it opens Sort ascending /
 * Sort descending and, when the column has a filter, a searchable option list that applies on each click.
 * The panel is position:fixed so the table's sideways-scroll container can't clip it.
 */
@Component({
  selector: 'app-data-table-header-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dthm' },
  template: `
    <button type="button" class="dthm__trigger" [class.dthm__trigger--active]="sortState() || filterCount() > 0"
      [attr.data-testid]="testId()" [attr.aria-expanded]="open()" aria-haspopup="menu" (click)="toggle()">
      <span class="dthm__label">{{ label() }}</span>
      @if (filterCount() > 0) {
        <svg class="dthm__funnel" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" /></svg>
        <span class="dthm__sr">, filtered</span>
      }
      @if (sortable()) {
        <svg class="dthm__sort" [class.dthm__sort--on]="sortState()" viewBox="0 0 24 24" aria-hidden="true">
          @if (sortState() === 'desc') { <path d="M8 10l4 4 4-4" /> }
          @else if (sortState() === 'asc') { <path d="M8 14l4-4 4 4" /> }
          @else { <path d="M8 9l4-4 4 4M8 15l4 4 4-4" /> }
        </svg>
      }
    </button>

    @if (open()) {
      <div class="dthm__panel" role="menu" [attr.aria-label]="label() + ' options'"
        [style.top.px]="pos().top" [style.left.px]="pos().left">
        @if (sortable()) {
          <button type="button" role="menuitemradio" class="dthm__item" data-testid="header-sort-asc"
            [attr.aria-checked]="sortState() === 'asc'" (click)="chooseSort('asc')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
            Sort ascending
            @if (sortState() === 'asc') { <span class="dthm__tick" aria-hidden="true">✓</span> }
          </button>
          <button type="button" role="menuitemradio" class="dthm__item" data-testid="header-sort-desc"
            [attr.aria-checked]="sortState() === 'desc'" (click)="chooseSort('desc')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            Sort descending
            @if (sortState() === 'desc') { <span class="dthm__tick" aria-hidden="true">✓</span> }
          </button>
        }

        @if (filter(); as f) {
          <div class="dthm__filter" [class.dthm__filter--split]="sortable()">
            <div class="dthm__filter-head">
              <span>Filter</span>
              @if (filterCount() > 0) {
                <button type="button" class="dthm__clear" data-testid="header-filter-clear" (click)="clearFilter()">Clear</button>
              }
            </div>
            @if (f.hint) {
              <p class="dthm__hint">{{ f.hint }}</p>
            } @else {
              @if (f.options.length > 6) {
                <input class="dthm__search" type="search" placeholder="Search…" [attr.aria-label]="'Search ' + label()"
                  data-testid="header-filter-search" [value]="search()" (input)="search.set($any($event.target).value)" />
              }
              <div class="dthm__options">
                @for (option of visibleOptions(); track option.value) {
                  <button type="button" class="dthm__item dthm__option"
                    [attr.role]="f.kind === 'multi' ? 'menuitemcheckbox' : 'menuitemradio'"
                    [attr.aria-checked]="isSelected(option.value)"
                    [attr.data-testid]="'header-filter-option-' + option.value"
                    (click)="toggleOption(option.value)">
                    <span class="dthm__check" [class.dthm__check--radio]="f.kind === 'single'" [class.dthm__check--on]="isSelected(option.value)" aria-hidden="true"></span>
                    <span class="dthm__option-label">{{ option.label }}</span>
                  </button>
                } @empty {
                  <p class="dthm__hint">{{ search() ? 'No matches' : 'No options' }}</p>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [`
    /* Keep the label's full width so auto-layout columns size to it (fixed-layout tables still clip at the th). */
    :host { display: inline-flex; }
    .dthm__trigger { display: inline-flex; align-items: center; gap: 4px; margin: 0 -6px; padding: 3px 6px; border: 0; border-radius: 5px;
      background: none; color: inherit; font: inherit; letter-spacing: inherit; cursor: pointer; transition: background-color 120ms ease, color 120ms ease; }
    .dthm__trigger:hover, .dthm__trigger[aria-expanded="true"] { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); color: var(--color-text-primary); }
    .dthm__trigger:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
    .dthm__trigger--active { color: var(--color-accent); }
    .dthm__label { white-space: nowrap; }
    .dthm__sort, .dthm__funnel { width: 13px; height: 13px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .dthm__sort { opacity: .5; }
    .dthm__sort--on { opacity: 1; }
    .dthm__funnel { width: 12px; height: 12px; }
    .dthm__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    .dthm__panel { position: fixed; z-index: 60; display: flex; flex-direction: column; width: 230px; max-height: min(380px, calc(100vh - 24px)); padding: 6px;
      border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface-raised); box-shadow: var(--shadow-popover);
      color: var(--color-text-primary); font-size: 13px; font-weight: 400; text-align: left; white-space: normal; letter-spacing: normal; text-transform: none;
      animation: dthm-in 140ms var(--ease-out, ease-out); }
    @keyframes dthm-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .dthm__panel { animation: none; } }
    .dthm__item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; background: none; color: inherit;
      font: inherit; text-align: left; cursor: pointer; }
    .dthm__item:hover, .dthm__item:focus-visible { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); outline: none; }
    .dthm__item svg { width: 15px; height: 15px; flex-shrink: 0; fill: none; stroke: var(--color-text-secondary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .dthm__tick { margin-left: auto; color: var(--color-accent); }
    .dthm__filter { display: flex; min-height: 0; flex-direction: column; }
    .dthm__filter--split { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--color-border); }
    .dthm__filter-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; color: var(--color-text-secondary); font-size: 12px; }
    .dthm__clear { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; cursor: pointer; }
    .dthm__search { margin: 2px 4px 4px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; color: var(--color-text-primary); font: inherit; outline: none; }
    .dthm__search:focus { border-color: var(--color-accent); }
    .dthm__options { min-height: 0; overflow-y: auto; }
    .dthm__option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dthm__check { position: relative; width: 14px; height: 14px; flex-shrink: 0; border: 1.5px solid color-mix(in srgb, var(--color-text-primary) 35%, transparent); border-radius: 4px; }
    .dthm__check--radio { border-radius: 50%; }
    .dthm__check--on { border-color: var(--color-accent); background: var(--color-accent); }
    .dthm__check--on::after { content: ''; position: absolute; left: 3.5px; top: 0.5px; width: 4px; height: 8px; border: solid var(--color-text-inverse); border-width: 0 2px 2px 0; transform: rotate(45deg); }
    .dthm__check--radio.dthm__check--on::after { left: 3px; top: 3px; width: 5px; height: 5px; border: 0; border-radius: 50%; background: var(--color-text-inverse); transform: none; }
    .dthm__hint { margin: 0; padding: 6px 8px; color: var(--color-text-secondary); font-size: 12px; }
  `]
})
export class DataTableHeaderMenuComponent {
  readonly label = input.required<string>();
  readonly sortable = input(false);
  readonly sortState = input<DataTableSortState>(null);
  readonly filter = input<DataTableColumnFilter | null>(null);
  readonly filterValues = input<readonly string[]>([]);
  readonly testId = input<string | null>(null);

  readonly sortChosen = output<'asc' | 'desc'>();
  readonly filterChanged = output<string[]>();
  /** Fires when the menu opens on a filterable column - lets the page load options lazily. */
  readonly opened = output<void>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  protected readonly pos = signal({ top: 0, left: 0 });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly filterCount = computed(() => this.filterValues().length);
  protected readonly visibleOptions = computed(() => {
    const term = this.search().trim().toLowerCase();
    const options = this.filter()?.options ?? [];
    return term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
  });

  protected toggle(): void {
    if (this.open()) { this.close(); return; }
    const rect = this.host.nativeElement.getBoundingClientRect();
    const width = 230;
    this.pos.set({ top: Math.round(rect.bottom + 6), left: Math.round(Math.max(8, Math.min(rect.left - 6, window.innerWidth - width - 8))) });
    this.search.set('');
    this.open.set(true);
    if (this.filter()) this.opened.emit();
  }

  protected close(): void {
    this.open.set(false);
  }

  protected chooseSort(dir: 'asc' | 'desc'): void {
    this.close();
    if (this.sortState() !== dir) this.sortChosen.emit(dir);
  }

  protected isSelected(value: string): boolean {
    return this.filterValues().includes(value);
  }

  protected toggleOption(value: string): void {
    const f = this.filter();
    if (!f) return;
    if (f.kind === 'single') {
      this.filterChanged.emit(this.isSelected(value) ? [] : [value]);
      this.close();
      return;
    }
    const current = this.filterValues();
    this.filterChanged.emit(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  protected clearFilter(): void {
    this.filterChanged.emit([]);
    this.close();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.close();
  }

  @HostListener('window:resize')
  protected onResize(): void {
    if (this.open()) this.close();
  }

  // A fixed panel would drift from its header when the page or the table scrolls - close it instead.
  // Scroll doesn't bubble, so listen in the capture phase while open; scrolling the option list itself is fine.
  private readonly onAnyScroll = (event: Event): void => {
    const panel = this.host.nativeElement.querySelector('.dthm__panel');
    if (panel && event.target instanceof Node && panel.contains(event.target)) return;
    this.close();
  };

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) return;
      document.addEventListener('scroll', this.onAnyScroll, true);
      onCleanup(() => document.removeEventListener('scroll', this.onAnyScroll, true));
    });
  }
}
