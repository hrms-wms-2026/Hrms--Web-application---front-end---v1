/** Quiet Operations Desk: HR's editable entitlement ledger. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveEntitlementResponse } from '../../models/leave-entitlement.model';
@Component({ selector: 'app-leave-entitlement-list-table', standalone: true, imports: [DataTableComponent, DataTableCellDirective], templateUrl: './leave-entitlement-list-table.component.html', styleUrl: './leave-entitlement-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementListTableComponent {
  private static readonly baseColumns: readonly DataTableColumn[] = [
    { key: 'employee', label: 'Employee' },
    { key: 'leaveType', label: 'Leave type' },
    { key: 'source', label: 'Source' },
    { key: 'total', label: 'Total hours' },
    { key: 'carried', label: 'Carried forward hours' },
    { key: 'used', label: 'Used hours' },
    { key: 'pending', label: 'Pending hours' },
    { key: 'remaining', label: 'Remaining hours' }
  ];
  protected get columns(): readonly DataTableColumn[] {
    return this.canManage ? [...LeaveEntitlementListTableComponent.baseColumns, { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' as const }] : LeaveEntitlementListTableComponent.baseColumns;
  }
  protected readonly trackById = (entitlement: LeaveEntitlementResponse): string => entitlement.id;
  protected readonly rowTestId = (): string => 'entitlement-row';
 @Input({ required: true }) entitlements: readonly LeaveEntitlementResponse[] = []; @Input() canManage = false; @Output() adjustEntitlement = new EventEmitter<LeaveEntitlementResponse>(); @Output() recalculateEntitlement = new EventEmitter<LeaveEntitlementResponse>(); onAdjust(entitlement: LeaveEntitlementResponse): void { this.adjustEntitlement.emit(entitlement); } onRecalculate(entitlement: LeaveEntitlementResponse): void { this.recalculateEntitlement.emit(entitlement); } }
