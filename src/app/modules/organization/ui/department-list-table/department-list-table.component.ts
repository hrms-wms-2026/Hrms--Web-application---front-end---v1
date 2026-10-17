import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { DepartmentListItemResponse } from '../../models/department.model';

@Component({
  selector: 'app-department-list-table',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective],
  templateUrl: './department-list-table.component.html',
  styleUrl: './department-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DepartmentListTableComponent {
  @Input({ required: true }) departments: readonly DepartmentListItemResponse[] = [];
  @Input() set canManage(value: boolean) {
    this.columns = value ? [...DepartmentListTableComponent.baseColumns, DepartmentListTableComponent.actionsColumn] : DepartmentListTableComponent.baseColumns;
  }

  private static readonly baseColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Department name' },
    { key: 'code', label: 'Code' },
    { key: 'head', label: 'Head position' },
    { key: 'positions', label: 'Positions' },
    { key: 'employees', label: 'Employees' },
    { key: 'status', label: 'Status' }
  ];
  private static readonly actionsColumn: DataTableColumn = { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' };

  protected columns: readonly DataTableColumn[] = DepartmentListTableComponent.baseColumns;
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
