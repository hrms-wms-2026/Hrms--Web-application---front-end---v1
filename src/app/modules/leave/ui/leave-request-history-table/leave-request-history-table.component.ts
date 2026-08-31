import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';

@Component({ selector: 'app-leave-request-history-table', standalone: true, imports: [CommonModule], templateUrl: './leave-request-history-table.component.html', styleUrl: './leave-request-history-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestHistoryTableComponent {
  @Input({ required: true }) requests: readonly LeaveRequestListItemResponse[] = [];

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
