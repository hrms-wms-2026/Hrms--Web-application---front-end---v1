import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { EmployeeDetailJobInformation, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { PeopleApiService } from '../../data-access/people-api.service';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import {
  EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE,
  EMPLOYEE_NUMBER_IN_USE_MESSAGE,
  EMPLOYEE_NUMBER_MAX_LENGTH,
  isValidEmployeeNumberFormat,
  normalizeEmployeeNumber
} from '../../utils/employee-number.utils';

/** Same 4 values as add-employee-wizard.component.ts's EMPLOYMENT_TYPE_OPTIONS. */
const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' }
];

@Component({
  selector: 'app-employee-job-info',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent, CustomSelectComponent],
  template: `
    <div>
      @if (showHeader()) {
        <div class="flex items-center justify-between pb-3 mb-4 border-b border-[var(--color-border)]">
          <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">
            Job & Organizational Details
          </h3>
          @if (canEdit() && !isEditing()) {
            <app-button data-testid="edit-job-details" variant="secondary" size="sm" (pressed)="startEdit()">
              Edit
            </app-button>
          }
        </div>
      }

      @if (isEditing()) {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-6">
            <app-input
              label="Employee number"
              [maxlength]="employeeNumberMaxLength"
              [value]="form.controls.employeeNumber.value"
              (valueChange)="onEmployeeNumberChange($event)"
              [error]="employeeNumberFieldError()"
              [hint]="employeeNumberFieldHint()"
            />
            <app-custom-select
              label="Employment Type"
              placeholder="Select employment type"
              [options]="employmentTypeOptions"
              [value]="form.controls.employmentTypeCode.value"
              [error]="submitAttempted() && form.controls.employmentTypeCode.invalid ? 'Employment type is required.' : ''"
              (valueChange)="form.controls.employmentTypeCode.setValue($event)"
            />
            <app-custom-select
              label="Work Mode"
              placeholder="Select a work mode"
              [options]="workModeOptions()"
              [value]="form.controls.workModeId.value"
              (valueChange)="form.controls.workModeId.setValue($event)"
            />
          </div>
          <div class="flex gap-2">
            <app-button data-testid="save-job-details" type="submit" [loading]="saving()" [disabled]="saving()">
              {{ saving() ? 'Saving…' : 'Save' }}
            </app-button>
            <app-button data-testid="cancel-job-details" variant="secondary" type="button" (pressed)="cancelEdit()">
              Cancel
            </app-button>
          </div>
        </form>
      } @else if (showReadView()) {
        <dl class="grid grid-cols-1 @xs:grid-cols-2 @2xl:grid-cols-4 gap-6 text-sm">
          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Employee Number</dt>
            <dd class="font-semibold text-[var(--color-text-primary)] font-mono text-xs bg-[var(--color-surface-secondary)] px-2.5 py-1 rounded-md inline-block">
              {{ jobInformation().employeeNumber }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Position</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().positionName || 'Unassigned' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Department</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().departmentName || 'Unassigned' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Company</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().legalEntityName || '—' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Employment Type</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().employmentTypeLabel }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Status</dt>
            <dd class="inline-flex items-center gap-1.5 font-semibold text-xs capitalize px-2.5 py-1 rounded-full"
                [class.bg-green-100]="jobInformation().status.toLowerCase() === 'active'"
                [class.text-green-800]="jobInformation().status.toLowerCase() === 'active'"
                [class.bg-red-100]="jobInformation().status.toLowerCase() === 'inactive'"
                [class.text-red-800]="jobInformation().status.toLowerCase() === 'inactive'">
              <span class="w-1.5 h-1.5 rounded-full"
                    [class.bg-green-600]="jobInformation().status.toLowerCase() === 'active'"
                    [class.bg-red-600]="jobInformation().status.toLowerCase() === 'inactive'"></span>
              {{ jobInformation().status }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Reporting Manager</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().reportingManagerName || 'Unassigned' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Work Mode</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().workModeLabel || '—' }}
            </dd>
          </div>

          <div>
            <dt class="text-xs font-medium text-[var(--color-text-secondary)] mb-1">Hire Date</dt>
            <dd class="font-semibold text-[var(--color-text-primary)]">
              {{ jobInformation().hireDate }}
            </dd>
          </div>
        </dl>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobInfoComponent implements OnDestroy {
  readonly jobInformation = input.required<EmployeeDetailJobInformation>();
  readonly employeeId = input.required<string>();
  readonly canEdit = input<boolean>(false);
  readonly saving = input<boolean>(false);
  /** Hosts that render their own card heading/read view (Employment tab) use only the edit form. */
  readonly showHeader = input<boolean>(true);
  readonly showReadView = input<boolean>(true);
  readonly save = output<UpdateEmployeeJobDetailsRequest>();

  private readonly peopleApi = inject(PeopleApiService);
  private readonly workModeStore = inject(WorkModeStore);

  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly employeeNumberMaxLength = EMPLOYEE_NUMBER_MAX_LENGTH;

  readonly isEditing = signal(false);
  readonly submitAttempted = signal(false);
  readonly employeeNumberAvailability = signal<'idle' | 'checking' | 'available' | 'unavailable' | 'invalid' | 'error'>('idle');

  private readonly employeeNumberEdits$ = new Subject<string>();
  private availabilitySub: Subscription | null = null;

  readonly workModeOptions = computed<readonly SelectOption[]>(() =>
    this.workModeStore
      .items()
      .filter((mode) => mode.isActive)
      .map((mode) => ({ value: mode.id, label: mode.name }))
  );

  private readonly fb = new FormBuilder().nonNullable;
  readonly form = this.fb.group({
    employeeNumber: ['', [Validators.required, Validators.maxLength(EMPLOYEE_NUMBER_MAX_LENGTH)]],
    employmentTypeCode: ['', Validators.required],
    workModeId: ['']
  });

  readonly employeeNumberFieldError = computed(() => {
    const availability = this.employeeNumberAvailability();
    if (availability === 'invalid') {
      return EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE;
    }
    if (availability === 'unavailable') {
      return EMPLOYEE_NUMBER_IN_USE_MESSAGE;
    }
    if (this.submitAttempted()) {
      const control = this.form.controls.employeeNumber;
      if (control.hasError('required') || !normalizeEmployeeNumber(control.value)) {
        return 'Employee number is required.';
      }
      if (control.hasError('maxlength')) {
        return `Employee number must be ${EMPLOYEE_NUMBER_MAX_LENGTH} characters or fewer.`;
      }
      if (availability === 'checking') {
        return 'Checking…';
      }
    }
    return '';
  });

  readonly employeeNumberFieldHint = computed(() => {
    if (this.employeeNumberFieldError()) {
      return '';
    }
    const availability = this.employeeNumberAvailability();
    if (availability === 'checking') {
      return 'Checking…';
    }
    if (availability === 'available') {
      return 'Available';
    }
    return '';
  });

  constructor() {
    effect(() => {
      const legalEntityId = this.jobInformation().legalEntityId;
      if (legalEntityId) {
        this.workModeStore.load(legalEntityId);
      }
    });

    this.availabilitySub = this.employeeNumberEdits$
      .pipe(
        debounceTime(350),
        map((value) => normalizeEmployeeNumber(value)),
        distinctUntilChanged(),
        switchMap((employeeNumber) => {
          if (!employeeNumber) {
            this.employeeNumberAvailability.set('idle');
            return of(null);
          }
          if (!isValidEmployeeNumberFormat(employeeNumber)) {
            this.employeeNumberAvailability.set('invalid');
            return of(null);
          }
          if (employeeNumber === this.jobInformation().employeeNumber) {
            this.employeeNumberAvailability.set('available');
            return of(null);
          }
          this.employeeNumberAvailability.set('checking');
          return this.peopleApi.checkEmployeeNumberAvailability(employeeNumber, this.employeeId()).pipe(
            catchError(() => {
              this.employeeNumberAvailability.set('error');
              return of(null);
            })
          );
        })
      )
      .subscribe((result) => {
        if (!result) {
          return;
        }
        this.employeeNumberAvailability.set(result.available ? 'available' : 'unavailable');
      });
  }

  ngOnDestroy(): void {
    this.availabilitySub?.unsubscribe();
  }

  onEmployeeNumberChange(value: string): void {
    this.form.controls.employeeNumber.setValue(value);
    this.employeeNumberEdits$.next(value);
  }

  startEdit(): void {
    const data = this.jobInformation();
    this.submitAttempted.set(false);
    this.employeeNumberAvailability.set('idle');
    this.form.setValue({
      employeeNumber: data.employeeNumber,
      employmentTypeCode: data.employmentTypeCode,
      workModeId: data.workModeId ?? ''
    });
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    const availability = this.employeeNumberAvailability();
    if (this.form.invalid || availability === 'invalid' || availability === 'unavailable' || availability === 'checking') {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({
      employeeNumber: normalizeEmployeeNumber(value.employeeNumber),
      employmentTypeCode: value.employmentTypeCode,
      workModeId: value.workModeId || null
    });
  }
}
