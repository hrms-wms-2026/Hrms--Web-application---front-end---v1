import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="cancelled.emit()">
      <p class="mb-4 text-sm text-[var(--color-text-secondary)]">{{ message() }}</p>
      @if (errorMessage()) {
        <p class="mb-4 text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
      }
      <div class="flex justify-end gap-2">
        <app-button variant="secondary" [disabled]="loading()" (pressed)="cancelled.emit()">
          {{ cancelLabel() }}
        </app-button>
        <app-button variant="primary" [loading]="loading()" (pressed)="confirmed.emit()">
          {{ confirmLabel() }}
        </app-button>
      </div>
    </app-modal>
  `
})
export class ConfirmModalComponent {
  open = input(false);
  title = input<string>('');
  message = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  loading = input(false);
  errorMessage = input<string>('');

  confirmed = output<void>();
  cancelled = output<void>();
}
