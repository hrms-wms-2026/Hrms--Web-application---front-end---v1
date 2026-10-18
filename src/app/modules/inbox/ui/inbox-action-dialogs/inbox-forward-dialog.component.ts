import { Component, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { INBOX_DIALOG_STYLES } from './inbox-dialog.styles';

/** "Forward": send the request on to the person the action names (Meta "forwardTo"), with an optional note. */
@Component({
  selector: 'app-inbox-forward-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="'Send to ' + recipient()" (closed)="closed.emit()">
      <div class="idlg" data-testid="inbox-forward-dialog">
        <p class="idlg__hint">Send to {{ recipient() }}. They decide from here, and you stay in the conversation.</p>
        <textarea class="idlg__input" data-testid="inbox-forward-note" rows="3" maxlength="4000" placeholder="Note (optional)"
          [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
        <div class="idlg__actions">
          <app-button variant="secondary" data-testid="inbox-forward-cancel" (pressed)="closed.emit()">Cancel</app-button>
          <app-button variant="primary" data-testid="inbox-forward-confirm" (pressed)="confirm()">Send</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [INBOX_DIALOG_STYLES]
})
export class InboxForwardDialogComponent {
  open = input(false);
  recipient = input('your manager');

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
