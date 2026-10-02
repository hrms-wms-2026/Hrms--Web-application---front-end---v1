import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveBalanceAuditResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-balance-audit-table', standalone: true, imports: [CommonModule], templateUrl: './leave-balance-audit-table.component.html', styleUrl: './leave-balance-audit-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveBalanceAuditTableComponent {
  @Input({ required: true }) rows: readonly LeaveBalanceAuditResponse[] = [];
  @Input({ required: true }) hasMore = false;
  @Input({ required: true }) loading = false;
  @Output() loadMoreRequested = new EventEmitter<void>();

  signedDays(hoursChanged: number): string {
    return hoursChanged >= 0 ? `+${hoursChanged}` : `${hoursChanged}`;
  }

  changeTypeLabel(changeType: string): string {
    return changeType.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
