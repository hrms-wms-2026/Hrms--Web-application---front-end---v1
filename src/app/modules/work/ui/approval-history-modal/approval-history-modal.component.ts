import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ApprovalHistoryDirection, ApprovalHistoryItemDto } from '../../models/dto/approval-history.dto';

type HistoryFilter = 'all' | ApprovalHistoryDirection;

@Component({
  selector: 'app-approval-history-modal',
  standalone: true,
  imports: [DatePipe, ModalComponent, ButtonComponent],
  template: `
    <app-modal
      data-testid="approval-history-modal"
      [open]="open()"
      title="Approval history"
      size="xl"
      (closed)="closed.emit()"
    >
      <div class="approval-history__filters" role="group" aria-label="Filter approval history">
        @for (option of filters; track option.value) {
          <button
            type="button"
            class="approval-history__filter"
            [class.approval-history__filter--active]="filter() === option.value"
            [attr.aria-pressed]="filter() === option.value"
            (click)="filter.set(option.value)"
          >
            {{ option.label }}
            <span>{{ countFor(option.value) }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <div class="approval-history__state" aria-live="polite">Loading approval history…</div>
      } @else if (error()) {
        <div class="approval-history__state approval-history__state--error" role="alert">
          <p>{{ error() }}</p>
          <app-button size="sm" variant="secondary" (pressed)="retry.emit()">Try again</app-button>
        </div>
      } @else if (filteredItems().length === 0) {
        <div class="approval-history__state">
          <p>No {{ filter() === 'all' ? '' : filter() }} approval history yet.</p>
        </div>
      } @else {
        <div class="approval-history__list">
          @for (item of filteredItems(); track item.kind + '-' + item.id) {
            <article class="approval-history__item" [attr.data-testid]="'approval-history-' + item.id">
              <div class="approval-history__item-main">
                <div class="approval-history__eyebrow">
                  <span class="approval-history__direction">{{ item.direction === 'sent' ? 'Sent' : 'Received' }}</span>
                  <span>{{ kindLabel(item.kind) }}</span>
                </div>
                <h3>{{ item.subjectTitle }}</h3>
                @if (item.detail) {
                  <p class="approval-history__detail">{{ item.detail }}</p>
                }
                <p class="approval-history__people">
                  Requested by <strong>{{ item.requestedByName }}</strong>
                  <span aria-hidden="true">→</span>
                  Sent to <strong>{{ item.approverName }}</strong>
                </p>
                @if (item.decisionComment) {
                  <p class="approval-history__comment">“{{ item.decisionComment }}”</p>
                }
                <p class="approval-history__date">
                  Requested {{ item.createdAt | date: 'MMM d, y, h:mm a' }}
                  @if (item.decidedAt) {
                    <span> · Actioned {{ item.decidedAt | date: 'MMM d, y, h:mm a' }}</span>
                  }
                </p>
              </div>
              <div class="approval-history__outcome">
                <span class="approval-history__status" [class]="'approval-history__status approval-history__status--' + statusTone(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
                <span class="approval-history__actor">{{ actorLabel(item) }}</span>
              </div>
            </article>
          }
        </div>
      }
    </app-modal>
  `,
  styles: [`
    .approval-history__filters { display: flex; gap: 6px; margin-bottom: 18px; padding: 4px; border-radius: 10px; background: var(--color-surface-secondary); width: fit-content; }
    .approval-history__filter { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 0; border-radius: 7px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 13px; cursor: pointer; }
    .approval-history__filter span { display: inline-flex; min-width: 20px; height: 20px; align-items: center; justify-content: center; border-radius: 999px; background: color-mix(in srgb, var(--color-border) 65%, transparent); font-size: 11px; }
    .approval-history__filter--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 3px rgb(15 23 42 / .1); }
    .approval-history__state { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--color-text-secondary); text-align: center; }
    .approval-history__state--error { color: var(--color-danger-text); }
    .approval-history__list { display: flex; flex-direction: column; gap: 10px; }
    .approval-history__item { display: flex; justify-content: space-between; align-items: flex-start; gap: 22px; padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .approval-history__item-main { min-width: 0; }
    .approval-history__eyebrow { display: flex; gap: 8px; align-items: center; margin-bottom: 5px; color: var(--color-text-secondary); font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: .04em; }
    .approval-history__direction { color: var(--color-accent); }
    .approval-history__item h3 { margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 650; }
    .approval-history__detail, .approval-history__people, .approval-history__comment, .approval-history__date { margin: 5px 0 0; font-size: 12px; line-height: 1.45; color: var(--color-text-secondary); }
    .approval-history__people { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .approval-history__people strong { color: var(--color-text-primary); font-weight: 600; }
    .approval-history__comment { color: var(--color-text-primary); font-style: italic; }
    .approval-history__date { font-size: 11px; }
    .approval-history__outcome { display: flex; flex: 0 0 150px; flex-direction: column; align-items: flex-end; gap: 7px; text-align: right; }
    .approval-history__status { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 11px; font-weight: 700; }
    .approval-history__status--pending { background: #fef3c7; color: #92400e; }
    .approval-history__status--success { background: #dcfce7; color: #166534; }
    .approval-history__status--danger { background: #fee2e2; color: #991b1b; }
    .approval-history__status--neutral { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .approval-history__actor { color: var(--color-text-secondary); font-size: 11px; line-height: 1.35; }
    @media (max-width: 680px) { .approval-history__filters { width: 100%; } .approval-history__filter { flex: 1; justify-content: center; } .approval-history__item { flex-direction: column; } .approval-history__outcome { flex-basis: auto; align-items: flex-start; text-align: left; } }
  `]
})
export class ApprovalHistoryModalComponent {
  open = input(false);
  items = input<readonly ApprovalHistoryItemDto[]>([]);
  loading = input(false);
  error = input<string | null>(null);
  closed = output<void>();
  retry = output<void>();

  protected readonly filter = signal<HistoryFilter>('all');
  protected readonly filters: readonly { value: HistoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'received', label: 'Received' },
    { value: 'sent', label: 'Sent' }
  ];
  protected readonly filteredItems = computed(() => {
    const filter = this.filter();
    return filter === 'all' ? this.items() : this.items().filter(item => item.direction === filter);
  });

  protected countFor(filter: HistoryFilter): number {
    return filter === 'all' ? this.items().length : this.items().filter(item => item.direction === filter).length;
  }

  protected kindLabel(kind: string): string {
    const labels: Record<string, string> = {
      task_creation: 'Task creation',
      task_edit: 'Task edit',
      allocation_extend: 'Allocation request',
      objective_edit: 'Module edit',
      objective_change: 'Module change',
      objective_invitation: 'Module invitation'
    };
    return labels[kind] ?? 'Approval request';
  }

  protected statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      accepted: 'Accepted',
      declined: 'Declined',
      cancelled: 'Cancelled',
      expired: 'Expired'
    };
    return labels[status] ?? status;
  }

  protected statusTone(status: string): 'pending' | 'success' | 'danger' | 'neutral' {
    if (status === 'pending') return 'pending';
    if (status === 'approved' || status === 'accepted') return 'success';
    if (status === 'rejected' || status === 'declined') return 'danger';
    return 'neutral';
  }

  protected actorLabel(item: ApprovalHistoryItemDto): string {
    if (item.status === 'pending') return `Awaiting ${item.approverName}`;
    if (item.decidedByName) return `Action by ${item.decidedByName}`;
    return 'No action recorded';
  }
}
