/** Quiet Operations Desk: the manager/HR queue - one row per request awaiting this approver. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeavePendingApprovalListItemResponse } from '../../models/leave-approval.model';

@Component({ selector: 'app-leave-pending-approvals-table', standalone: true, imports: [CommonModule], templateUrl: './leave-pending-approvals-table.component.html', styleUrl: './leave-pending-approvals-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePendingApprovalsTableComponent {
  @Input({ required: true }) rows: readonly LeavePendingApprovalListItemResponse[] = [];
  @Input({ required: true }) selectedIds: ReadonlySet<string> = new Set();
  @Output() rowClicked = new EventEmitter<string>();
  @Output() selectionChanged = new EventEmitter<Set<string>>();

  statusLabel(status: string): string {
    return status === 'information_requested' ? 'Awaiting your info' : 'Pending';
  }

  onCheckboxClick(event: Event, requestId: string): void {
    event.stopPropagation();
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selectedIds);
    if (checked) next.add(requestId); else next.delete(requestId);
    this.selectionChanged.emit(next);
  }
}
