/** Quiet Operations Desk: a high-density policy ledger designed for rapid scanning. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeavePolicyListItemResponse } from '../../models/leave-policy.model';
@Component({ selector: 'app-leave-policy-list-table', standalone: true, imports: [CommonModule], templateUrl: './leave-policy-list-table.component.html', styleUrl: './leave-policy-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyListTableComponent { @Input({ required: true }) policies: readonly LeavePolicyListItemResponse[] = []; @Input() canManage = false; @Output() viewPolicy = new EventEmitter<LeavePolicyListItemResponse>(); @Output() clonePolicy = new EventEmitter<LeavePolicyListItemResponse>(); }
