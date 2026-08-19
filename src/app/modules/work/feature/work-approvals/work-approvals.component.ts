import { Component, OnInit, inject } from '@angular/core';
import { WorkApprovalsStore } from '../../state/work-approvals.store';
import { ApprovalItem } from '../../models/approval.model';
import { ApprovalRequestRowComponent } from '../../ui/approval-request-row/approval-request-row.component';

@Component({
  selector: 'app-work-approvals',
  standalone: true,
  imports: [ApprovalRequestRowComponent],
  template: `
    @if (store.loading()) {
      <p>Loading approvals…</p>
    } @else if (store.error() && store.pendingCount() === 0) {
      <p class="work-approvals__error">{{ store.error() }}</p>
    } @else {
      <div class="work-approvals">
        <section>
          <h2>Task Creation Requests</h2>
          @for (item of store.taskCreationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item)"
              (rejected)="onReject(item, $event)"
            />
          } @empty {
            <p class="work-approvals__empty">No pending task creation requests.</p>
          }
        </section>

        <section>
          <h2>Allocation Requests</h2>
          @for (item of store.allocationRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              [inlineError]="activeErrorFor(item)"
              (approved)="onApprove(item)"
              (rejected)="onReject(item, $event)"
            />
          } @empty {
            <p class="work-approvals__empty">No pending allocation requests.</p>
          }
        </section>

        <section>
          <h2>Objective Change Requests</h2>
          @for (item of store.objectiveChangeRequests(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item)"
              (rejected)="onReject(item, $event)"
            />
          } @empty {
            <p class="work-approvals__empty">No pending objective change requests.</p>
          }
        </section>

        <section>
          <h2>Objective Invitations</h2>
          @for (item of store.objectiveInvitations(); track item.id) {
            <app-approval-request-row
              [item]="item"
              (approved)="onApprove(item)"
              (rejected)="onReject(item, $event)"
            />
          } @empty {
            <p class="work-approvals__empty">No pending invitations.</p>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    .work-approvals {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .work-approvals section {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .work-approvals h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .work-approvals__empty {
      margin: 0;
      font-size: 13px;
      color: var(--color-text-secondary);
    }
    .work-approvals__error {
      color: var(--color-danger);
    }
  `]
})
export class WorkApprovalsComponent implements OnInit {
  protected readonly store = inject(WorkApprovalsStore);
  private lastFailedId: string | null = null;

  ngOnInit(): void {
    void this.store.loadAll();
  }

  activeErrorFor(item: ApprovalItem): string | null {
    if (this.lastFailedId === item.id) return this.store.error();
    return null;
  }

  async onApprove(item: ApprovalItem): Promise<void> {
    this.lastFailedId = null;
    const ok = await this.store.approve(item);
    if (!ok) this.lastFailedId = item.id;
  }

  async onReject(item: ApprovalItem, comment?: string): Promise<void> {
    this.lastFailedId = null;
    await this.store.reject(item, comment);
  }
}
