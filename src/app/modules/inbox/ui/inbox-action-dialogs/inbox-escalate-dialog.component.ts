import { Component, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { INBOX_DIALOG_STYLES } from './inbox-dialog.styles';

/** "Escalate": a note plus where it goes. `escalateTo` (action Meta): a name, "" = no one above (logged only),
 *  null = the provider does not preview the target. */
@Component({
  selector: 'app-inbox-escalate-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Escalate" (closed)="closed.emit()">
      <div class="idlg" data-testid="inbox-escalate-dialog">
        <p class="idlg__target" data-testid="inbox-escalate-target">
          @if (escalateTo() === null) {
            It goes to the next person up the chain, who joins the conversation. At the top it is logged.
          } @else if (escalateTo()) {
            Goes to <strong>{{ escalateTo() }}</strong>, who joins the conversation.
          } @else {
            No one above – this will be logged.
          }
        </p>
        <textarea class="idlg__input" data-testid="inbox-escalate-note" rows="3" maxlength="4000" placeholder="Why are you escalating? (optional)"
          [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
        <div class="idlg__actions">
          <app-button variant="secondary" data-testid="inbox-escalate-cancel" (pressed)="closed.emit()">Cancel</app-button>
          <app-button variant="primary" data-testid="inbox-escalate-confirm" (pressed)="confirm()">Escalate</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [INBOX_DIALOG_STYLES]
})
export class InboxEscalateDialogComponent {
  open = input(false);
  escalateTo = input<string | null>(null);

  confirmed = output<string | null>();
  closed = output<void>();

  protected readonly note = signal('');

  constructor() {
    effect(() => {
      if (this.open()) this.note.set('');
    });
  }

  protected confirm(): void {
    const note = this.note().trim();
    this.confirmed.emit(note || null);
  }
}
