import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import { LEGACY_INTERN_EMPLOYMENT_TYPE, SELECTABLE_EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { EmployeeDetailJobInformation, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { PeopleApiService } from '../../data-access/people-api.service';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import {
  EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE,
  EMPLOYEE_NUMBER_IN_USE_MESSAGE,
  EMPLOYEE_NUMBER_MAX_LENGTH,
  isValidEmployeeNumberFormat,
  normalizeEmployeeNumber
} from '../../utils/employee-number.utils';
import { validationMessage } from '../../../../shared/utils/validators';



@Component({
  selector: 'app-employee-job-info',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent, SelectComponent],
  host: { class: 'block h-full' },
  template: `
    <section class="flex h-full flex-col rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] p-4 shadow-xs" data-testid="current-assignment-card">
      <header class="mb-3 flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]" aria-hidden="true">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="7" width="18" height="13" rx="2"></rect>
              <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"></path>
            </svg>
          </span>
          <div>
            <h2 class="text-sm font-bold text-[var(--color-text-primary)]">Current Assignment</h2>
            <p class="text-[11px] text-[var(--color-text-secondary)]">Current role and organizational details</p>
          </div>
        </div>
        @if (canEdit() && !isEditing()) {
          <app-button data-testid="edit-job-details" variant="secondary" size="sm" (pressed)="startEdit()">
            Edit
          </app-button>
        }
      </header>

      @if (isEditing()) {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <app-input
              label="Employee number"
              [maxlength]="employeeNumberMaxLength"
              [value]="form.controls.employeeNumber.value"
              (valueChange)="onEmployeeNumberChange($event)"
              [error]="employeeNumberFieldError()"
              [hint]="employeeNumberFieldHint()"
            />
            <app-select [vacancyBadges]="true"
              label="Employment Type"
              placeholder="Select employment type"
              [options]="employmentTypeOptions()"
              [value]="form.controls.employmentTypeCode.value"
              [error]="submitAttempted() ? validationMessage(form.controls.employmentTypeCode.errors, 'Employment type') : ''"
              (valueChange)="form.controls.employmentTypeCode.setValue($event)"
            />
            <app-select [vacancyBadges]="true"
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
      } @else {
        <div class="grid flex-1 grid-cols-1 gap-x-6 gap-y-2.5 text-[13px] md:grid-cols-2 md:divide-x md:divide-[var(--color-border)]">
          <dl class="space-y-2.5">
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Employee Number</dt>
              <dd><span class="inline-block rounded-md bg-[var(--color-surface-secondary)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text-primary)]">{{ jobInformation().employeeNumber }}</span></dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Position</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().positionName || 'Unassigned' }}</dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Department</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().departmentName || 'Unassigned' }}</dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Company</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().legalEntityName || '—' }}</dd>
            </div>
          </dl>
          <dl class="space-y-2.5 md:pl-6">
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Reporting Manager</dt>
              <dd class="font-medium" [class.text-[var(--color-accent)]]="!!jobInformation().reportingManagerName" [class.text-[var(--color-text-primary)]]="!jobInformation().reportingManagerName">
                {{ jobInformation().reportingManagerName || 'Unassigned' }}
              </dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Employment Type</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().employmentTypeLabel }}</dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Work Mode</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().workModeLabel || '—' }}</dd>
            </div>
            <div class="grid grid-cols-[8rem_1fr] items-baseline gap-2 leading-5">
              <dt class="text-[var(--color-text-secondary)]">Hire Date</dt>
              <dd class="font-medium text-[var(--color-text-primary)]">{{ jobInformation().hireDate }}</dd>
            </div>
          </dl>
        </div>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobInfoComponent implements OnDestroy {
  readonly jobInformation = input.required<EmployeeDetailJobInformation>();
  readonly employeeId = input.required<string>();
  readonly canEdit = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly save = output<UpdateEmployeeJobDetailsRequest>();

  private readonly peopleApi = inject(PeopleApiService);
  private readonly workModeStore = inject(WorkModeStore);

  /** The selectable types, plus the retired "Intern" only for an employee who already has it -
   *  so their value still shows instead of a blank field. */
  readonly employmentTypeOptions = computed<readonly SelectOption[]>(() =>
    this.jobInformation().employmentTypeCode === LEGACY_INTERN_EMPLOYMENT_TYPE.value
      ? [...SELECTABLE_EMPLOYMENT_TYPE_OPTIONS, LEGACY_INTERN_EMPLOYMENT_TYPE]
      : SELECTABLE_EMPLOYMENT_TYPE_OPTIONS
  );
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
  protected readonly validationMessage = validationMessage;

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
