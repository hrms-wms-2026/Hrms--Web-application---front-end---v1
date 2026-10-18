import { Component, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

/** Reject / Decline (any action that takes a comment): a reason is encouraged but optional. Emits the trimmed reason, or null. */
@Component({
  selector: 'app-inbox-comment-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="closed.emit()">
      <div class="reject-dialog" data-testid="inbox-comment-dialog">
        <p class="reject-dialog__hint">Adding a reason helps the requester understand the decision. It's optional.</p>
        <textarea
          class="reject-dialog__input"
          data-testid="inbox-comment-reason"
          rows="4"
          maxlength="4000"
          placeholder="Reason (optional)"
          [value]="reason()"
          (input)="reason.set($any($event.target).value)"
        ></textarea>
        <div class="reject-dialog__actions">
          <app-button variant="secondary" data-testid="inbox-comment-cancel" (pressed)="closed.emit()">Cancel</app-button>
          @if (!reason().trim()) {
            <app-button variant="secondary" data-testid="inbox-comment-without-reason" (pressed)="confirmed.emit(null)">
              {{ confirmLabel() }} without reason
            </app-button>
          }
          <app-button variant="primary" data-testid="inbox-comment-confirm" (pressed)="confirm()">{{ confirmLabel() }}</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .reject-dialog { display: flex; flex-direction: column; gap: 12px; }
    .reject-dialog__hint { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
    .reject-dialog__input { width: 100%; min-height: 96px; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; resize: vertical; }
    .reject-dialog__input:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .reject-dialog__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
  `]
})
export class InboxCommentDialogComponent {
  open = input(false);
  title = input('Reject request?');
  confirmLabel = input('Reject');

  confirmed = output<string | null>();
  closed = output<void>();

  protected readonly reason = signal('');

  constructor() {
    // Every opening starts with an empty reason.
    effect(() => {
      if (this.open()) this.reason.set('');
    });
  }

  protected confirm(): void {
    const trimmed = this.reason().trim();
    this.confirmed.emit(trimmed ? trimmed : null);
  }
}
