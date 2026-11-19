import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { SubmitLeaveRequestRequest } from '../../../leave/models/leave-request.model';
import { LeaveBalanceStore } from '../../../leave/state/leave-balance.store';
import { LeaveRequestStore } from '../../../leave/state/leave-request.store';
import { LeaveTypeStore } from '../../../leave/state/leave-type.store';
import { CreateSlot } from './planner-create-draft';

/** What the Time off tab held, for the full leave request form ("More options"). */
export interface TimeOffDraft { leaveTypeId: string; startIso: string; endIso: string; reason: string | null; }

/**
 * Time off tab of the Planner create popover: a leave request for the picked time, through the same stores (policy
 * preview, submit) as the leave form. A type that needs a supporting document for this length goes to the full form,
 * which has the upload.
 */
@Component({
  selector: 'app-planner-time-off-tab',
  standalone: true,
  imports: [SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2 text-sm">
      <app-select data-testid="time-off-type" ariaLabel="Leave type" placeholder="Choose a leave type" searchPlaceholder="Search leave types"
        [options]="typeOptions()" [value]="leaveTypeId()" (valueChange)="chooseType($event)" />
      <p data-testid="time-off-range" class="text-xs">From {{ slot().date }} {{ startClock() }} · To {{ slot().date }} {{ endClock() }}</p>
      <textarea data-testid="time-off-reason" class="ui-input" rows="2" placeholder="Reason" [value]="reason() ?? ''"
        (input)="reason.set($any($event.target).value || null)"></textarea>
      @if (requests.previewing()) {
        <p class="text-xs text-[var(--color-text-secondary)]">Checking the policy…</p>
      } @else if (requests.previewError(); as error) {
        <p data-testid="time-off-preview-error" class="text-xs text-[var(--color-danger)]">{{ error }}</p>
      } @else if (previewText(); as text) {
        <p data-testid="time-off-preview" class="rounded-md bg-[var(--color-accent-subtle)] px-2 py-1 text-xs" [class.text-[var(--color-warning-text)]]="overBalance()">{{ text }}</p>
      }
      @if (needsDocument()) {
        <p data-testid="time-off-document-note" class="text-xs text-[var(--color-warning-text)]">This leave needs a supporting document. Use More options to attach it.</p>
      }
      @if (requests.submitError(); as error) { <p class="text-xs text-[var(--color-danger)]">{{ error }}</p> }
      <p class="text-xs text-[var(--color-text-secondary)]">Shows on your Planner as "Pending leave" until it's approved.</p>
      <div class="flex justify-end gap-2 pt-1">
        <button type="button" data-testid="time-off-more" class="rounded-md border px-3 py-1" (click)="moreOptions.emit(draft())">More options</button>
        <button type="button" data-testid="time-off-submit" class="rounded-md bg-[var(--color-accent)] px-3 py-1 text-[var(--color-text-on-solid)]"
          [disabled]="!canSubmit()" (click)="submit()">Submit request</button>
      </div>
    </div>
  `,
})
export class TimeOffTabComponent implements OnInit {
  readonly requests = inject(LeaveRequestStore);
  private readonly types = inject(LeaveTypeStore);
  private readonly balances = inject(LeaveBalanceStore);

  readonly slot = input.required<CreateSlot>();
  readonly submitted = output<void>();
  readonly moreOptions = output<TimeOffDraft>();

  readonly leaveTypeId = signal('');
  readonly reason = signal<string | null>(null);
  private readonly sending = signal(false);

  readonly activeTypes = computed(() => this.types.items().filter((t) => t.isActive));
  readonly typeOptions = computed<SelectOption[]>(() => this.activeTypes().map((t) => ({ value: t.id, label: this.typeLabel(t.id, t.name) })));
  readonly startClock = computed(() => this.clockOf(this.slot().startMinutes));
  readonly endClock = computed(() => this.clockOf(this.slot().endMinutes));
  readonly hours = computed(() => (Date.parse(this.slot().endIso) - Date.parse(this.slot().startIso)) / 3_600_000);
  readonly needsDocument = computed(() => {
    const type = this.activeTypes().find((t) => t.id === this.leaveTypeId());
    if (!type?.requiresDocument) return false;
    return type.documentRequiredAfterHours === null || this.hours() > type.documentRequiredAfterHours;
  });
  readonly overBalance = computed(() => (this.requests.previewResult()?.exceedsBalanceByHours ?? 0) > 0);
  /** The policy preview: hours, the balance left (or how far over it), and the approvers in their order. */
  readonly previewText = computed(() => {
    const preview = this.requests.previewResult();
    if (!preview) return null;
    const parts = [`${preview.totalHours}h`];
    const over = preview.exceedsBalanceByHours ?? 0;
    if (over > 0) parts.push(`${over}h over your balance`);
    else if (preview.balanceImpact) parts.push(`${preview.balanceImpact.remainingAfterSubmitHours}h left after this`);
    const approvers = [...(preview.approvers ?? [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder).map((a) => a.approverName);
    if (approvers.length > 0) parts.push(`Approved by ${approvers.join(', then ')}`);
    return parts.join(' · ');
  });
  readonly canSubmit = computed(() => !!this.leaveTypeId() && !this.needsDocument() && !this.sending()
    && !this.requests.submitting() && !this.requests.previewing() && !this.requests.previewError());

  ngOnInit(): void {
    this.requests.clearPreview();
    if (this.types.items().length === 0) void this.types.load();
    void this.balances.loadMy(Number(this.slot().date.slice(0, 4)));
  }

  typeLabel(id: string, name: string): string {
    const balance = this.balances.my().find((b) => b.leaveTypeId === id);
    return balance ? `${name} – ${balance.remainingHours} hours remaining` : name;
  }

  chooseType(id: string): void {
    this.leaveTypeId.set(id);
    if (id) void this.requests.preview(this.payload());
  }

  draft(): TimeOffDraft {
    return { leaveTypeId: this.leaveTypeId(), startIso: this.slot().startIso, endIso: this.slot().endIso, reason: this.reason() };
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.sending.set(true);
    try {
      if (await this.requests.submit(this.payload())) this.submitted.emit();
    } finally {
      this.sending.set(false);
    }
  }

  private payload(): SubmitLeaveRequestRequest {
    return { leaveTypeId: this.leaveTypeId(), startAt: this.slot().startIso, endAt: this.slot().endIso, reason: this.reason(), fileRecordIds: [] };
  }

  private clockOf(minutes: number): string {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }
}
