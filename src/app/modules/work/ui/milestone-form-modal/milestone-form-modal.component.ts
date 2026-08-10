import { Component, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-milestone-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit milestone" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="title-field">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] ?? ''" (valueChange)="title.set($event)" />
        </span>
        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>
        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>
        <span data-testid="end-date-field">
          <app-input label="End date" type="date" [value]="endDate()" [error]="errors()['endDate'] ?? ''" (valueChange)="endDate.set($event)" />
        </span>
        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save changes</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class MilestoneFormModalComponent {
  open = input(false);
  initialValue = input<ObjectiveDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  submitted = output<EditObjectiveRequestDto>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.title.set(value.title);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.endDate.set(value.endDate);
        this.allocatedHours.set(value.allocatedHours);
      } else {
        this.title.set('');
        this.description.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.allocatedHours.set(0);
      }
      this.errors.set({});
    });
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  submit(): void {
    const errors: Record<string, string> = {};
    if (!this.title().trim()) errors['title'] = 'Title is required.';
    if (!this.startDate()) errors['startDate'] = 'Start date is required.';
    if (!this.endDate()) errors['endDate'] = 'End date is required.';
    else if (this.startDate() && this.endDate() < this.startDate()) errors['endDate'] = 'End date cannot be before the start date.';
    if (this.allocatedHours() < 0) errors['allocatedHours'] = 'Allocated hours cannot be negative.';

    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    this.submitted.emit({
      title: this.title(), description: this.description(),
      startDate: this.startDate(), endDate: this.endDate(), allocatedHours: this.allocatedHours()
    });
  }
}
