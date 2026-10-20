/** Read-only policy view: the rules in force as plain facts, who it applies to, and its versions. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LEAVE_ELIGIBILITY_OPTIONS,
  LEAVE_POLICY_APPROVAL_MODE_OPTIONS,
  LEAVE_POLICY_SOURCE_LABELS,
  LeavePolicyDetail,
  LeavePolicyVersion
} from '../../models/leave-policy.model';
import { formatAmount, formatHours } from '../../utils/leave-amount';

export interface PolicyFact { readonly label: string; readonly value: string; }

@Component({ selector: 'app-leave-policy-detail-panel', standalone: true, imports: [CommonModule], templateUrl: './leave-policy-detail-panel.component.html', styleUrl: './leave-policy-detail-panel.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeavePolicyDetailPanelComponent {
  @Input({ required: true }) policy: LeavePolicyDetail | null = null;
  @Input() canManage = false;
  @Output() edit = new EventEmitter<void>();
  @Output() deleteVersion = new EventEmitter<string>();
  @Output() setActive = new EventEmitter<boolean>();

  facts(version: LeavePolicyVersion): readonly PolicyFact[] {
    const eligibility = LEAVE_ELIGIBILITY_OPTIONS.find((o) => o.value === version.eligibleFrom)?.label ?? version.eligibleFrom;
    const facts: PolicyFact[] = [
      { label: 'Amount', value: formatAmount(version.amountHours, version.amountPeriod) },
      { label: 'Carry over', value: version.carryForwardCapHours == null ? 'All unused hours' : `Up to ${formatHours(version.carryForwardCapHours)}` },
      { label: 'Carried hours', value: version.carryForwardExpiryMonths == null ? 'Never expire' : `Expire after ${version.carryForwardExpiryMonths} months` },
      { label: 'New joiners', value: version.eligibleFrom === 'after_months' ? `After ${version.eligibleAfterMonths} months` : eligibility },
      { label: 'Notice', value: `${version.minimumNoticeDays} days` },
      { label: 'Shortest request', value: formatHours(version.minRequestHours) },
      { label: 'Longest request', value: version.maxRequestHours == null ? 'No limit' : formatHours(version.maxRequestHours) },
      { label: 'Team absence', value: version.maxTeamAbsencePercent == null ? 'No limit' : `${version.maxTeamAbsencePercent}%` },
      { label: 'Approval', value: LEAVE_POLICY_APPROVAL_MODE_OPTIONS.find((o) => o.value === version.approvalMode)?.label ?? version.approvalMode }
    ];
    for (const b of version.blackouts)
      facts.push({ label: 'Blackout', value: `${this.date(b.startDate)} – ${this.date(b.endDate)}${b.reason ? ` (${b.reason})` : ''}` });
    return facts;
  }

  assignmentLabel(kind: keyof typeof LEAVE_POLICY_SOURCE_LABELS, name: string): string {
    return `${LEAVE_POLICY_SOURCE_LABELS[kind]}: ${name}`;
  }

  date(iso: string): string {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
