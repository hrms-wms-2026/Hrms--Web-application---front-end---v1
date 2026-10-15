import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { SELECTABLE_EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

@Component({
  selector: 'app-bulk-employment-type-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Change employment type" (closed)="close()">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-[var(--color-text-secondary)]">Applies to {{ employeeIds().length }} selected employee{{ employeeIds().length === 1 ? '' : 's' }}. Employee numbers and work modes are not changed.</p>
        <app-select label="Employment type" placeholder="Select a type" [options]="options" [value]="code()" (valueChange)="code.set($event)" />
        @if (error(); as message) { <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p> }
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="close()">Cancel</app-button>
          <app-button data-testid="bulk-type-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Apply</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkEmploymentTypeModalComponent {
  private readonly peopleApi = inject(PeopleApiService);

  readonly open = input.required<boolean>();
  readonly employeeIds = input.required<readonly string[]>();
  readonly closed = output<void>();
  readonly completed = output<BulkEmployeeActionResponse>();

  readonly options = [...SELECTABLE_EMPLOYMENT_TYPE_OPTIONS];
  readonly code = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly canSubmit = computed(() => !!this.code() && this.employeeIds().length > 0 && !this.submitting());

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.peopleApi.bulkChangeEmploymentType({ employeeIds: [...this.employeeIds()], employmentTypeCode: this.code() }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.completed.emit(res);
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to change employment type.'));
      }
    });
  }

  close(): void {
    this.code.set('');
    this.error.set(null);
    this.closed.emit();
  }
}
