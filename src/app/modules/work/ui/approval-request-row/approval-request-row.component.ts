import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ApprovalItem } from '../../models/approval.model';

@Component({
  selector: 'app-approval-request-row',
  standalone: true,
  imports: [ButtonComponent, DatePipe],
  template: `
    <div class="approval-row" [attr.data-testid]="'approval-row-' + item().id">
      <div class="approval-row__body">
        <div class="approval-row__copy">
          <p class="approval-row__title">{{ item().title }}</p>
          @if (item().description) {
            <p class="approval-row__description">{{ item().description }}</p>
          }
          <p class="approval-row__meta">
            @if (item().requestedByName) {
              <span>{{ item().requestedByName }} · </span>
            }
            <span>{{ item().createdAt | date: 'MMM d, y' }}</span>
          </p>
        </div>
        @if (item().kind === 'allocation_extend') {
          <label class="approval-row__hours-label">
            <span>Granted additional hours</span>
            <input
              data-testid="allocation-hours-input"
              class="approval-row__hours-input"
              type="number"
              min="0"
              step="0.25"
              [value]="approvedHours()"
              (input)="onApprovedHoursInput($any($event.target).value)"
            />
          </label>
        }
        @if (inlineError()) {
          <p class="approval-row__error" role="alert">
            {{ inlineError() }}
            @if (item().kind === 'allocation_extend') {
              <!-- TODO: wire POST /objectives/{myOwnObjectiveId}/allocation-requests once caller objective lookup exists -->
              <button type="button" class="approval-row__link" (click)="requestOwnAllocation.emit()">
                Request more allocation for my objective
              </button>
            }
          </p>
        }
        @if (showRejectComment()) {
          <textarea
            class="approval-row__comment"
            [value]="rejectComment()"
            (input)="rejectComment.set($any($event.target).value)"
            placeholder="Rejection comment (required)"
            rows="2"
          ></textarea>
        }
      </div>
      <div class="approval-row__actions">
        <app-button variant="primary" (pressed)="onApproveClick()">Approve</app-button>
        <app-button variant="secondary" (pressed)="onRejectClick()">Reject</app-button>
      </div>
    </div>
  `,
  styles: [`
    .approval-row { display: flex; align-items: center; justify-content: space-between; gap: 22px; min-height: 74px; padding: 10px 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 2px 8px rgb(15 23 42 / .035); transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
    .approval-row:hover { border-color: color-mix(in srgb, var(--color-accent) 35%, var(--color-border)); box-shadow: 0 6px 16px rgb(15 23 42 / .07); transform: translateY(-1px); }
    .approval-row__body { display: flex; align-items: center; flex: 1; min-width: 0; gap: 28px; }
    .approval-row__copy { min-width: 0; }
    .approval-row__title { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .approval-row__description, .approval-row__meta { margin: 3px 0 0; font-size: 12px; color: var(--color-text-secondary); line-height: 1.35; }
    .approval-row__meta { font-size: 11px; }
    .approval-row__hours-label { display: flex; align-items: center; gap: 10px; margin: 0; flex: 0 0 auto; font-size: 11px; color: var(--color-text-secondary); white-space: nowrap; }
    .approval-row__hours-input { width: 8rem; height: 34px; border: 1px solid var(--color-border); border-radius: 7px; padding: 5px 8px; background: var(--color-surface); color: var(--color-text-primary); font-size: 13px; }
    .approval-row__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .approval-row__actions app-button { min-width: 84px; }
    @media (max-width: 760px) { .approval-row { align-items: stretch; flex-direction: column; gap: 10px; padding: 12px; } .approval-row__body { align-items: flex-start; flex-wrap: wrap; gap: 10px 18px; } .approval-row__hours-label { width: 100%; justify-content: space-between; } .approval-row__actions { width: 100%; } .approval-row__actions app-button { flex: 1; min-width: 0; } }
    .approval-row__error {
      margin-top: 8px;
      font-size: 12px;
      color: var(--color-danger-text);
    }
    .approval-row__link {
      display: inline;
      margin-left: 4px;
      padding: 0;
      border: none;
      background: none;
      color: var(--color-danger);
      text-decoration: underline;
      cursor: pointer;
    }
    .approval-row__comment {
      margin-top: 8px;
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 8px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: 13px;
    }
  `]
})
export class ApprovalRequestRowComponent {
  item = input.required<ApprovalItem>();
  inlineError = input<string | null>(null);

  approved = output<number | undefined>();
  rejected = output<string | undefined>();
  requestOwnAllocation = output<void>();

  protected readonly showRejectComment = signal(false);
  protected readonly rejectComment = signal('');
  private readonly editedApprovedHours = signal<number | undefined>(undefined);
  protected readonly approvedHours = computed(() =>
    this.editedApprovedHours() ?? this.requestedAdditionalHours()
  );

  protected requestedAdditionalHours(): number {
    const raw = this.item().raw;
    if ('payload' in raw && 'requestedAdditionalHours' in raw.payload) {
      return raw.payload.requestedAdditionalHours;
    }
    return 0;
  }

  onApprovedHoursInput(value: string): void {
    const parsed = Number(value);
    this.editedApprovedHours.set(Number.isFinite(parsed) ? parsed : 0);
  }

  onApproveClick(): void {
    if (this.item().kind === 'allocation_extend') {
      this.approved.emit(this.approvedHours());
      return;
    }
    this.approved.emit(undefined);
  }

  onRejectClick(): void {
    if (this.item().kind === 'task_creation' && !this.showRejectComment()) {
      this.showRejectComment.set(true);
      return;
    }
    if (this.item().kind === 'task_creation' && !this.rejectComment().trim()) {
      return;
    }
    this.rejected.emit(this.item().kind === 'task_creation' ? this.rejectComment().trim() : undefined);
  }
}
