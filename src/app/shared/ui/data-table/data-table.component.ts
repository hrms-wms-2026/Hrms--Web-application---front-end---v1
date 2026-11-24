import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChild, contentChildren, Directive, inject, input, output, signal, TemplateRef } from '@angular/core';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';
import { DataTableColumnFilter, DataTableHeaderMenuComponent } from './data-table-header-menu.component';

export type { DataTableColumnFilter, DataTableFilterOption } from './data-table-header-menu.component';

export interface DataTableColumn {
  key: string;
  label: string;
  /** CSS width for the column, e.g. '28%' or '120px'. When any column sets a width the table uses a fixed layout. */
  width?: string;
  /** Header menu offers Sort ascending/descending and emits sortChanged. Sorting itself stays with the caller. */
  sortable?: boolean;
  /** Header menu also offers this filter (one of the page's own filter-bar fields); emits filterChanged. */
  filter?: DataTableColumnFilter;
  /**
   * In-table filter for pages without a filter bar: the value(s) a row shows in this column. The header menu
   * lists every distinct value in the rows and the table hides non-matching rows itself (only for tables
   * that hold all their rows - never a server-paged one). Typed loosely so any row type's accessor fits.
   */
  filterValue?: (row: never) => string | readonly string[] | null | undefined;
  /** The cell hosts its own controls (buttons, popovers, pickers): clicks don't select the row and content isn't clipped. */
  interactive?: boolean;
  /** Cell content may wrap onto several lines (chips, long text) instead of being ellipsis-truncated. */
  wrap?: boolean;
  /** Content may spill outside the cell (e.g. a hover tooltip) - no ellipsis clipping, row clicks still work. */
  overflowVisible?: boolean;
  /** Column takes only the width its content needs (icon / menu columns in the auto layout). */
  shrink?: boolean;
  align?: 'start' | 'end';
  /** Header text is read by screen readers only (e.g. an actions column). */
  hideLabel?: boolean;
}

export type DataTableSortDir = 'asc' | 'desc';

/** Header filters keyed by column key (each mirrors one of the page's filter-bar fields). */
export type DataTableColumnFilters = Readonly<Partial<Record<string, DataTableColumnFilter>>>;
/** Current header-filter values keyed by column key. */
export type DataTableFilterValues = Readonly<Record<string, readonly string[] | undefined>>;

/** Adds the page's header filters to a table's column config. */
export function withColumnFilters(columns: readonly DataTableColumn[], filters: DataTableColumnFilters): DataTableColumn[] {
  return columns.map((column) => {
    const filter = filters[column.key];
    return filter ? { ...column, filter } : column;
  });
}

export interface DataTableCellContext<T> { $implicit: T; index: number; }
export interface DataTableRowAfterContext<T> { $implicit: T; colspan: number; }

/** `<ng-template appDataTableCell="key" let-row let-i="index">` renders the cell for the column with that key. */
@Directive({ selector: 'ng-template[appDataTableCell]', standalone: true })
export class DataTableCellDirective {
  readonly key = input.required<string>({ alias: 'appDataTableCell' });
  readonly template = inject<TemplateRef<DataTableCellContext<unknown>>>(TemplateRef);
}

/** `<ng-template appDataTableHeader="key">` replaces the header content for that column (e.g. a column-picker button). */
@Directive({ selector: 'ng-template[appDataTableHeader]', standalone: true })
export class DataTableHeaderDirective {
  readonly key = input.required<string>({ alias: 'appDataTableHeader' });
  readonly template = inject<TemplateRef<void>>(TemplateRef);
}

/** `<ng-template appDataTableRowAfter let-row let-colspan="colspan">` renders extra `<tr>`s after each row (e.g. subtasks). */
@Directive({ selector: 'ng-template[appDataTableRowAfter]', standalone: true })
export class DataTableRowAfterDirective {
  readonly template = inject<TemplateRef<DataTableRowAfterContext<unknown>>>(TemplateRef);
}

