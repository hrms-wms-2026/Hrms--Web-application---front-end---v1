/** Quiet Operations Desk: a high-density policy ledger designed for rapid scanning. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeavePolicyListItemResponse } from '../../models/leave-policy.model';
@Component({ selector: 'app-leave-policy-list-table', standalone: true, imports: [DataTableComponent, DataTableCellDirective], templateUrl: './leave-policy-list-table.component.html', styleUrl: './leave-policy-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyListTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'policy', label: 'Policy' },
    { key: 'leaveTypes', label: 'Leave types', wrap: true },
    { key: 'legalEntities', label: 'Legal entities', wrap: true },
    { key: 'rules', label: 'Rules' },
    { key: 'effective', label: 'Effective' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', hideLabel: true, interactive: true, shrink: true, align: 'end' as const }
  ];
  protected readonly trackById = (policy: LeavePolicyListItemResponse): string => policy.id;
 @Input({ required: true }) policies: readonly LeavePolicyListItemResponse[] = []; @Input() canManage = false; @Output() viewPolicy = new EventEmitter<LeavePolicyListItemResponse>(); @Output() clonePolicy = new EventEmitter<LeavePolicyListItemResponse>(); }
