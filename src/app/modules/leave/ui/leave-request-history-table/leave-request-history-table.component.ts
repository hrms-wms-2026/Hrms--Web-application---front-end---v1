import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';

@Component({ selector: 'app-leave-request-history-table', standalone: true, imports: [CommonModule, DataTableComponent, DataTableCellDirective], templateUrl: './leave-request-history-table.component.html', styleUrl: './leave-request-history-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestHistoryTableComponent {
  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'type', label: 'Type' },
    { key: 'from', label: 'From' },
    { key: 'to', label: 'To' },
    { key: 'hours', label: 'Hours' },
    { key: 'status', label: 'Status' },
    { key: 'approvedBy', label: 'Approved By' },
    { key: 'submitted', label: 'Submitted On' },
    { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' as const }
  ];
  protected readonly trackById = (request: LeaveRequestListItemResponse): string => request.id;
  protected readonly rowTestId = (): string => 'request-row';

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
