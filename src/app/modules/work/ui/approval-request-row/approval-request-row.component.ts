import { DatePipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ApprovalItem } from '../../models/approval.model';
import { EditObjectiveRequestPayloadDto } from '../../models/dto/allocation-request.dto';

@Component({
  selector: 'app-approval-request-row',
  standalone: true,
  imports: [ButtonComponent, DatePipe, DatePickerComponent],
  template: `
    <article class="approval-row" [attr.data-testid]="'approval-row-' + item().id">
      <div class="approval-row__main">
        <div class="approval-row__context">
          <h3>{{ item().targetTitle || item().title }}</h3>
          <p class="approval-row__meta">
            <strong>{{ item().requestedByName || 'Unknown requester' }}</strong>
            @if (item().kind === 'allocation_extend') {
              <span> requested +{{ requestedAdditionalHours() }}h</span>
              @if (item().currentAllocatedHours != null) {
                <span data-testid="allocation-current-hours"> · Current {{ item().currentAllocatedHours }}h</span>
              }
            }
            <span aria-hidden="true"> · </span>
            <span>{{ item().createdAt | date: 'MMM d, y' }}</span>
          </p>
          @if (item().description) {
            <p class="approval-row__details"><span>{{ item().kind === 'allocation_extend' ? 'Reason:' : 'Details:' }}</span> {{ item().description }}</p>
          }
          @if (canViewTarget()) {
            <button type="button" class="approval-row__view" data-testid="view-approval-target"
              (click)="viewRequested.emit(item())">
              {{ viewLabel() }} <span aria-hidden="true">→</span>
            </button>
          }
        </div>

        @if (item().kind === 'allocation_extend') {
          <label class="approval-row__hours-label">
            <span>Approve hours</span>
            <input data-testid="allocation-hours-input" class="approval-row__hours-input" type="number"
              min="0" step="0.25" [value]="approvedHours()"
              (input)="onApprovedHoursInput($any($event.target).value)" />
          </label>
        }

        @if (item().kind === 'objective_edit') {
          <div class="approval-row__edit-fields">
            <label><span>Title</span><input data-testid="edit-title-input" type="text" [value]="editPayload().title" (input)="onEditFieldInput('title', $any($event.target).value)" /></label>
            <label><span>Description</span><textarea data-testid="edit-description-input" rows="2" [value]="editPayload().description ?? ''" (input)="onEditFieldInput('description', $any($event.target).value)"></textarea></label>
            <div class="approval-row__edit-dates">
              <app-date-picker label="Start date" inputTestId="edit-start-date-input" [value]="editPayload().startDate" (valueChange)="onEditFieldInput('startDate', $event)" />
              <app-date-picker label="End date" inputTestId="edit-end-date-input" [value]="editPayload().endDate" (valueChange)="onEditFieldInput('endDate', $event)" />
            </div>
            <label><span>Allocated hours</span><input data-testid="edit-allocated-hours-input" type="number" min="0" step="0.25" [value]="editPayload().allocatedHours" (input)="onEditAllocatedHoursInput($any($event.target).value)" /></label>
          </div>
        }

        <div class="approval-row__actions">
          <app-button variant="primary" (pressed)="onApproveClick()">Approve</app-button>
          <app-button variant="secondary" (pressed)="onRejectClick()">Reject</app-button>
        </div>
      </div>

      @if (inlineError()) {
        <div class="approval-row__feedback">
          <p class="approval-row__error" role="alert">
            {{ inlineError() }}
            @if (item().kind === 'allocation_extend') {
              <button type="button" class="approval-row__link" (click)="requestOwnAllocation.emit()">Request more allocation for my objective</button>
            }
          </p>
        </div>
      }
      @if (showRejectComment()) {
        <div class="approval-row__feedback">
          <textarea class="approval-row__comment" [value]="rejectComment()" (input)="rejectComment.set($any($event.target).value)" placeholder="Rejection comment (required)" rows="2"></textarea>
        </div>
      }

    </article>
  `,
  styles: [`
    .approval-row { border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .approval-row__main { display: flex; align-items: center; gap: 18px; min-height: 76px; padding: 12px 16px; }
    .approval-row__context { min-width: 0; }
    .approval-row__context { flex: 1 1 360px; }
    .approval-row__context h3 { margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 650; line-height: 1.3; }
    .approval-row__meta { margin: 4px 0 0; color: var(--color-text-secondary); font-size: 11px; }
    .approval-row__meta strong { color: var(--color-text-primary); font-weight: 620; }
    .approval-row__details { margin: 4px 0 0; color: var(--color-text-secondary); font-size: 11px; line-height: 1.35; }
    .approval-row__details span { color: var(--color-text-primary); font-weight: 600; }
    .approval-row__view { margin-top: 5px; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 11px; font-weight: 650; cursor: pointer; }
    .approval-row__hours-label { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; color: var(--color-text-secondary); font-size: 11px; }
    .approval-row__hours-input { width: 76px; height: 34px; border: 1px solid var(--color-border); border-radius: 7px; padding: 5px 8px; background: var(--color-surface); color: var(--color-text-primary); font-size: 13px; }
    .approval-row__edit-fields { display: flex; flex: 1 1 360px; flex-direction: column; gap: 6px; min-width: 260px; }
    .approval-row__edit-fields label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--color-text-secondary); }
    .approval-row__edit-fields input, .approval-row__edit-fields textarea { border: 1px solid var(--color-border); border-radius: 7px; padding: 5px 8px; background: var(--color-surface); color: var(--color-text-primary); font-size: 13px; font-family: inherit; }
    .approval-row__edit-dates { display: flex; gap: 8px; }
    .approval-row__edit-dates app-date-picker { flex: 1; }
    .approval-row__feedback { padding: 0 16px 12px; }
    .approval-row__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .approval-row__actions app-button { min-width: 84px; }
    .approval-row__error { margin: 0; font-size: 12px; color: var(--color-danger-text); }
    .approval-row__link { display: inline; margin-left: 4px; padding: 0; border: none; background: none; color: var(--color-danger); text-decoration: underline; cursor: pointer; }
    .approval-row__comment { width: 100%; border: 1px solid var(--color-border); border-radius: 8px; padding: 8px; background: var(--color-surface); color: var(--color-text-primary); font-size: 13px; }
    @media (max-width: 760px) { .approval-row__main { align-items: stretch; flex-direction: column; gap: 10px; } .approval-row__hours-label { justify-content: space-between; } .approval-row__actions { width: 100%; } .approval-row__actions app-button { flex: 1; min-width: 0; } }
  `]
})
export class ApprovalRequestRowComponent {
  item = input.required<ApprovalItem>();
  inlineError = input<string | null>(null);
  approved = output<number | EditObjectiveRequestPayloadDto | undefined>();
  rejected = output<string | undefined>();
  requestOwnAllocation = output<void>();
  viewRequested = output<ApprovalItem>();

