import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChild, contentChildren, Directive, inject, input, output, TemplateRef } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
  /** CSS width for the column, e.g. '28%' or '120px'. When any column sets a width the table uses a fixed layout. */
  width?: string;
  /** Header shows sort arrows and emits sortRequested(key). Sorting itself stays with the caller. */
  sortable?: boolean;
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

export interface DataTableCellContext<T> { $implicit: T; index: number; }
export interface DataTableRowAfterContext<T> { $implicit: T; colspan: number; }

/** `<ng-template appDataTableCell="key" let-row let-i="index">` renders the cell for the column with that key. */
@Directive({ selector: 'ng-template[appDataTableCell]', standalone: true })
export class DataTableCellDirective {
  readonly key = input.required<string>({ alias: 'appDataTableCell' });
  readonly template = inject<TemplateRef<DataTableCellContext<unknown>>>(TemplateRef);
}

/** `<ng-template appDataTableRowAfter let-row let-colspan="colspan">` renders extra `<tr>`s after each row (e.g. subtasks). */
@Directive({ selector: 'ng-template[appDataTableRowAfter]', standalone: true })
export class DataTableRowAfterDirective {
  readonly template = inject<TemplateRef<DataTableRowAfterContext<unknown>>>(TemplateRef);
}

/**
 * The project's one table: card-style rows floating on a tinted background (the Employees / Backlog look).
 * Every table in the app renders through this component. Columns are config; each cell is a caller
 * template, so callers keep only their own cell markup and styles.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (loading()) {
      <div class="data-table__loading" data-testid="data-table-loading" aria-busy="true" [attr.aria-label]="loadingLabel()">
        @for (n of skeletonRows; track n) { <span class="data-table__skeleton"></span> }
      </div>
    } @else if (rows().length === 0 && emptyMessage()) {
      <div class="data-table__empty" data-testid="data-table-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6" /><path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><path d="m9 13 2 2 4-4" /></svg>
        <p class="data-table__empty-title">{{ emptyMessage() }}</p>
        @if (emptyDescription()) { <p>{{ emptyDescription() }}</p> }
      </div>
    } @else {
      <div class="data-table__scroll" [class.data-table__scroll--x]="minWidth()">
        <table class="data-table" [class.data-table--fixed]="fixedLayout()" [style.min-width]="minWidth()">
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
                    (click)="$event.stopPropagation()"
                    (change)="selectAllChanged.emit($any($event.target).checked)"
                  />
                </th>
              }
              @for (col of columns(); track col.key) {
                <th
                  scope="col"
                  [class.data-table__cell--end]="col.align === 'end'"
                  [class.data-table__cell--shrink]="col.shrink"
                  [attr.aria-sort]="col.sortable ? ariaSort(col.key) : null"
                >
                  @if (col.hideLabel) {
                    <span class="data-table__sr">{{ col.label }}</span>
                  } @else if (col.sortable) {
                    <button
                      type="button"
                      class="data-table__sort"
                      [attr.data-testid]="sortTestId()?.(col.key) ?? null"
                      (click)="sortRequested.emit(col.key)"
                    >
                      {{ col.label }}
                      <svg class="data-table__sort-icon" [class.data-table__sort-icon--active]="ariaSort(col.key) !== 'none'" viewBox="0 0 24 24" aria-hidden="true">
                        @if (ariaSort(col.key) === 'descending') { <path d="M8 10l4 4 4-4" /> }
                        @else if (ariaSort(col.key) === 'ascending') { <path d="M8 14l4-4 4 4" /> }
                        @else { <path d="M8 9l4-4 4 4M8 15l4 4 4-4" /> }
                      </svg>
                    </button>
                  } @else {
                    {{ col.label }}
                  }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track trackBy()(row); let i = $index) {
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
                  <td class="data-table__select-cell" (click)="$event.stopPropagation()">
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
    .data-table__scroll { overflow: visible; border-radius: 12px; background: var(--color-surface-secondary); padding: 2px 4px 6px; }
    .data-table__scroll--x { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: separate; border-spacing: 0 5px; color: var(--color-text-primary); }
    .data-table--fixed { table-layout: fixed; }
    .data-table__col-select { width: 36px; }
    .data-table th, .data-table td { text-align: left; white-space: nowrap; vertical-align: middle; }
    .data-table th:not(.data-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    /* Ellipsis-truncate plain cells only - interactive cells host popups an overflow:hidden ancestor would clip. */
    .data-table td:not(.data-table__select-cell):not(.data-table__cell--interactive):not(.data-table__cell--wrap):not(.data-table__cell--visible) { overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
    .data-table--fixed td { max-width: none !important; }
    .data-table .data-table__cell--wrap { white-space: normal; }
    .data-table .data-table__cell--shrink { width: 1%; }
    .data-table th { padding: 13px 16px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .data-table__sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer; transition: color 160ms ease; }
    .data-table__sort:hover { color: var(--color-accent); }
    .data-table__sort-icon { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: .5; }
    .data-table__sort-icon--active { opacity: 1; color: var(--color-accent); }
    .data-table .data-table__cell--end { text-align: right; }
    .data-table td { padding: 7px 14px; font-size: 13px; }

    /* Card-style rows: each row is its own rounded, bordered card on the tinted background, separated
       by the border-spacing. Only the outer cells get side borders + radii so a row reads as one card. */
    .data-table__row td { background: var(--color-surface); border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); transition: background-color 150ms ease, border-color 150ms ease; }
    .data-table__row td:first-child { border-left: 1px solid var(--color-border); border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
    .data-table__row td:last-child { border-right: 1px solid var(--color-border); border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
    /* Lift the hovered row so popups opened from it (row menu, avatar tooltip) sit above the next rows. */
    .data-table__row:hover td, .data-table__row:focus-within td { position: relative; z-index: 20; }
    /* A row whose popup is open stays above every other row - otherwise hovering the row below
       lifts that row's (opaque) cells over the open menu and only a sliver of it shows. */
    .data-table__row:has(.app-popover__panel) td { position: relative; z-index: 30; }
    .data-table__row--clickable { cursor: pointer; }
    .data-table__row--clickable:hover td, .data-table__row--clickable:focus-within td { border-color: color-mix(in srgb, var(--color-accent) 22%, var(--color-border)); }
    .data-table__row:focus-visible { outline: 2px solid var(--color-focus-ring, var(--color-accent)); outline-offset: -2px; }
    .data-table__row--active td { background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border)); }
    /* Matches the Tree tab's selected-row look (ModuleTreeRowComponent): solid accent fill, white text. Opt in per table via activeRowAppearance="solid" - the default tint above stays for other tables (e.g. Backlog). */
    .data-table__row--active-solid td { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .data-table__row--busy { opacity: .6; }
    .data-table__row--muted td { color: var(--color-text-secondary); }
    .data-table__row--muted td > * { opacity: .75; }
    .data-table__select-cell { width: 36px; }
    .data-table__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
    .data-table__select-cell input[type="checkbox"]:disabled { cursor: default; }
    .data-table__empty { display: flex; min-height: 220px; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 24px; border-radius: 12px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .data-table__empty svg { width: 34px; height: 34px; margin-bottom: 4px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .data-table__empty p { margin: 0; max-width: 24rem; }
    .data-table__empty .data-table__empty-title { color: var(--color-text-primary); font-weight: 600; }
    .data-table__loading { display: flex; flex-direction: column; gap: 5px; padding: 8px 4px; border-radius: 12px; background: var(--color-surface-secondary); }
    .data-table__skeleton { height: 46px; border-radius: 8px; background: linear-gradient(90deg, var(--color-surface) 25%, color-mix(in srgb, var(--color-border) 45%, var(--color-surface)) 50%, var(--color-surface) 75%); background-size: 200% 100%; animation: data-table-shimmer 1.2s ease-in-out infinite; }
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

  readonly rowClicked = output<T>();
  readonly sortRequested = output<string>();
  readonly rowSelectionChanged = output<{ row: T; selected: boolean }>();
  readonly selectAllChanged = output<boolean>();

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  protected readonly rowAfter = contentChild(DataTableRowAfterDirective);
  protected readonly skeletonRows = [1, 2, 3, 4];

  private readonly templatesByKey = computed(() => new Map(this.cellTemplates().map((c) => [c.key(), c.template])));
  protected readonly colspan = computed(() => this.columns().length + (this.selectable() ? 1 : 0));
  protected readonly fixedLayout = computed(() => this.columns().some((c) => !!c.width));

  private readonly selectableRows = computed(() => this.rows().filter((r) => this.isRowSelectable()(r)));
  protected readonly allSelected = computed(() => {
    const rows = this.selectableRows();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(this.trackBy()(r)));
  });
  protected readonly someSelected = computed(() =>
    !this.allSelected() && this.selectableRows().some((r) => this.selectedIds().has(this.trackBy()(r))));

  protected cellTemplate(key: string): TemplateRef<DataTableCellContext<unknown>> | null {
    return this.templatesByKey().get(key) ?? null;
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    if (key !== this.sortBy()) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected isHighlighted(id: string): boolean {
    return id === this.activeRowId() || (this.selectable() && this.selectedIds().has(id));
  }
}
