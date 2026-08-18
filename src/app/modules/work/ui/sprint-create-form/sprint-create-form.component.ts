import { Component, inject, input, output, signal } from '@angular/core';
import { SprintListStore } from '../../state/sprint-list.store';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-sprint-create-form',
  standalone: true,
  imports: [InputComponent, ButtonComponent],
  template: `
    <div class="sprint-create-form">
      <app-input label="Name" [value]="newName()" (valueChange)="newName.set($event)" />
      <app-input label="Start date" type="date" [value]="newStart()" (valueChange)="newStart.set($event)" />
      <app-input label="End date" type="date" [value]="newEnd()" (valueChange)="newEnd.set($event)" />

      @if (store.error()) {
        <p class="sprint-create-form__error" role="alert">{{ store.error() }}</p>
      }

      <div class="sprint-create-form__actions">
        <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
        <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save</app-button>
      </div>
    </div>
  `,
  styles: [`
    .sprint-create-form { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; }
    .sprint-create-form__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-create-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class SprintCreateFormComponent {
  protected readonly store = inject(SprintListStore);

  objectiveId = input.required<string>();
  isObjectiveOwner = input.required<boolean>();

  created = output<void>();
  cancelled = output<void>();

  protected readonly newName = signal('');
  protected readonly newStart = signal('');
  protected readonly newEnd = signal('');
  protected readonly submitting = signal(false);

  async submit(): Promise<void> {
    this.submitting.set(true);
    try {
      const ok = await this.store.create(this.objectiveId(), {
        name: this.newName().trim(),
        startDate: this.newStart(),
        endDate: this.newEnd()
      }, !this.isObjectiveOwner());
      if (ok) {
        this.newName.set('');
        this.newStart.set('');
        this.newEnd.set('');
        this.created.emit();
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
