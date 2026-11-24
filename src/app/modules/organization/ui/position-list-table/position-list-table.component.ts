import { ChangeDetectionStrategy, Component, computed, EventEmitter, input, Input, Output, signal } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableColumnFilters, DataTableComponent, DataTableFilterValues, withColumnFilters } from '../../../../shared/ui/data-table/data-table.component';
import { PositionListItemResponse } from '../../models/position.model';
import { PositionSeatPreviewComponent } from '../position-seat-preview/position-seat-preview.component';

@Component({
  selector: 'app-position-list-table',
  standalone: true,
  imports: [DataTableComponent, DataTableCellDirective, PositionSeatPreviewComponent],
  templateUrl: './position-list-table.component.html',
  styleUrl: './position-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionListTableComponent {
  @Input({ required: true }) positions: readonly PositionListItemResponse[] = [];
  @Input() set canManage(value: boolean) {
    this._canManage = value;
    this.canManageColumns.set(value);
  }
  get canManage(): boolean {
    return this._canManage;
  }
  private _canManage = false;
  private readonly canManageColumns = signal(false);
  /** Header-menu filters keyed by column key - each mirrors a field of the page's filter bar. */
  readonly columnFilters = input<DataTableColumnFilters>({});
  readonly filterValues = input<DataTableFilterValues>({});
  @Output() filterChanged = new EventEmitter<{ key: string; values: string[] }>();

  private static readonly baseColumns: readonly DataTableColumn[] = [
    { key: 'name', label: 'Position name' },
    { key: 'code', label: 'Code' },
    { key: 'department', label: 'Department' },
    { key: 'reportsTo', label: 'Reports to' },
    { key: 'capacity', label: 'Capacity' }
  ];
  private static readonly actionsColumn: DataTableColumn = { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' };

  protected readonly columns = computed(() => withColumnFilters(
    this.canManageColumns() ? [...PositionListTableComponent.baseColumns, PositionListTableComponent.actionsColumn] : PositionListTableComponent.baseColumns,
    this.columnFilters()));
  protected readonly trackById = (pos: PositionListItemResponse): string => pos.id;
  protected readonly isArchived = (pos: PositionListItemResponse): boolean => !pos.isActive;
  protected readonly rowClass = (pos: PositionListItemResponse): string =>
    this.vacancyCount(pos) > 0 ? 'plt-row--vacant' : '';
  protected readonly vacancyTitle = (pos: PositionListItemResponse): string | null => {
    const count = this.vacancyCount(pos);
    return count > 0 ? `${count} ${count === 1 ? 'vacancy' : 'vacancies'} available` : null;
  };
  @Input() departmentNameMap: Record<string, string> = {};
  @Input() positionNameMap: Record<string, string> = {};

  @Output() viewCoverage = new EventEmitter<PositionListItemResponse>();

  getDepartmentName(deptId: string | null): string {
    if (!deptId) return 'General';
    return this.departmentNameMap[deptId] || 'General';
  }

  getReportsToName(reportsToId: string | null): string {
    if (!reportsToId) return '—';
    return this.positionNameMap[reportsToId] || 'Root Position';
  }

  private vacancyCount(pos: PositionListItemResponse): number {
    if (!pos.isActive) return 0;

    const assigned = pos.assignedCount !== undefined
      ? pos.assignedCount
      : pos.currentOccupancyCheckSupported !== false
        ? pos.currentOccupancy
        : null;
    if (assigned === null || assigned === undefined || !Number.isFinite(assigned)) return 0;

    const occupiedOrReserved = Math.max(0, assigned) + Math.max(0, pos.reservedCount ?? 0);
    return Math.max(0, pos.maxOccupancy - occupiedOrReserved);
  }

  openPositionPanel(pos: PositionListItemResponse, event: Event): void {
    event.stopPropagation();
    this.viewCoverage.emit(pos);
  }
}
