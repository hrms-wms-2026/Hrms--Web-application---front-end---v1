/** Quiet Operations Desk: a scan-first, presentational policy ledger. */
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveTypeResponse } from '../../models/leave-type.model';

@Component({ selector: 'app-leave-type-list-table', standalone: true, imports: [CommonModule], templateUrl: './leave-type-list-table.component.html', styleUrl: './leave-type-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveTypeListTableComponent {
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() canManage = false;
  @Output() editLeaveType = new EventEmitter<LeaveTypeResponse>();
  @Output() deactivateLeaveType = new EventEmitter<LeaveTypeResponse>();
  readonly openMenuId = signal<string | null>(null);
  @HostListener('document:click') onDocumentClick(): void { this.closeMenu(); }
  toggleMenu(id: string, event: Event): void { event.stopPropagation(); this.openMenuId.update((current) => (current === id ? null : id)); }
  closeMenu(): void { this.openMenuId.set(null); }
  onEdit(type: LeaveTypeResponse, event: Event): void { event.stopPropagation(); this.closeMenu(); this.editLeaveType.emit(type); }
  onDeactivate(type: LeaveTypeResponse, event: Event): void { event.stopPropagation(); this.closeMenu(); this.deactivateLeaveType.emit(type); }
}
