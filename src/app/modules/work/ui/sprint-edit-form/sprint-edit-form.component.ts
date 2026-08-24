import { Component, effect, inject, input, output, signal } from '@angular/core';
import { SprintListStore } from '../../state/sprint-list.store';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Sprint } from '../../models/sprint.model';

@Component({
  selector: 'app-sprint-edit-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit sprint" (closed)="cancelled.emit()">
      <div class="sprint-edit-form">
        <app-input label="Name" [value]="name()" (valueChange)="name.set($event)" />
        <app-input label="Start date" type="date" [value]="startDate()" (valueChange)="startDate.set($event)" />
        <app-input label="End date" type="date" [value]="endDate()" (valueChange)="endDate.set($event)" />

        @if (store.error()) {
          <p class="sprint-edit-form__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-edit-form__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-edit-form { display: flex; flex-direction: column; gap: 8px; }
    .sprint-edit-form__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-edit-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class SprintEditFormComponent {
  protected readonly store = inject(SprintListStore);

  open = input(false);
  objectiveId = input.required<string>();
  sprint = input<Sprint | null>(null);

  saved = output<void>();
  cancelled = output<void>();

  protected readonly name = signal('');
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly submitting = signal(false);

  constructor() {
    // Track `open()` alongside `sprint()` so the form re-seeds every time the modal transitions to
    // open, even when the same sprint object reference is reopened (Object.is would otherwise
    // suppress the effect and leave an abandoned edit sitting in the form) - mirrors
    // TaskDetailModalComponent's reset pattern.
    effect(() => {
      this.open();
      const s = this.sprint();
      this.name.set(s?.name ?? '');
      this.startDate.set(s ? s.startDate.toISOString().slice(0, 10) : '');
      this.endDate.set(s ? s.endDate.toISOString().slice(0, 10) : '');
    });
  }

  async submit(): Promise<void> {
    const sprint = this.sprint();
    if (!sprint) return;

    this.submitting.set(true);
    try {
      const ok = await this.store.edit(sprint.id, {
        name: this.name().trim(),
        startDate: this.startDate(),
        endDate: this.endDate()
      }, this.objectiveId(), false);
      if (ok) {
        this.saved.emit();
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
