import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';

@Component({ selector: 'app-leave-request-history-table', standalone: true, imports: [CommonModule], templateUrl: './leave-request-history-table.component.html', styleUrl: './leave-request-history-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestHistoryTableComponent {
  @Input({ required: true }) requests: readonly LeaveRequestListItemResponse[] = [];
  @Output() cancelRequested = new EventEmitter<LeaveRequestListItemResponse>();
  @Output() replyRequested = new EventEmitter<LeaveRequestListItemResponse>();

  statusLabel(status: string): string {
    if (status === 'information_requested') return 'Information requested';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  canCancel(request: LeaveRequestListItemResponse): boolean {
    return request.status === 'pending' || request.status === 'approved';
  }

  canReply(request: LeaveRequestListItemResponse): boolean {
    return request.status === 'information_requested';
  }
}
