import { Component, computed, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { InboxFilterOptionDto } from '../../models/inbox.dto';
import { INBOX_DIALOG_STYLES } from './inbox-dialog.styles';

export interface InboxOutcomeChoice {
  outcome: string;
  comment: string | null;
  leaveTypeId: string | null;
}

export const CONVERT_TO_LEAVE = 'convert_to_leave';

const OUTCOME_LABELS: Record<string, string | undefined> = {
  excused: 'No issue - clear it', confirmed: 'Real issue - keep on record', [CONVERT_TO_LEAVE]: 'Count it as leave',
  approve: 'Approve', reject: 'Reject'
};
const OUTCOME_HINTS: Record<string, string | undefined> = {
  excused: 'There was a valid reason (e.g. a camera or lighting problem, an agreed absence). It will not count against the employee.',
  confirmed: "The problem is real. The case is closed, but it stays on the employee's record and counts against them.",
  [CONVERT_TO_LEAVE]: 'Records an approved leave for the day instead.',
  approve: 'The request is approved again.',
  reject: 'The request is rejected; a reason is required.'
};

/** "Resolve": pick one of the action's outcomes (Meta "outcomes"); convert-to-leave also needs a leave type. */
@Component({
  selector: 'app-inbox-outcome-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, SelectComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <div class="idlg" data-testid="inbox-outcome-dialog">
        @if (outcomes().includes('confirmed')) { <p class="idlg__question">What did you find?</p> }
        <div class="idlg__options" role="radiogroup" aria-label="Outcome">
          @for (o of outcomes(); track o) {
            <button type="button" class="idlg__option" role="radio" [attr.aria-checked]="outcome() === o" [attr.data-testid]="'inbox-outcome-' + o"
              (click)="outcome.set(o)">
              <span class="idlg__option-dot" aria-hidden="true"></span>
              <span class="idlg__option-text">
                <span class="idlg__option-label">{{ label(o) }}</span>
                @if (hint(o)) { <span class="idlg__option-hint">{{ hint(o) }}</span> }
              </span>
            </button>
          }
        </div>
        @if (outcome() === convert) {
          <app-select data-testid="inbox-outcome-leave-type" label="Leave type" placeholder="Choose a leave type"
            [options]="leaveTypes()" [value]="leaveTypeId() ?? ''" (valueChange)="leaveTypeId.set($event || null)" />
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
  styles: [INBOX_DIALOG_STYLES, `
    .idlg__question { margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 600; }
    .idlg__options { display: flex; flex-direction: column; gap: 8px; }
    .idlg__option { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .idlg__option:hover { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .idlg__option[aria-checked="true"] { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 8%, transparent); }
    .idlg__option:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .idlg__option-dot { flex: none; width: 16px; height: 16px; margin-top: 1px; border: 2px solid var(--color-border); border-radius: 50%; }
    .idlg__option[aria-checked="true"] .idlg__option-dot { border-color: var(--color-accent); box-shadow: inset 0 0 0 3px var(--color-surface); background: var(--color-accent); }
    .idlg__option-text { display: flex; flex-direction: column; gap: 2px; }
    .idlg__option-label { font-size: 13px; font-weight: 600; }
    .idlg__option-hint { color: var(--color-text-secondary); font-size: 12px; line-height: 1.45; }
  `]
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
