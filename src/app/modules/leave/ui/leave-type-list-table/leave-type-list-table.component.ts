/** Quiet Operations Desk: a scan-first, presentational policy ledger. */
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { LeaveTypeIconComponent } from '../leave-type-icon/leave-type-icon.component';

@Component({ selector: 'app-leave-type-list-table', standalone: true, imports: [StopClickPropagationDirective, CommonModule, ButtonComponent, LeaveTypeIconComponent], templateUrl: './leave-type-list-table.component.html', styleUrl: './leave-type-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveTypeListTableComponent {
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() canManage = false;
  @Output() editLeaveType = new EventEmitter<LeaveTypeResponse>();
  @Output() deactivateLeaveType = new EventEmitter<LeaveTypeResponse>();
  @Output() viewPolicies = new EventEmitter<LeaveTypeResponse>();
  @Output() addPolicy = new EventEmitter<LeaveTypeResponse>();
  readonly openMenuId = signal<string | null>(null);
  @HostListener('document:click') onDocumentClick(): void { this.closeMenu(); }
  toggleMenu(id: string, event: Event): void { event.stopPropagation(); this.openMenuId.update((current) => (current === id ? null : id)); }
  closeMenu(): void { this.openMenuId.set(null); }
  onEdit(type: LeaveTypeResponse, event: Event): void { event.stopPropagation(); this.closeMenu(); this.editLeaveType.emit(type); }
  onDeactivate(type: LeaveTypeResponse, event: Event): void { event.stopPropagation(); this.closeMenu(); this.deactivateLeaveType.emit(type); }
}