  protected readonly showRejectComment = signal(false);
  protected readonly rejectComment = signal('');
  private readonly editedApprovedHours = signal<number | undefined>(undefined);
  protected readonly approvedHours = computed(() => this.editedApprovedHours() ?? this.requestedAdditionalHours());
  private readonly editedEditPayload = signal<EditObjectiveRequestPayloadDto | null>(null);
  protected readonly editPayload = computed<EditObjectiveRequestPayloadDto>(() => this.editedEditPayload() ?? this.requestedEditPayload());

  protected requestedAdditionalHours(): number {
    const raw = this.item().raw;
    if ('payload' in raw && raw.payload && 'requestedAdditionalHours' in raw.payload) return raw.payload.requestedAdditionalHours;
    return 0;
  }

  protected canViewTarget(): boolean {
    return Boolean(this.item().targetId && (this.item().targetType === 'task' || this.item().targetType === 'module'));
  }

  protected viewLabel(): string {
    return this.item().targetType === 'task' ? 'View task details' : 'Open module';
  }

  private requestedEditPayload(): EditObjectiveRequestPayloadDto {
    const raw = this.item().raw;
    if ('payload' in raw && raw.payload && 'title' in raw.payload && 'startDate' in raw.payload) return raw.payload as EditObjectiveRequestPayloadDto;
    return { title: '', description: null, startDate: '', endDate: '', allocatedHours: 0 };
  }

  onApprovedHoursInput(value: string): void {
    const parsed = Number(value);
    this.editedApprovedHours.set(Number.isFinite(parsed) ? parsed : 0);
  }

  onEditFieldInput(field: 'title' | 'description' | 'startDate' | 'endDate', value: string): void {
    this.editedEditPayload.set({ ...this.editPayload(), [field]: field === 'description' ? (value.trim() ? value : null) : value });
  }

  onEditAllocatedHoursInput(value: string): void {
    const parsed = Number(value);
    this.editedEditPayload.set({ ...this.editPayload(), allocatedHours: Number.isFinite(parsed) ? parsed : 0 });
  }

  onApproveClick(): void {
    if (this.item().kind === 'allocation_extend') { this.approved.emit(this.approvedHours()); return; }
    if (this.item().kind === 'objective_edit') { this.approved.emit(this.editPayload()); return; }
    this.approved.emit(undefined);
  }

  private requiresRejectComment(): boolean {
    const kind = this.item().kind;
    return kind === 'work_approval';
  }

  onRejectClick(): void {
    if (this.requiresRejectComment() && !this.showRejectComment()) { this.showRejectComment.set(true); return; }
    if (this.requiresRejectComment() && !this.rejectComment().trim()) return;
    this.rejected.emit(this.requiresRejectComment() ? this.rejectComment().trim() : undefined);
  }
}