/**
 * The project's one table: plain white list with faint row dividers (the ClickUp People-list look).
 * Every table in the app renders through this component. Columns are config; each cell is a caller
 * template, so callers keep only their own cell markup and styles.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [StopClickPropagationDirective, NgTemplateOutlet, DataTableHeaderMenuComponent],
  template: `
    @if (loading()) {
      <div class="data-table__loading" data-testid="data-table-loading" aria-busy="true" [attr.aria-label]="loadingLabel()">
        @for (n of skeletonRows; track n) { <span class="data-table__skeleton"></span> }
      </div>
    } @else if (rows().length === 0 && emptyMessage() && !hasActiveFilters() && !hasLocalFilters()) {
      <div class="data-table__empty" data-testid="data-table-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6" /><path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><path d="m9 13 2 2 4-4" /></svg>
        <p class="data-table__empty-title">{{ emptyMessage() }}</p>
        @if (emptyDescription()) { <p>{{ emptyDescription() }}</p> }
      </div>
    } @else {
      <div class="data-table__scroll" [class.data-table__scroll--x]="minWidth() || stickyEndColumn()">
        <table class="data-table" [class.data-table--fixed]="fixedLayout()" [class.data-table--sticky-end]="stickyEndColumn()" [style.min-width]="minWidth()">
          @if (caption()) { <caption class="data-table__sr">{{ caption() }}</caption> }
          @if (fixedLayout()) {
            <colgroup>
              @if (selectable()) { <col class="data-table__col-select" /> }
              @for (col of columns(); track col.key) { <col [style.width]="col.width ?? null" /> }
            </colgroup>
          }
          <thead>
            <tr>
              @if (selectable()) {
                <th class="data-table__select-cell">
                  <input
                    type="checkbox"
                    [attr.data-testid]="selectAllTestId()"
                    [attr.aria-label]="selectAllAriaLabel()"
                    [checked]="allSelected()"
                    [indeterminate]="someSelected()"
                    [disabled]="selectionDisabled()"
                    appStopClickPropagation
                    (change)="selectAllChanged.emit($any($event.target).checked)"
                  />
                </th>
              }
              @for (col of columns(); track col.key) {
                <th
                  scope="col"
                  [class.data-table__cell--end]="col.align === 'end'"
                  [class.data-table__cell--shrink]="col.shrink"
                  [class.data-table__th--custom]="!!headerTemplate(col.key)"
                  [attr.aria-sort]="col.sortable ? ariaSort(col.key) : null"
                >
                  @if (headerTemplate(col.key); as headTpl) {
                    @if (col.hideLabel) { <span class="data-table__sr">{{ col.label }}</span> }
                    <ng-container *ngTemplateOutlet="headTpl" />
                  } @else if (col.hideLabel) {
                    <span class="data-table__sr">{{ col.label }}</span>
                  } @else if (col.sortable || col.filter || col.filterValue) {
                    <app-data-table-header-menu
                      [label]="col.label"
                      [sortable]="!!col.sortable"
                      [sortState]="sortState(col.key)"
                      [filter]="col.filter ?? localFilterFor(col)"
                      [filterValues]="col.filter ? filterValuesFor(col.key) : localFilterValuesFor(col.key)"
                      [testId]="sortTestId()?.(col.key) ?? null"
                      (sortChosen)="sortChanged.emit({ key: col.key, dir: $event })"
                      (filterChanged)="col.filter ? filterChanged.emit({ key: col.key, values: $event }) : setLocalFilter(col.key, $event)"
                      (opened)="col.filter && filterOpened.emit(col.key)"
                    />
                  } @else {
                    {{ col.label }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @if (visibleRows().length === 0 && (emptyMessage() || hasLocalFilters())) {
              <!-- Header filters are active: keep the header so the filter can be changed or cleared from it. -->
              <tr class="data-table__empty-row" data-testid="data-table-empty">
                <td [attr.colspan]="colspan()">
                  @if (rows().length > 0 && hasLocalFilters()) {
                    <span class="data-table__empty-title">No matching rows</span>
                    <span>Change or clear the column filter.</span>
                  } @else {
                    <span class="data-table__empty-title">{{ emptyMessage() }}</span>
                    @if (emptyDescription()) { <span>{{ emptyDescription() }}</span> }
                  }
                </td>
              </tr>
            }
            @for (row of visibleRows(); track trackBy()(row); let i = $index) {
              @let id = trackBy()(row);
              <tr
                class="data-table__row"
                [class]="rowClass()(row)"
                [class.data-table__row--clickable]="rowClickable()"
                [class.data-table__row--active]="isHighlighted(id)"
                [class.data-table__row--active-solid]="isHighlighted(id) && activeRowAppearance() === 'solid'"
                [class.data-table__row--busy]="id === busyRowId()"
                [class.data-table__row--muted]="rowMuted()(row)"
                [attr.data-testid]="rowTestId()?.(row) ?? null"
                [attr.data-id]="id"
                [attr.title]="rowTitle()(row)"
                [attr.tabindex]="rowFocusable() ? 0 : null"
                [attr.aria-selected]="activeRowId() !== null ? id === activeRowId() : null"
                (click)="rowClicked.emit(row)"
                (keydown.enter)="rowFocusable() && $event.target === $event.currentTarget && rowClicked.emit(row)"
              >
                @if (selectable()) {
                  <td class="data-table__select-cell" appStopClickPropagation>
                    @if (isRowSelectable()(row)) {
                      <input
                        type="checkbox"
                        [attr.data-testid]="selectTestId()?.(row) ?? null"
                        [attr.aria-label]="selectAriaLabel()(row)"
                        [checked]="selectedIds().has(id)"
                        [disabled]="selectionDisabled()"
                        (change)="rowSelectionChanged.emit({ row, selected: $any($event.target).checked })"
                      />
                    }
                  </td>
                }
                @for (col of columns(); track col.key) {
                  <td
                    [class.data-table__cell--interactive]="col.interactive"
                    [class.data-table__cell--wrap]="col.wrap"
                    [class.data-table__cell--visible]="col.overflowVisible"
                    [class.data-table__cell--shrink]="col.shrink"
                    [class.data-table__cell--end]="col.align === 'end'"
                    (click)="col.interactive && $event.stopPropagation()"
                    (keydown.enter)="col.interactive && $event.stopPropagation()"
                  >
                    @if (cellTemplate(col.key); as tpl) {
                      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row, index: i }" />
                    }
                  </td>
                }
              </tr>
              @if (rowAfter(); as after) {
                <ng-container *ngTemplateOutlet="after.template; context: { $implicit: row, colspan: colspan() }" />
              }
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; max-width: 100%; }
    /* Visible overflow so row menus/popovers inside cells aren't clipped; scrolls sideways only with minWidth or on narrow screens. */
    /* No panel of its own: the table sits straight on whatever page/card holds it, never the gray surface. */
    .data-table__scroll { overflow: visible; background: transparent; }
    /* overflow-x:auto forces overflow-y to auto too; hide it so a lifted row/tooltip doesn't add a stray vertical scrollbar. */
    .data-table__scroll--x { overflow-x: auto; overflow-y: hidden; }
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0; color: var(--color-text-primary); }
    .data-table--fixed { table-layout: fixed; }
    .data-table__col-select { width: 36px; }
    .data-table th, .data-table td { text-align: left; white-space: nowrap; vertical-align: middle; }
    .data-table th:not(.data-table__select-cell):not(.data-table__th--custom) { overflow: hidden; text-overflow: ellipsis; }
    /* Custom header content (e.g. a popover button) must not be clipped, and sits above the body rows. */
    .data-table .data-table__th--custom { position: relative; z-index: 25; }
    /* Ellipsis-truncate plain cells only - interactive cells host popups an overflow:hidden ancestor would clip. */
    .data-table td:not(.data-table__select-cell):not(.data-table__cell--interactive):not(.data-table__cell--wrap):not(.data-table__cell--visible) { overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
    .data-table--fixed td { max-width: none !important; }
    .data-table .data-table__cell--wrap { white-space: normal; }
    .data-table .data-table__cell--shrink { width: 1%; }
    /* ClickUp People-list look: no box, short light-grey header, tall rows split by faint hairlines. */
    .data-table th { height: 32px; padding: 0 4px 0 16px; color: var(--color-text-secondary); font-size: 12px; font-weight: 400; }
    .data-table__empty-row td { height: auto; padding: 40px 16px; border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent); color: var(--color-text-secondary); text-align: center; white-space: normal; }
    .data-table__empty-row span { display: block; }
    .data-table__empty-row .data-table__empty-title { margin-bottom: 4px; color: var(--color-text-primary); font-weight: 600; }
    .data-table .data-table__cell--end { text-align: right; }
    .data-table td { height: 50px; padding: 6px 4px 6px 16px; font-size: 13px; }
    .data-table th:last-child, .data-table td:last-child { padding-right: 16px; }

    .data-table__row td { background: transparent; border-top: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent); transition: background-color 120ms ease; }
    .data-table__row:hover td { background: color-mix(in srgb, var(--color-text-primary) 3%, transparent); }
    /* Lift the hovered row so popups opened from it (row menu, avatar tooltip) sit above the next rows. */
    .data-table__row:hover td, .data-table__row:focus-within td { position: relative; z-index: 20; }
    /* A row whose popup is open stays above every other row - otherwise hovering the row below
       lifts that row's (opaque) cells over the open menu and only a sliver of it shows. */
    .data-table__row:has(.app-popover__panel) td { position: relative; z-index: 30; }
    .data-table__row--clickable { cursor: pointer; }
    .data-table__row:focus-visible { outline: 2px solid var(--color-focus-ring, var(--color-accent)); outline-offset: -2px; }
    .data-table__row--active td, .data-table__row--active:hover td { background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
    /* Matches the Tree tab's selected-row look (ModuleTreeRowComponent): solid accent fill, white text. Opt in per table via activeRowAppearance="solid" - the default tint above stays for other tables (e.g. Backlog). */
    .data-table__row--active-solid td, .data-table__row--active-solid:hover td { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    /* stickyEndColumn: the table scrolls sideways and its last column (row menu / header ⊕) stays pinned on the right.
       Pinned cells need an opaque backing (the page colour) under the row's tint so scrolled content doesn't show through. */
    .data-table.data-table--sticky-end tr > th:last-child,
    .data-table.data-table--sticky-end tr > td:last-child { position: sticky; right: 0; z-index: 3; background-color: var(--color-content-bg); }
    .data-table.data-table--sticky-end tr > th:last-child { z-index: 26; }
    .data-table.data-table--sticky-end .data-table__row:hover > td:last-child { background: linear-gradient(color-mix(in srgb, var(--color-text-primary) 3%, transparent), color-mix(in srgb, var(--color-text-primary) 3%, transparent)), var(--color-content-bg); }
    .data-table.data-table--sticky-end .data-table__row--active > td:last-child { background: linear-gradient(color-mix(in srgb, var(--color-accent) 8%, transparent), color-mix(in srgb, var(--color-accent) 8%, transparent)), var(--color-content-bg); }
    .data-table.data-table--sticky-end .data-table__row--active-solid > td:last-child { background: var(--color-accent); }
    .data-table.data-table--sticky-end .data-table__row:hover > td:last-child,
    .data-table.data-table--sticky-end .data-table__row:focus-within > td:last-child { z-index: 21; }
    .data-table.data-table--sticky-end .data-table__row:has(.app-popover__panel) > td:last-child { z-index: 31; }
    .data-table__row--busy { opacity: .6; }
    .data-table__row--muted td { color: var(--color-text-secondary); }
    .data-table__row--muted td > * { opacity: .75; }
    .data-table__select-cell { width: 44px; }
    .data-table__select-cell input[type="checkbox"] { display: block; width: 16px; height: 16px; margin: 0; cursor: pointer; accent-color: var(--color-accent); }
    .data-table__select-cell input[type="checkbox"]:disabled { cursor: default; }
    .data-table__empty { display: flex; min-height: 220px; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; background: transparent; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .data-table__empty svg { width: 34px; height: 34px; margin-bottom: 4px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .data-table__empty p { margin: 0; max-width: 24rem; }
    .data-table__empty .data-table__empty-title { color: var(--color-text-primary); font-weight: 600; }
    .data-table__loading { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: transparent; }
    .data-table__skeleton { height: 32px; border-radius: 6px; background: linear-gradient(90deg, color-mix(in srgb, var(--color-text-primary) 4%, transparent) 25%, color-mix(in srgb, var(--color-text-primary) 8%, transparent) 50%, color-mix(in srgb, var(--color-text-primary) 4%, transparent) 75%); background-size: 200% 100%; animation: data-table-shimmer 1.2s ease-in-out infinite; }
    @keyframes data-table-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .data-table__skeleton { animation: none; } }
    .data-table__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    @media (max-width: 768px) {
      .data-table__scroll { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
      .data-table { min-width: 700px; }
    }
  `]
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly T[]>();
  /** Stable row id - used for tracking, selection and the active row. */
  readonly trackBy = input.required<(row: T) => string>();
  readonly rowTestId = input<((row: T) => string) | null>(null);
  /** Wide tables scroll sideways and the last column (row menu / header button) stays pinned on the right. */
  readonly stickyEndColumn = input(false);
  /** Forces a minimum table width and turns on sideways scrolling. */
  readonly minWidth = input<string | null>(null);
  /** Screen-reader caption for the table. */
  readonly caption = input('');
  /** Shown instead of the table when there are no rows; empty string renders an empty table. */
  readonly emptyMessage = input('');
  /** Optional second line under the empty message. */
  readonly emptyDescription = input('');
  /** Shows skeleton rows instead of the table. */
  readonly loading = input(false);
  readonly loadingLabel = input('Loading');
  /** The single "open" row (e.g. the one shown in a side panel). */
  readonly activeRowId = input<string | null>(null);
  /** 'tint' (default): a faint accent wash, text colour unchanged. 'solid': a solid accent fill with
   * white text, matching the Tree tab's selected-row style. */
  readonly activeRowAppearance = input<'tint' | 'solid'>('tint');
  readonly busyRowId = input<string | null>(null);
  /** Extra caller classes per row (style them with ::ng-deep from the caller). */
  readonly rowClass = input<(row: T) => string>(() => '');
  /** Optional native hover text for the row. Return null when no tooltip is needed. */
  readonly rowTitle = input<(row: T) => string | null>(() => null);
  /** Faded rows - archived / inactive records. */
  readonly rowMuted = input<(row: T) => boolean>(() => false);
  /** Rows show a pointer and hover border; set when (rowClicked) does something. */
  readonly rowClickable = input(false);
  /** Rows are keyboard-focusable and Enter clicks them. */
  readonly rowFocusable = input(false);

  // Sort indicator state - the caller owns sorting and passes the current key/direction back in.
  readonly sortBy = input<string | null>(null);
  readonly sortDir = input<DataTableSortDir>('asc');
  readonly sortTestId = input<((key: string) => string) | null>(null);

  // Opt-in checkbox column.
  readonly selectable = input(false);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly isRowSelectable = input<(row: T) => boolean>(() => true);
  readonly selectAllTestId = input('data-table-select-all');
  readonly selectAllAriaLabel = input('Select all rows');
  readonly selectTestId = input<((row: T) => string) | null>(null);
  readonly selectAriaLabel = input<(row: T) => string>(() => 'Select row');
  /** Read-only selection: checkboxes show the selection but can't be changed (e.g. system roles). */
  readonly selectionDisabled = input(false);

  /** Current header-filter values keyed by column key (the page's own filter state, mapped to columns). */
  readonly filterValues = input<Readonly<Record<string, readonly string[] | undefined>>>({});

  readonly rowClicked = output<T>();
  /** Chosen from a header menu: sort this column in this direction. */
  readonly sortChanged = output<{ key: string; dir: DataTableSortDir }>();
  /** A header filter changed; route it into the page's own filter handler. */
  readonly filterChanged = output<{ key: string; values: string[] }>();
  /** A filterable header menu opened (load its options lazily). */
  readonly filterOpened = output<string>();
  readonly rowSelectionChanged = output<{ row: T; selected: boolean }>();
  readonly selectAllChanged = output<boolean>();

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  private readonly headerTemplates = contentChildren(DataTableHeaderDirective);
  private readonly headerTemplatesByKey = computed(() => new Map(this.headerTemplates().map((h) => [h.key(), h.template])));
  protected readonly rowAfter = contentChild(DataTableRowAfterDirective);
  protected readonly skeletonRows = [1, 2, 3, 4];

  private readonly templatesByKey = computed(() => new Map(this.cellTemplates().map((c) => [c.key(), c.template])));
  protected readonly colspan = computed(() => this.columns().length + (this.selectable() ? 1 : 0));
  protected readonly fixedLayout = computed(() => this.columns().some((c) => !!c.width));

  /** In-table filters (columns with filterValue): chosen values per column key. */
  private readonly localFilters = signal<Readonly<Record<string, readonly string[]>>>({});
  protected readonly hasLocalFilters = computed(() => Object.values(this.localFilters()).some((v) => v.length > 0));

  private static valuesOf(column: DataTableColumn, row: unknown): readonly string[] {
    const raw = column.filterValue?.(row as never);
    if (raw == null) return [];
    return (typeof raw === 'string' ? [raw] : raw).filter((v) => v !== '');
  }

  /** Rows after the in-table filters (all rows when none are set). */
  protected readonly visibleRows = computed(() => {
    const active = Object.entries(this.localFilters()).filter(([, values]) => values.length > 0);
    if (active.length === 0) return this.rows();
    const columns = new Map(this.columns().map((c) => [c.key, c] as const));
    return this.rows().filter((row) => active.every(([key, wanted]) => {
      const column = columns.get(key);
      return !column?.filterValue || DataTableComponent.valuesOf(column, row).some((v) => wanted.includes(v));
    }));
  });

  /** Option list per in-table filter column: every distinct value in the rows, plus any still-selected value. */
  private readonly localFilterOptions = computed(() => {
    const map = new Map<string, DataTableColumnFilter>();
    for (const column of this.columns()) {
      if (!column.filterValue || column.filter) continue;
      const values = new Set<string>(this.localFilters()[column.key] ?? []);
      for (const row of this.rows()) for (const v of DataTableComponent.valuesOf(column, row)) values.add(v);
      const options = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
        .map((v) => ({ value: v, label: v }));
      map.set(column.key, { kind: 'multi', options });
    }
    return map;
  });

  protected localFilterFor(column: DataTableColumn): DataTableColumnFilter | null {
    return this.localFilterOptions().get(column.key) ?? null;
  }

  protected localFilterValuesFor(key: string): readonly string[] {
    return this.localFilters()[key] ?? [];
  }

  protected setLocalFilter(key: string, values: readonly string[]): void {
    this.localFilters.update((current) => ({ ...current, [key]: values }));
  }

  private readonly selectableRows = computed(() => this.visibleRows().filter((r) => this.isRowSelectable()(r)));
  protected readonly allSelected = computed(() => {
    const rows = this.selectableRows();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(this.trackBy()(r)));
  });
  protected readonly someSelected = computed(() =>
    !this.allSelected() && this.selectableRows().some((r) => this.selectedIds().has(this.trackBy()(r))));

  protected cellTemplate(key: string): TemplateRef<DataTableCellContext<unknown>> | null {
    return this.templatesByKey().get(key) ?? null;
  }

  protected headerTemplate(key: string): TemplateRef<void> | null {
    return this.headerTemplatesByKey().get(key) ?? null;
  }

  protected readonly hasActiveFilters = computed(() => Object.values(this.filterValues()).some((v) => !!v && v.length > 0));

  protected filterValuesFor(key: string): readonly string[] {
    return this.filterValues()[key] ?? [];
  }

  protected sortState(key: string): 'asc' | 'desc' | null {
    return key === this.sortBy() ? this.sortDir() : null;
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (key !== this.sortBy()) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected isHighlighted(id: string): boolean {
    return id === this.activeRowId() || (this.selectable() && this.selectedIds().has(id));
  }
}
