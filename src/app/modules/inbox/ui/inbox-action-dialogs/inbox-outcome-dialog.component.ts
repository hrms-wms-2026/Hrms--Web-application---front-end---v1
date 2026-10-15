import { Component, computed, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InboxFilterOptionDto } from '../../models/inbox.dto';
import { INBOX_DIALOG_STYLES } from './inbox-dialog.styles';

export interface InboxOutcomeChoice {
  outcome: string;
  comment: string | null;
  leaveTypeId: string | null;
}

export const CONVERT_TO_LEAVE = 'convert_to_leave';

const OUTCOME_LABELS: Record<string, string> = {
  excused: 'Excused', confirmed: 'Confirmed', [CONVERT_TO_LEAVE]: 'Convert to leave', approve: 'Approve', reject: 'Reject'
};
const OUTCOME_HINTS: Record<string, string> = {
  excused: 'Not held against the employee - it no longer counts.',
  confirmed: 'It stands and keeps counting.',
  [CONVERT_TO_LEAVE]: 'Records an approved leave for the day instead.',
  approve: 'The request is approved again.',
  reject: 'The request is rejected; a reason is required.'
};

/** "Resolve": pick one of the action's outcomes (Meta "outcomes"); convert-to-leave also needs a leave type. */
@Component({
  selector: 'app-inbox-outcome-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <div class="idlg" data-testid="inbox-outcome-dialog">
        <div class="idlg__choices" role="group" aria-label="Outcome">
          @for (o of outcomes(); track o) {
            <button type="button" class="idlg__choice" [attr.aria-pressed]="outcome() === o" [attr.data-testid]="'inbox-outcome-' + o"
              (click)="outcome.set(o)">{{ label(o) }}</button>
          }
        </div>
        @if (outcome(); as o) { <p class="idlg__hint">{{ hint(o) }}</p> }
        @if (outcome() === convert) {
          <label class="idlg__label" for="inbox-outcome-leave-type">Leave type</label>
          <select id="inbox-outcome-leave-type" class="idlg__input" data-testid="inbox-outcome-leave-type"
            [value]="leaveTypeId() ?? ''" (change)="leaveTypeId.set($any($event.target).value || null)">
            <option value="">Choose a leave type</option>
            @for (t of leaveTypes(); track t.value) { <option [value]="t.value">{{ t.label }}</option> }
          </select>
          @if (leaveHint()) { <p class="idlg__hint" data-testid="inbox-outcome-leave-hint">{{ leaveHint() }}</p> }
        }
        <textarea class="idlg__input" data-testid="inbox-outcome-note" rows="3" maxlength="4000" placeholder="Note (optional)"
          [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
        <div class="idlg__actions">
          <app-button variant="secondary" data-testid="inbox-outcome-cancel" (pressed)="closed.emit()">Cancel</app-button>
          <app-button variant="primary" data-testid="inbox-outcome-confirm" [disabled]="!canConfirm()" (pressed)="confirm()">{{ confirmLabel() }}</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [INBOX_DIALOG_STYLES]
})
export class InboxOutcomeDialogComponent {
  open = input(false);
  title = input('Resolve this alert');
  confirmLabel = input('Resolve');
  outcomes = input<readonly string[]>([]);
  leaveTypes = input<readonly InboxFilterOptionDto[]>([]);
  /** Shown under the leave type select (e.g. the balance hint). */
  leaveHint = input<string | null>(null);

  confirmed = output<InboxOutcomeChoice>();
  closed = output<void>();

  protected readonly convert = CONVERT_TO_LEAVE;
  protected readonly outcome = signal<string | null>(null);
  protected readonly leaveTypeId = signal<string | null>(null);
  protected readonly note = signal('');
  protected readonly canConfirm = computed(() => !!this.outcome() && (this.outcome() !== CONVERT_TO_LEAVE || !!this.leaveTypeId()));

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.outcome.set(null);
      this.leaveTypeId.set(null);
      this.note.set('');
    });
  }

  protected label(outcome: string): string {
    return OUTCOME_LABELS[outcome] ?? outcome.charAt(0).toUpperCase() + outcome.slice(1).replace(/_/g, ' ');
  }

  protected hint(outcome: string): string {
    return OUTCOME_HINTS[outcome] ?? '';
  }

  protected confirm(): void {
    const outcome = this.outcome();
    if (!outcome || !this.canConfirm()) return;
    const note = this.note().trim();
    this.confirmed.emit({ outcome, comment: note || null, leaveTypeId: outcome === CONVERT_TO_LEAVE ? this.leaveTypeId() : null });
  }
}
