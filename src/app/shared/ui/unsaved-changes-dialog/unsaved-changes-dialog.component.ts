import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UnsavedChangesService } from '../../services/unsaved-changes.service';
import { ButtonComponent } from '../button/button.component';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.prompt(); as prompt) {
      <app-modal [open]="true" [title]="prompt.canSaveDraft ? 'Save draft?' : 'Discard changes?'" panelClass="unsaved-dialog" (closed)="service.choose('keep')">
        <p class="mb-4 text-sm text-[var(--color-text-secondary)]">
          {{ prompt.canSaveDraft
            ? 'Would you like to save a draft? You can reopen it from the drafts bar at the bottom of the screen.'
            : 'You have unsaved changes. Discard them?' }}
        </p>
        @if (prompt.error) { <p class="mb-4 text-sm text-[var(--color-danger-text)]" role="alert">{{ prompt.error }}</p> }
        <div class="flex items-center gap-2">
          <app-button variant="danger" data-testid="unsaved-discard" [disabled]="prompt.saving" (pressed)="service.choose('discard')">Discard</app-button>
          <span class="flex-1"></span>
          <app-button variant="secondary" data-testid="unsaved-keep" [disabled]="prompt.saving" (pressed)="service.choose('keep')">Keep editing</app-button>
          @if (prompt.canSaveDraft) {
            <app-button variant="primary" data-testid="unsaved-save" [loading]="prompt.saving" (pressed)="service.choose('save')">Save draft</app-button>
          }
        </div>
      </app-modal>
    }
  `
})
export class UnsavedChangesDialogComponent {
  protected readonly service = inject(UnsavedChangesService);
}
