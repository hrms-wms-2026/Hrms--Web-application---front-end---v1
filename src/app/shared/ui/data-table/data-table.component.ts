import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, contentChild, contentChildren, Directive, inject, input, output, TemplateRef } from '@angular/core';

export interface DataTableColumn {
  key: string;
  label: string;
  /** CSS width for the column, e.g. '28%' or '120px'. */
  width?: string;
  /** Header click emits sortRequested(key). Sorting itself stays with the caller. */
  sortable?: boolean;
  /** The cell hosts its own controls (buttons, popovers, pickers): clicks don't select the row and content isn't clipped. */
  interactive?: boolean;
  align?: 'start' | 'end';
  /** Header text is read by screen readers only (e.g. an actions column). */
  hideLabel?: boolean;
}

export interface DataTableCellContext<T> { $implicit: T; }
export interface DataTableRowAfterContext<T> { $implicit: T; colspan: number; }

/** `<ng-template appDataTableCell="key" let-row>` renders the cell for the column with that key. */
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
 * The project's reusable table: card-style rows floating on a tinted background (the Backlog look).
 * Columns are config; each cell is a caller template, so callers keep their own cell markup and styles.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    @if (rows().length === 0 && emptyMessage()) {
      <div class="data-table__empty" data-testid="data-table-empty">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6" /><path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><path d="m9 13 2 2 4-4" /></svg>
        <p>{{ emptyMessage() }}</p>
      </div>
    } @else {
      <div class="data-table__scroll">
        <table class="data-table" [style.min-width]="minWidth()">
          <colgroup>
            @if (selectable()) { <col class="data-table__col-select" /> }
            @for (col of columns(); track col.key) { <col [style.width]="col.width ?? null" /> }
          </colgroup>
          <thead>
            <tr>
              @if (selectable()) {
                <th class="data-table__select-cell">
                  <input
                    type="checkbox"
                    [attr.data-testid]="selectAllTestId()"
                    aria-label="Select all rows"
                    [checked]="allSelected()"
                    [indeterminate]="someSelected()"
                    (click)="$event.stopPropagation()"
                    (change)="selectAllChanged.emit($any($event.target).checked)"
                  />
                </th>
              }
              @for (col of columns(); track col.key) {
                <th
                  scope="col"
                  [class.data-table__th--sortable]="col.sortable"
                  [class.data-table__cell--end]="col.align === 'end'"
                  (click)="col.sortable && sortRequested.emit(col.key)"
                >
                  @if (col.hideLabel) { <span class="data-table__sr">{{ col.label }}</span> } @else { {{ col.label }} }
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track trackBy()(row)) {
              @let id = trackBy()(row);
              <tr
                class="data-table__row"
                [class.data-table__row--active]="isHighlighted(id)"
                [class.data-table__row--active-solid]="isHighlighted(id) && activeRowAppearance() === 'solid'"
                [class.data-table__row--busy]="id === busyRowId()"
                [attr.data-testid]="rowTestId()?.(row) ?? null"
                [attr.data-id]="id"
                [attr.tabindex]="rowFocusable() ? 0 : null"
                [attr.aria-selected]="activeRowId() !== null ? id === activeRowId() : null"
                (click)="rowClicked.emit(row)"
                (keydown.enter)="rowFocusable() && rowClicked.emit(row)"
              >
                @if (selectable()) {
                  <td class="data-table__select-cell" (click)="$event.stopPropagation()">
                    @if (isRowSelectable()(row)) {
                      <input
                        type="checkbox"
                        [attr.data-testid]="selectTestId()?.(row) ?? null"
                        aria-label="Select row"
                        [checked]="selectedIds().has(id)"
                        (change)="rowSelectionChanged.emit({ row, selected: $any($event.target).checked })"
                      />
                    }
                  </td>
                }
                @for (col of columns(); track col.key) {
                  <td
                    [class.data-table__cell--interactive]="col.interactive"
                    [class.data-table__cell--end]="col.align === 'end'"
                    (click)="col.interactive && $event.stopPropagation()"
                    (keydown.enter)="col.interactive && $event.stopPropagation()"
                  >
                    @if (cellTemplate(col.key); as tpl) {
                      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
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
    :host { display: block; min-width: 0; }
    .data-table__scroll { overflow-x: auto; border-radius: 12px; background: var(--color-surface-secondary); padding: 2px 4px 6px; }
    .data-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0 5px; color: var(--color-text-primary); }
    .data-table__col-select { width: 36px; }
    .data-table th, .data-table td { text-align: left; white-space: nowrap; vertical-align: middle; }
    .data-table th:not(.data-table__select-cell) { overflow: hidden; text-overflow: ellipsis; }
    /* Ellipsis-truncate plain cells only - interactive cells host popups an overflow:hidden ancestor would clip. */
    .data-table td:not(.data-table__select-cell):not(.data-table__cell--interactive) { overflow: hidden; text-overflow: ellipsis; }
    .data-table th { padding: 13px 16px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .data-table__th--sortable { cursor: pointer; transition: color 160ms ease; }
    .data-table__th--sortable:hover { color: var(--color-accent); }
    .data-table .data-table__cell--end { text-align: right; }
    .data-table td { padding: 7px 14px; font-size: 13px; }

    /* Card-style rows: each row is its own rounded, bordered card on the tinted background, separated
       by the border-spacing. Only the outer cells get side borders + radii so a row reads as one card. */
    .data-table__row { cursor: pointer; }
    .data-table__row td { background: var(--color-surface); border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); transition: background-color 150ms ease, border-color 150ms ease; }
    .data-table__row td:first-child { border-left: 1px solid var(--color-border); border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
    .data-table__row td:last-child { border-right: 1px solid var(--color-border); border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
    .data-table__row:hover td { border-color: color-mix(in srgb, var(--color-accent) 22%, var(--color-border)); }
    .data-table__row:focus-visible { outline: 2px solid var(--color-focus-ring, var(--color-accent)); outline-offset: -2px; }
    .data-table__row--active td { background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border)); }
    /* Matches the Tree tab's selected-row look (ModuleTreeRowComponent): solid accent fill, white text. Opt in per table via activeRowAppearance="solid" - the default tint above stays for other tables (e.g. Backlog). */
    .data-table__row--active-solid td { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .data-table__row--busy { opacity: .6; }
    .data-table__select-cell { width: 36px; }
    .data-table__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
    .data-table__empty { display: flex; min-height: 220px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; border-radius: 12px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 13px; }
    .data-table__empty svg { width: 34px; height: 34px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .data-table__empty p { margin: 0; }
    .data-table__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `]
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly T[]>();
  /** Stable row id - used for tracking, selection and the active row. */
  readonly trackBy = input.required<(row: T) => string>();
  readonly rowTestId = input<((row: T) => string) | null>(null);
  readonly minWidth = input<string | null>(null);
  /** Shown instead of the table when there are no rows; empty string renders an empty table. */
  readonly emptyMessage = input('');
  /** The single "open" row (e.g. the one shown in a side panel). */
  readonly activeRowId = input<string | null>(null);
  /** 'tint' (default): a faint accent wash, text colour unchanged. 'solid': a solid accent fill with
   * white text, matching the Tree tab's selected-row style. */
  readonly activeRowAppearance = input<'tint' | 'solid'>('tint');
  readonly busyRowId = input<string | null>(null);
  /** Rows are keyboard-focusable and Enter clicks them. */
  readonly rowFocusable = input(false);

  // Opt-in checkbox column.
  readonly selectable = input(false);
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly isRowSelectable = input<(row: T) => boolean>(() => true);
  readonly selectAllTestId = input('data-table-select-all');
  readonly selectTestId = input<((row: T) => string) | null>(null);

  readonly rowClicked = output<T>();
  readonly sortRequested = output<string>();
  readonly rowSelectionChanged = output<{ row: T; selected: boolean }>();
  readonly selectAllChanged = output<boolean>();

  private readonly cellTemplates = contentChildren(DataTableCellDirective);
  protected readonly rowAfter = contentChild(DataTableRowAfterDirective);

  private readonly templatesByKey = computed(() => new Map(this.cellTemplates().map((c) => [c.key(), c.template])));
  protected readonly colspan = computed(() => this.columns().length + (this.selectable() ? 1 : 0));

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

  protected isHighlighted(id: string): boolean {
    return id === this.activeRowId() || (this.selectable() && this.selectedIds().has(id));
  }
}
