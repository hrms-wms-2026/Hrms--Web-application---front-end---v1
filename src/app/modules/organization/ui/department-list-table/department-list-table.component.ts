import { ChangeDetectionStrategy, Component, computed, EventEmitter, HostListener, input, Input, Output, signal } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableColumnFilters, DataTableComponent, DataTableFilterValues, withColumnFilters } from '../../../../shared/ui/data-table/data-table.component';
import { DepartmentListItemResponse } from '../../models/department.model';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-department-list-table',
  standalone: true,
  imports: [StopClickPropagationDirective, DataTableComponent, DataTableCellDirective],
  templateUrl: './department-list-table.component.html',
  styleUrl: './department-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentListTableComponent {
  @Input({ required: true }) departments: readonly DepartmentListItemResponse[] = [];
  @Input() set canManage(value: boolean) {
    this.canManageColumns.set(value);
  }
  /** Header-menu filters keyed by column key - each mirrors a field of the page's filter bar. */
  readonly columnFilters = input<DataTableColumnFilters>({});
  readonly filterValues = input<DataTableFilterValues>({});
  @Output() filterChanged = new EventEmitter<{ key: string; values: string[] }>();

  private static readonly baseColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Department name' },
    { key: 'code', label: 'Code' },
    { key: 'head', label: 'Head position' },
    { key: 'positions', label: 'Positions' },
    { key: 'employees', label: 'Employees' },
    { key: 'status', label: 'Status' }
  ];
  private static readonly actionsColumn: DataTableColumn = { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' };

  private readonly canManageColumns = signal(false);
  protected readonly columns = computed(() => withColumnFilters(
    this.canManageColumns() ? [...DepartmentListTableComponent.baseColumns, DepartmentListTableComponent.actionsColumn] : DepartmentListTableComponent.baseColumns,
    this.columnFilters()));
  protected readonly trackById = (dept: DepartmentListItemResponse): string => dept.id;
  protected readonly isArchived = (dept: DepartmentListItemResponse): boolean => !dept.isActive;

  @Output() editDepartment = new EventEmitter<DepartmentListItemResponse>();
  @Output() archiveDepartment = new EventEmitter<DepartmentListItemResponse>();
  @Output() restoreDepartment = new EventEmitter<DepartmentListItemResponse>();

  readonly openMenuId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onEdit(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editDepartment.emit(dept);
  }

  onArchive(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.archiveDepartment.emit(dept);
  }

  onRestore(dept: DepartmentListItemResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.restoreDepartment.emit(dept);
  }
}
