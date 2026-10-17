import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataTableCellDirective, DataTableColumn, DataTableComponent, DataTableRowAfterDirective } from './data-table.component';

interface Row { id: string; name: string; locked?: boolean; }

@Component({
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective, DataTableRowAfterDirective],
  template: `
    <app-data-table
      [columns]="columns"
      [rows]="rows()"
      [trackBy]="trackBy"
      [rowTestId]="rowTestId"
      [activeRowId]="activeId()"
      [selectable]="selectable()"
      [selectedIds]="selectedIds()"
      [selectionDisabled]="selectionDisabled()"
      [isRowSelectable]="canSelect"
      [selectTestId]="selectTestId"
      [emptyMessage]="emptyMessage()"
      [sortBy]="sortBy()"
      [sortDir]="sortDir()"
      [loading]="loading()"
      (rowClicked)="clicked = $event"
      (sortRequested)="sorted = $event"
      (rowSelectionChanged)="selection = $event"
      (selectAllChanged)="selectAll = $event"
    >
      <ng-template appDataTableCell="name" let-row let-i="index"><span class="name">{{ row.name }}</span><span class="idx">{{ i }}</span></ng-template>
      <ng-template appDataTableCell="action" let-row><button type="button" class="act">Go</button></ng-template>
      <ng-template appDataTableRowAfter let-row let-colspan="colspan">
        <tr class="after"><td [attr.colspan]="colspan">after {{ row.id }}</td></tr>
      </ng-template>
    </app-data-table>
  `
})
class HostComponent {
  columns: DataTableColumn[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'action', label: 'Action', interactive: true, hideLabel: true }
  ];
  rows = signal<Row[]>([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta', locked: true }]);
  activeId = signal<string | null>(null);
  selectable = signal(false);
  selectedIds = signal<ReadonlySet<string>>(new Set());
  selectionDisabled = signal(false);
  emptyMessage = signal('');
  sortBy = signal<string | null>(null);
  sortDir = signal<'asc' | 'desc'>('asc');
  loading = signal(false);
  trackBy = (r: Row) => r.id;
  rowTestId = (r: Row) => 'row-' + r.id;
  selectTestId = (r: Row) => 'select-' + r.id;
  canSelect = (r: Row) => !r.locked;
  clicked: Row | null = null;
  sorted: string | null = null;
  selection: { row: Row; selected: boolean } | null = null;
  selectAll: boolean | null = null;
}

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let el: HTMLElement;
  const q = (sel: string) => el.querySelector<HTMLElement>(sel);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('renders a row per item with the caller cell templates and after-rows', () => {
    expect(el.querySelectorAll('.data-table__row').length).toBe(2);
    expect(q('[data-testid="row-a"] .name')!.textContent).toContain('Alpha');
    expect(el.querySelectorAll('tr.after').length).toBe(2);
    expect(q('tr.after td')!.getAttribute('colspan')).toBe('2');
  });

  it('row click emits the row; interactive cells do not', () => {
    q('[data-testid="row-b"] .act')!.click();
    expect(host.clicked).toBeNull();
    q('[data-testid="row-b"] .name')!.click();
    expect(host.clicked).toEqual(host.rows()[1]);
  });

  it('only sortable headers emit sortRequested; hidden labels stay for screen readers', () => {
    const ths = el.querySelectorAll<HTMLElement>('th');
    expect(ths[1].querySelector('button')).toBeNull();
    ths[0].querySelector('button')!.click();
    expect(host.sorted).toBe('name');
    expect(ths[1].querySelector('.data-table__sr')!.textContent).toBe('Action');
  });

  it('highlights the active row', () => {
    host.activeId.set('b');
    fixture.detectChanges();
    expect(q('[data-testid="row-b"]')!.classList).toContain('data-table__row--active');
    expect(q('[data-testid="row-a"]')!.classList).not.toContain('data-table__row--active');
  });

  it('selection column: per-row checkbox only for selectable rows, select-all state and events', () => {
    host.selectable.set(true);
    host.selectedIds.set(new Set(['a']));
    fixture.detectChanges();

    expect(q('[data-testid="select-a"]')).not.toBeNull();
    expect(q('[data-testid="select-b"]')).toBeNull();
    expect((q('[data-testid="data-table-select-all"]') as HTMLInputElement).checked).toBe(true);
    expect(el.querySelector('tr.after td')!.getAttribute('colspan')).toBe('3');

    q('[data-testid="select-a"]')!.click();
    expect(host.selection).toEqual({ row: host.rows()[0], selected: false });
    q('[data-testid="data-table-select-all"]')!.click();
    expect(host.selectAll).toBe(false);
  });

  it('selectionDisabled shows the selection read-only: checkboxes disabled, selected rows still highlighted', () => {
    host.selectable.set(true);
    host.selectedIds.set(new Set(['a']));
    host.selectionDisabled.set(true);
    fixture.detectChanges();

    const rowBox = q('[data-testid="select-a"]') as HTMLInputElement;
    expect(rowBox.checked).toBe(true);
    expect(rowBox.disabled).toBe(true);
    expect((q('[data-testid="data-table-select-all"]') as HTMLInputElement).disabled).toBe(true);
    expect(rowBox.closest('tr')!.classList.contains('data-table__row--active')).toBe(true);
  });

  it('shows the empty message instead of the table when there are no rows', () => {
    host.rows.set([]);
    fixture.detectChanges();
    expect(q('table')).not.toBeNull();

    host.emptyMessage.set('Nothing here');
    fixture.detectChanges();
    expect(q('table')).toBeNull();
    expect(q('[data-testid="data-table-empty"]')!.textContent).toContain('Nothing here');
  });

  it('marks the sorted column with aria-sort', () => {
    host.sortBy.set('name');
    host.sortDir.set('desc');
    fixture.detectChanges();
    expect(el.querySelectorAll('th')[0].getAttribute('aria-sort')).toBe('descending');
  });

  it('shows skeleton rows while loading', () => {
    host.loading.set(true);
    fixture.detectChanges();
    expect(q('table')).toBeNull();
    expect(q('[data-testid="data-table-loading"]')).not.toBeNull();
  });

  it('passes the row index to cell templates', () => {
    expect(q('[data-testid="row-b"] .idx')!.textContent).toBe('1');
  });
});
