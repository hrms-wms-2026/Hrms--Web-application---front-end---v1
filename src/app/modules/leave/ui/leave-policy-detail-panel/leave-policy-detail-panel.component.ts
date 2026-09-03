/** Quiet Operations Desk: a read-only evidence panel that keeps policy rules inspectable. */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeavePolicyResponse } from '../../models/leave-policy.model';
@Component({ selector: 'app-leave-policy-detail-panel', standalone: true, imports: [CommonModule], templateUrl: './leave-policy-detail-panel.component.html', styleUrl: './leave-policy-detail-panel.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyDetailPanelComponent { @Input({ required: true }) policy: LeavePolicyResponse | null = null; }
