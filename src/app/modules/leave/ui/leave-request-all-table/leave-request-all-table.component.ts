/** Quiet Operations Desk: HR's org-wide read-only ledger of every leave request. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveRequestAllListItemResponse } from '../../models/leave-approval.model';

@Component({ selector: 'app-leave-request-all-table', standalone: true, imports: [CommonModule], templateUrl: './leave-request-all-table.component.html', styleUrl: './leave-request-all-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestAllTableComponent {
  @Input({ required: true }) rows: readonly LeaveRequestAllListItemResponse[] = [];
  @Output() rowClicked = new EventEmitter<string>();
  @Output() cancelRequested = new EventEmitter<LeaveRequestAllListItemResponse>();

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  }

  canCancel(row: LeaveRequestAllListItemResponse): boolean {
    return row.status === 'pending' || row.status === 'approved';
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}
