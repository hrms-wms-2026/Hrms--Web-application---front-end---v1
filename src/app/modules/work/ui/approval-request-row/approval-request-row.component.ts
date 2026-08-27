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
        <p class="approval-row__title">{{ item().title }}</p>
        <p class="approval-row__description">{{ item().description }}</p>
        <p class="approval-row__meta">
          @if (item().requestedByName) {
            <span>{{ item().requestedByName }} · </span>
          }
          <span>{{ item().createdAt | date: 'MMM d, y' }}</span>
        </p>
        @if (item().kind === 'allocation_extend') {
          <label class="approval-row__hours-label">
            Granted additional hours
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
    .approval-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: 10px;
      background: var(--color-surface);
    }
    .approval-row__title {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .approval-row__description,
    .approval-row__meta {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .approval-row__hours-label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 10px;
      font-size: 12px;
      color: var(--color-text-secondary);
    }
    .approval-row__hours-input {
      width: 9rem;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 6px 8px;
      background: var(--color-surface);
      color: var(--color-text-primary);
      font-size: 13px;
    }
    .approval-row__actions {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      flex-shrink: 0;
    }
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
