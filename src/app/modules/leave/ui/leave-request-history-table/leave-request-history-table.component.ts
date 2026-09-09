import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { formatHoursLabel, formatLeaveDateTime } from '../../utils/leave-hours-format';

@Component({ selector: 'app-leave-request-history-table', standalone: true, imports: [CommonModule], templateUrl: './leave-request-history-table.component.html', styleUrl: './leave-request-history-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestHistoryTableComponent {
  @Input({ required: true }) requests: readonly LeaveRequestListItemResponse[] = [];
  @Input() timezone: string | null = null;
  @Output() cancelRequested = new EventEmitter<LeaveRequestListItemResponse>();

  formatWhen(iso: string): string {
    return formatLeaveDateTime(iso, this.timezone);
  }

  formatHours(hours: number): string {
    return formatHoursLabel(hours);
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  canCancel(request: LeaveRequestListItemResponse): boolean {
    return request.status === 'pending' || request.status === 'approved';
  }
}
