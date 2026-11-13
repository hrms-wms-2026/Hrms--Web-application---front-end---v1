import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DraftsStore } from '../../../shared/state/drafts.store';
import { TaskFormModalComponent } from '../../../modules/work/ui/task-form-modal/task-form-modal.component';
import { AddEmployeeWizardComponent } from '../../../modules/people/feature/add-employee-wizard/add-employee-wizard.component';

/**
 * Global host for draft modals opened from the bottom drafts bar.
 * Renders in-place over whatever screen the user is currently viewing,
 * without navigating to /work/.../backlog or /people/employees.
 */
@Component({
  selector: 'app-draft-modal-host',
  standalone: true,
  imports: [TaskFormModalComponent, AddEmployeeWizardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      @defer keeps the task form (with the rich-text editor) and the add-employee wizard out of the main-layout
      chunk. This host sits in the layout of every page, so a static import cost every page ~800 kB raw JS.
      The chunk now downloads only when a draft is opened from the drafts bar.
    -->
    @if (store.activeDraft(); as draft) {
      @if (draft.kind === 'task') {
        @defer (on immediate) {
          <app-task-form-modal
            [open]="true"
            mode="create"
            [projectId]="draft.projectId ?? ''"
            [draftId]="draft.id"
            (created)="onDone()"
            (saved)="onDone()"
            (closed)="onClose()"
          />
        }
      } @else {
        @defer (on immediate) {
          <app-add-employee-wizard
            [isModal]="true"
            [initialDraftId]="draft.id"
            (closed)="onClose()"
            (saved)="onDone()"
          />
        }
      }
    }
  `
})
export class DraftModalHostComponent {
  protected readonly store = inject(DraftsStore);

  protected onClose(): void {
    this.store.closeDraft();
  }

  protected onDone(): void {
    this.store.closeDraft();
    void this.store.load();
  }
}
