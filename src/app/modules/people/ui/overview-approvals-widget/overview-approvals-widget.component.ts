import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { ApprovalStatus, EmployeeApprovalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { formatShortDate } from '../../utils/employee-overview.utils';
import { createCompareLoader, deltaIf } from '../../utils/overview-compare';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

@Component({
  selector: 'app-overview-approvals-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent],
  template: `
    <app-widget-card
      title="Approval Activity"
      [state]="loader.state()"
      errorMessage="Could not load approval activity."
      emptyMessage="No approval requests in this period."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <p class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]" data-testid="approvals-counts">
          <span><strong class="text-[var(--color-text-primary)]">{{ d.pending }}</strong> Pending <app-delta-badge [delta]="pendingDelta()" [against]="period.compareLabel()" /></span>
          <span><strong class="text-[var(--color-text-primary)]">{{ d.approved }}</strong> Approved <app-delta-badge [delta]="approvedDelta()" [against]="period.compareLabel()" /></span>
          <span><strong class="text-[var(--color-text-primary)]">{{ d.rejected }}</strong> Rejected <app-delta-badge [delta]="rejectedDelta()" [against]="period.compareLabel()" /></span>
        </p>

        <ul class="divide-y divide-[var(--color-border)]">
          @for (item of d.items; track item.id) {
            <li class="flex items-start justify-between gap-3 py-2 text-sm" data-testid="approval-item">
              <div class="min-w-0">
                <p class="font-medium text-[var(--color-text-primary)]">{{ item.label }}</p>
                @if (item.detail) {
                  <p class="truncate text-xs text-[var(--color-text-secondary)]">{{ item.detail }}</p>
                }
                @if (approverNote(item); as note) {
                  <p class="text-xs text-[var(--color-text-secondary)]">{{ note }}</p>
                }
              </div>
              <div class="flex shrink-0 flex-col items-end gap-1">
                <span class="pill" data-testid="approval-status" [class]="'pill--' + item.status">{{ statusLabel(item.status) }}</span>
                <span class="text-xs text-[var(--color-text-secondary)]">{{ shortDate(item.requestedAt) }}</span>
              </div>
            </li>
          }
        </ul>

        @if (d.total > d.items.length) {
          <p class="mt-2 text-xs text-[var(--color-text-secondary)]">Showing the latest {{ d.items.length }} of {{ d.total }}</p>
        }
      }
    </app-widget-card>
  `,
  styles: [`
    .pill { border-radius: 9999px; padding: 0.125rem 0.5rem; font-size: 0.6875rem; font-weight: 600; }
    .pill--pending { background: #fef3c7; color: #92400e; }
    .pill--approved { background: #dcfce7; color: #166534; }
    .pill--rejected { background: #fee2e2; color: #991b1b; }
    .pill--cancelled { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewApprovalsWidgetComponent {
  private readonly api = inject(PeopleApiService);
  readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewApprovals(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.total === 0 }
  );
  readonly compareLoader = createCompareLoader(this.period, (from, to) =>
    this.api.getOverviewApprovals(this.employeeId(), from, to)
  );
  readonly pendingDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.pending, this.compareLoader.data()?.pending, 'neutral')
  );
  readonly approvedDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.approved, this.compareLoader.data()?.approved, 'neutral')
  );
  readonly rejectedDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.rejected, this.compareLoader.data()?.rejected, 'neutral')
  );

  shortDate = formatShortDate;

  statusLabel(status: ApprovalStatus): string {
    return STATUS_LABELS[status];
  }

  /** "Awaiting X" for a pending request, "by X" for a decided one - only when the API names an approver. */
  approverNote(item: EmployeeApprovalItem): string | null {
    if (!item.approverName) return null;
    if (item.status === 'pending') return `Awaiting ${item.approverName}`;
    return item.decidedAt ? `by ${item.approverName}` : null;
  }
}
