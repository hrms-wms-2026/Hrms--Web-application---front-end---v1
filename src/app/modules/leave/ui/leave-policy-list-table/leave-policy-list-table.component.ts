/** Policy ledger: one row per single-leave-type policy with its amount, reach and version. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeavePolicyListItem } from '../../models/leave-policy.model';
import { formatAmount } from '../../utils/leave-amount';

@Component({ selector: 'app-leave-policy-list-table', standalone: true, imports: [DataTableComponent, DataTableCellDirective], templateUrl: './leave-policy-list-table.component.html', styleUrl: './leave-policy-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyListTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'policy', label: 'Policy' },
    { key: 'leaveType', label: 'Leave type' },
    { key: 'amount', label: 'Amount' },
    { key: 'assignedTo', label: 'Assigned to', wrap: true },
    { key: 'version', label: 'Version' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', hideLabel: true, interactive: true, shrink: true, align: 'end' as const }
  ];
  protected readonly trackById = (policy: LeavePolicyListItem): string => policy.id;
  @Input({ required: true }) policies: readonly LeavePolicyListItem[] = [];
  @Input() canManage = false;
  @Output() viewPolicy = new EventEmitter<LeavePolicyListItem>();
  @Output() clonePolicy = new EventEmitter<LeavePolicyListItem>();

  protected amount(policy: LeavePolicyListItem): string { return formatAmount(policy.amountHours, policy.amountPeriod); }

  /** "v2" or "v2 · next on 1 Nov". */
  protected versionLabel(policy: LeavePolicyListItem): string {
    if (!policy.nextVersionEffectiveFrom) return `v${policy.currentVersionNumber}`;
    const [y, m, d] = policy.nextVersionEffectiveFrom.split('-').map(Number);
    const next = new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `v${policy.currentVersionNumber} · next on ${next}`;
  }
}
