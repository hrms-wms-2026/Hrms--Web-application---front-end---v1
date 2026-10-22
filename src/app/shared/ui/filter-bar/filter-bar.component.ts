import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { WorkDropdownComponent, WorkDropdownOption } from '../../../modules/work/ui/work-dropdown/work-dropdown.component';

export type FilterFieldIcon = 'module' | 'status' | 'category' | 'sprint' | 'people' | 'priority' | 'calendar' | 'department' | 'position' | 'type';

export interface FilterFieldConfig {
  key: string;
  label: string;
  icon: FilterFieldIcon;
  kind: 'multi' | 'single';
  options: readonly WorkDropdownOption[];
  /** Value considered "not filtering" for this field - what a removed/cleared row resets to. Defaults to []. */
  defaultValues?: readonly string[];
}

/** Preset highlight colors - mid-saturation so a translucent tint reads in both light and dark themes. */
export const HIGHLIGHT_SWATCHES: readonly string[] = [
  '#f59e0b', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444'
];

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * ClickUp-style filter bar: a single "Filter" trigger opens a panel where fields are added
 * on demand (search + pick a field) rather than showing one dropdown pill per field at all times.
 */
@Component({
  // `app-task-filter-bar` is a legacy alias kept only for the People module's employee filter
  // popover (teammate-owned; imports via modules/work/ui/task-filter-bar). New code uses app-filter-bar.
  selector: 'app-filter-bar, app-task-filter-bar',
  standalone: true,
  imports: [WorkDropdownComponent],
  template: `
    <div class="tfb" (click)="$event.stopPropagation()">
      <div class="tfb__trigger" [class.tfb__trigger--active]="activeCount() > 0">
        <button
          type="button"
          class="tfb__trigger-btn"
          data-testid="filter-trigger"
          [attr.aria-expanded]="open()"
          (click)="toggleOpen()"
        >
          @if (highlightColor(); as color) {
            <span class="tfb__color-dot" data-testid="highlight-color-dot" [style.background]="color" aria-hidden="true"></span>
            <span>Highlight</span>
          } @else {
            <svg class="tfb__trigger-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
            <span>Filter</span>
          }
        </button>
        @if (activeCount() > 0) {
          <button
            type="button"
            class="tfb__badge"
            data-testid="filter-badge"
            [attr.aria-label]="'Clear all filters (' + activeCount() + ' active)'"
            (click)="clearAll()"
          >
            <span class="tfb__badge-count" data-testid="filter-count">{{ activeCount() }}</span>
            <svg class="tfb__badge-clear" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        }
      </div>

      @if (open()) {
        <div class="tfb__panel" [class.tfb__panel--left]="panelAlign() === 'left'" role="dialog" aria-label="Filters">
          <div class="tfb__panel-head">
            <span>Filters</span>
            @if (activeRows().length > 0) {
              <button type="button" class="tfb__clear-all" data-testid="filter-reset" (click)="clearAll()">Clear all</button>
            }
          </div>

          @if (hint()) {
            <p class="tfb__hint" [attr.data-testid]="hintTestId()">{{ hint() }}</p>
          }

          @if (highlightColor(); as current) {
            <div class="tfb__color-row" data-testid="highlight-color-row">
              <span class="tfb__row-label">Color</span>
              <div class="tfb__swatches" role="group" aria-label="Highlight color">
                @for (swatch of swatches; track swatch) {
                  <button
                    type="button"
                    class="tfb__swatch"
                    data-testid="highlight-swatch"
                    [style.background]="swatch"
                    [attr.aria-label]="'Highlight color ' + swatch"
                    [attr.aria-pressed]="swatch === current"
                    (click)="highlightColorChanged.emit(swatch)"
                  ></button>
                }
                <label class="tfb__swatch tfb__swatch--custom" title="Custom color">
                  <input
                    type="color"
                    data-testid="highlight-custom-color"
                    aria-label="Custom highlight color"
                    [value]="current"
                    (input)="highlightColorChanged.emit($any($event.target).value)"
                  />
                </label>
              </div>
            </div>
          }

          @for (field of activeRows(); track field.key) {
            <div class="tfb__row" [attr.data-testid]="'filter-row-' + field.key">
              <span class="tfb__row-icon">
                @switch (field.icon) {
                  @case ('module') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
                  @case ('status') { <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg> }
                  @case ('category') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg> }
                  @case ('sprint') { <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> }
                  @case ('people') { <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M15 7a3 3 0 0 1 0 6M20 20c0-2.5-1.7-4.3-4-4.8" /></svg> }
                  @case ('priority') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18" /><path d="M5 4h11l-3 4 3 4H5" /></svg> }
                  @case ('calendar') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg> }
                  @case ('department') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg> }
                  @case ('position') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> }
                  @case ('type') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> }
                }
              </span>
              <span class="tfb__row-label">{{ field.label }}</span>
              <app-work-dropdown
                class="tfb__row-value"
                [options]="field.options"
                [multiple]="field.kind === 'multi'"
                [values]="values()[field.key] ?? []"
                [selected]="singleValue(field)"
                [allLabel]="'All ' + field.label.toLowerCase()"
                [placeholder]="'Select ' + field.label.toLowerCase()"
                size="sm"
                [accessibleLabel]="field.label"
                (valuesChanged)="setValue(field.key, $event)"
                (selectionChanged)="setValue(field.key, [$event])"
              />
              <button type="button" class="tfb__row-remove" [attr.data-testid]="'filter-remove-' + field.key" [attr.aria-label]="'Remove ' + field.label + ' filter'" (click)="removeField(field.key)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.8 12.1a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 7" /></svg>
              </button>
            </div>
          }

          @if (pickerOpen() || activeRows().length === 0) {
            <div class="tfb__picker">
              <div class="tfb__picker-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                <input
                  type="text"
                  placeholder="Search filters…"
                  data-testid="filter-search-input"
                  [value]="search()"
                  (input)="search.set($any($event.target).value)"
                />
              </div>
              <div class="tfb__picker-list scroll-fade">
                @for (field of availableFields(); track field.key) {
                  <button type="button" class="tfb__picker-item" [attr.data-testid]="'filter-picker-' + field.key" (click)="addField(field.key)">
                    <span class="tfb__row-icon">
                      @switch (field.icon) {
                        @case ('module') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
                        @case ('status') { <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg> }
                        @case ('category') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg> }
                        @case ('sprint') { <svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> }
                        @case ('people') { <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M15 7a3 3 0 0 1 0 6M20 20c0-2.5-1.7-4.3-4-4.8" /></svg> }
                        @case ('priority') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18" /><path d="M5 4h11l-3 4 3 4H5" /></svg> }
                        @case ('calendar') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg> }
                        @case ('department') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg> }
                        @case ('position') { <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> }
                        @case ('type') { <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> }
                      }
                    </span>
                    <span>{{ field.label }}</span>
                  </button>
                } @empty {
                  <p class="tfb__picker-empty">No matching filters</p>
                }
              </div>
            </div>
          } @else {
            <button type="button" class="tfb__add-btn" data-testid="filter-add-btn" (click)="pickerOpen.set(true)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Add filter
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tfb { position: relative; display: inline-block; }
    .tfb__trigger { display: inline-flex; align-items: stretch; height: 30px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); transition: border-color 140ms ease; overflow: hidden; }
    .tfb__trigger:hover { border-color: var(--color-accent); }
    .tfb__trigger--active { border-color: var(--color-accent); color: var(--color-accent); }
    .tfb__trigger-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; font-weight: 500; padding: 0 10px; cursor: pointer; }
    .tfb__trigger-icon { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__badge { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 26px; flex: 0 0 auto; border: 0; border-left: 1px solid var(--color-border); background: transparent; color: var(--color-accent); cursor: pointer; }
    .tfb__badge-count { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--color-accent); color: var(--color-accent-contrast); font-size: 10px; font-weight: 700; }
    .tfb__badge-clear { display: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__badge:hover { background: var(--color-danger-subtle); color: var(--color-danger-text, var(--color-danger)); }
    .tfb__badge:hover .tfb__badge-count { display: none; }
    .tfb__badge:hover .tfb__badge-clear { display: inline-flex; }
    .tfb__panel { position: absolute; top: calc(100% + 7px); right: 0; z-index: 80; width: 360px; max-width: 90vw; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 16px 36px rgb(15 23 42 / .18); padding: 12px; animation: tfb-panel-in 130ms ease-out; }
    .tfb__panel--left { right: auto; left: 0; }
    .tfb__hint { margin: 0 0 10px; font-size: 12px; line-height: 1.4; color: var(--color-text-secondary); }
    .tfb__color-dot { width: 12px; height: 12px; border-radius: 999px; box-shadow: 0 0 0 1px rgb(15 23 42 / .15); }
    .tfb__color-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); }
    .tfb__swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .tfb__swatch { position: relative; width: 20px; height: 20px; flex: 0 0 auto; border: 0; border-radius: 999px; padding: 0; cursor: pointer; box-shadow: 0 0 0 1px rgb(15 23 42 / .12); }
    .tfb__swatch[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--color-text-primary); }
    .tfb__swatch--custom { overflow: hidden; background: conic-gradient(#ef4444, #f59e0b, #22c55e, #3b82f6, #8b5cf6, #ef4444); }
    .tfb__swatch--custom input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
    .tfb__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
    .tfb__clear-all { border: 0; background: transparent; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .tfb__clear-all:hover { text-decoration: underline; }
    .tfb__row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .tfb__row-icon { display: inline-flex; width: 16px; height: 16px; flex: 0 0 auto; color: var(--color-text-secondary); }
    .tfb__row-icon svg { width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__row-label { flex: 0 0 auto; min-width: 62px; max-width: 125px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); }
    .tfb__row-value { flex: 1; min-width: 0; }
    .tfb__row-remove { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: 0 0 auto; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .tfb__row-remove:hover { background: var(--color-danger-subtle); color: var(--color-danger-text, var(--color-danger)); }
    .tfb__row-remove svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__add-btn { display: flex; width: 100%; align-items: center; justify-content: center; gap: 6px; height: 32px; border: 1px dashed var(--color-border); border-radius: 8px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
    .tfb__add-btn:hover { border-color: var(--color-accent); color: var(--color-accent); }
    .tfb__add-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__picker { border-top: 1px solid var(--color-border); margin-top: 4px; padding-top: 10px; }
    .tfb__picker-search { display: flex; align-items: center; gap: 6px; height: 32px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 9px; margin-bottom: 6px; }
    .tfb__picker-search svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tfb__picker-search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .tfb__picker-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .tfb__picker-item { display: flex; align-items: center; gap: 9px; width: 100%; min-height: 34px; border: 0; border-radius: 7px; padding: 6px 8px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; }
    .tfb__picker-item:hover { background: var(--color-surface-secondary); }
    .tfb__picker-empty { margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12.5px; text-align: center; }
    @keyframes tfb-panel-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .tfb__panel { animation: none; } }
  `]
})
export class FilterBarComponent {
  fields = input.required<readonly FilterFieldConfig[]>();
  values = input<Record<string, readonly string[] | undefined>>({});
  /** Opt-in highlight mode (tree tab): non-null shows a color picker row and relabels the trigger. */
  highlightColor = input<string | null>(null);
  panelAlign = input<'left' | 'right'>('right');
  hint = input<string | null>(null);
  hintTestId = input<string>('filter-hint');
  emitFieldChangedOnClear = input(true);
  fieldChanged = output<{ key: string; values: string[] }>();
  highlightColorChanged = output<string>();
  panelOpened = output<void>();
  allCleared = output<void>();

