import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { RoleSummaryResponse } from '../../models/role.model';

@Component({
  selector: 'app-role-list-table',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective],
  templateUrl: './role-list-table.component.html',
  styleUrl: './role-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleListTableComponent {
  @Input({ required: true }) roles: readonly RoleSummaryResponse[] = [];
  @Input() set canManage(value: boolean) {
    this._canManage = value;
    this.columns = value ? [...RoleListTableComponent.baseColumns, RoleListTableComponent.actionsColumn] : RoleListTableComponent.baseColumns;
  }
  get canManage(): boolean {
    return this._canManage;
  }
  private _canManage = false;

  private static readonly baseColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Role name' },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type', filterValue: (r: RoleSummaryResponse) => (r.isSystem ? 'System Role' : 'Custom Role') },
    { key: 'permissions', label: 'Permissions' }
  ];
  private static readonly actionsColumn: DataTableColumn = { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' };

  protected columns: readonly DataTableColumn[] = RoleListTableComponent.baseColumns;
  protected readonly trackById = (role: RoleSummaryResponse): string => role.id;

  /** Opens the role popup: edit for a custom role, read-only view for a system role. */
  @Output() openRole = new EventEmitter<RoleSummaryResponse>();
  @Output() archiveRole = new EventEmitter<RoleSummaryResponse>();
}
