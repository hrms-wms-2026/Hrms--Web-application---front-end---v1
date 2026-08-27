/** Quiet Operations Desk: HR's editable entitlement ledger. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveEntitlementResponse } from '../../models/leave-entitlement.model';
@Component({ selector: 'app-leave-entitlement-list-table', standalone: true, imports: [CommonModule], templateUrl: './leave-entitlement-list-table.component.html', styleUrl: './leave-entitlement-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementListTableComponent { @Input({ required: true }) entitlements: readonly LeaveEntitlementResponse[] = []; @Input() canManage = false; @Output() adjustEntitlement = new EventEmitter<LeaveEntitlementResponse>(); @Output() recalculateEntitlement = new EventEmitter<LeaveEntitlementResponse>(); onAdjust(entitlement: LeaveEntitlementResponse): void { this.adjustEntitlement.emit(entitlement); } onRecalculate(entitlement: LeaveEntitlementResponse): void { this.recalculateEntitlement.emit(entitlement); } }