  protected readonly swatches = HIGHLIGHT_SWATCHES;

  protected readonly open = signal(false);
  protected readonly pickerOpen = signal(false);
  protected readonly search = signal('');
  private readonly addedKeys = signal<ReadonlySet<string>>(new Set());
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly activeRows = computed(() => {
    const added = this.addedKeys();
    const vals = this.values();
    return this.fields().filter((field) => added.has(field.key) || !sameValues(vals[field.key] ?? [], field.defaultValues ?? []));
  });

  protected readonly activeCount = computed(() =>
    this.activeRows().filter((field) => !sameValues(this.values()[field.key] ?? [], field.defaultValues ?? [])).length
  );

  protected readonly availableFields = computed(() => {
    const activeKeys = new Set(this.activeRows().map((f) => f.key));
    const q = this.search().trim().toLowerCase();
    return this.fields().filter((f) => !activeKeys.has(f.key) && (!q || f.label.toLowerCase().includes(q)));
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
      this.pickerOpen.set(false);
    }
  }

  singleValue(field: FilterFieldConfig): string {
    return (this.values()[field.key] ?? [])[0] ?? '';
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
    this.pickerOpen.set(false);
    this.search.set('');
    if (this.open()) {
      this.panelOpened.emit();
    }
  }

  addField(key: string): void {
    this.addedKeys.update((s) => new Set(s).add(key));
    this.pickerOpen.set(false);
    this.search.set('');
  }

  removeField(key: string): void {
    this.addedKeys.update((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
    const field = this.fields().find((f) => f.key === key);
    this.fieldChanged.emit({ key, values: [...(field?.defaultValues ?? [])] });
  }

  setValue(key: string, values: string[]): void {
    this.fieldChanged.emit({ key, values });
  }

  clearAll(): void {
    if (this.emitFieldChangedOnClear()) {
      for (const field of this.activeRows()) {
        this.fieldChanged.emit({ key: field.key, values: [...(field.defaultValues ?? [])] });
      }
    }
    this.addedKeys.set(new Set());
    this.allCleared.emit();
  }
}
