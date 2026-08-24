import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionListItemResponse } from '../../../organization/models/position.model';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  BulkOnboardingGroupedIssue,
  BulkOnboardingIssueAction,
  ResolveBulkOnboardingIssuesPayload
} from '../../models/bulk-onboarding.model';
import { ActiveHolder } from '../../models/onboarding-draft.model';

export type BulkIssueResolverAction = BulkOnboardingIssueAction | 'choose_manager';

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' }
];

function availableSeats(position: PositionListItemResponse): number {
  const assigned = position.assignedCount ?? position.currentOccupancy ?? 0;
  return Math.max(0, position.maxOccupancy - assigned);
}

function positionOptionLabel(position: PositionListItemResponse): string {
  const seats = availableSeats(position);
  const vacancy = seats <= 0 ? 'No vacancy' : seats === 1 ? '1 seat available' : `${seats} seats available`;
  const dept = position.departmentName ? ` · ${position.departmentName}` : '';
  const code = position.code ? ` (${position.code})` : '';
  return `${position.name}${code}${dept} · ${vacancy}`;
}

@Component({
  selector: 'app-bulk-issue-resolver',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent, InputComponent, SelectComponent],
  template: `
    <app-modal [open]="open()" [title]="modalTitle()" size="lg" (closed)="onClose()">
      <div class="flex flex-col gap-4 text-sm text-[var(--color-text-primary)]">
        @if (issue(); as currentIssue) {
          <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted,transparent)] p-3">
            <p class="font-medium">{{ explanation() }}</p>
            @if (currentIssue.importedValue) {
              <p class="mt-1 text-[var(--color-text-secondary)]">
                Imported value: “{{ currentIssue.importedValue }}”
              </p>
            }
            <p class="mt-1 text-[var(--color-text-secondary)]">
              Applies to {{ selectedRowNumbers().length }} of {{ currentIssue.affectedRowCount }} affected
              row{{ currentIssue.affectedRowCount === 1 ? '' : 's' }}.
            </p>
            @if (capacitySummary(); as capacity) {
              <p class="mt-2 text-[var(--color-text-secondary)]">{{ capacity }}</p>
            }
          </div>
        }

        @if (loadError()) {
          <p class="text-[var(--color-danger-text)]" role="alert">{{ loadError() }}</p>
        }
        @if (formError()) {
          <p class="text-[var(--color-danger-text)]" role="alert">{{ formError() }}</p>
        }

        @switch (action()) {
          @case ('map_existing') {
            @if (needsDepartmentFirst()) {
              <app-select
                label="Department"
                placeholder="Resolve department first"
                [options]="departmentOptions()"
                [value]="selectedDepartmentId()"
                (valueChange)="onDepartmentFilterChange($event)"
              />
            }
            <app-select
              [label]="selectorLabel()"
              [placeholder]="selectorPlaceholder()"
              [options]="selectorOptions()"
              [value]="selectedTargetId()"
              (valueChange)="selectedTargetId.set($event)"
            />
          }
          @case ('edit_imported_value') {
            <app-input
              label="Corrected value"
              [value]="editedValue()"
              (valueChange)="editedValue.set($event)"
            />
          }
          @case ('create_department') {
            @if (!canManageOrg()) {
              <p class="text-[var(--color-text-secondary)]">
                You do not have permission to create departments.
              </p>
            } @else {
              <app-input label="Department name" [value]="createName()" (valueChange)="createName.set($event)" />
              <app-input
                label="Code (optional)"
                [value]="createCode()"
                (valueChange)="createCode.set($event)"
              />
              <app-select
                label="Parent department (optional)"
                placeholder="None"
                [options]="departmentOptionsWithEmpty()"
                [value]="createParentDepartmentId()"
                (valueChange)="createParentDepartmentId.set($event)"
              />
            }
          }
          @case ('create_position') {
            @if (!canManageOrg()) {
              <p class="text-[var(--color-text-secondary)]">
                You do not have permission to create positions.
              </p>
            } @else {
              <app-select
                label="Department"
                placeholder="Select department"
                [options]="departmentOptions()"
                [value]="createDepartmentId()"
                (valueChange)="createDepartmentId.set($event)"
              />
              <app-input label="Position name" [value]="createName()" (valueChange)="createName.set($event)" />
              <app-input
                label="Code"
                [value]="createCode()"
                [maxlength]="5"
                (valueChange)="createCode.set($event)"
              />
              <app-input
                label="Capacity"
                type="number"
                [value]="createCapacity()"
                (valueChange)="createCapacity.set($event)"
              />
              <app-select
                label="Reports to (optional)"
                placeholder="None"
                [options]="reportsToPositionOptions()"
                [value]="createReportsToPositionId()"
                (valueChange)="createReportsToPositionId.set($event)"
              />
            }
          }
          @case ('set_default') {
            @if (issue()?.field === 'employmentType') {
              <app-select
                label="Employment type"
                placeholder="Select employment type"
                [options]="employmentTypeOptions"
                [value]="selectedEmploymentType()"
                (valueChange)="selectedEmploymentType.set($event)"
              />
            } @else {
              <app-select
                label="Work mode"
                placeholder="Select work mode"
                [options]="workModeOptions()"
                [value]="selectedWorkModeId()"
                (valueChange)="selectedWorkModeId.set($event)"
              />
            }
          }
          @case ('increase_capacity') {
            @if (!canManageOrg()) {
              <p class="text-[var(--color-text-secondary)]">
                You do not have permission to increase position capacity.
              </p>
            } @else {
              <app-input
                label="New capacity"
                type="number"
                [value]="newCapacity()"
                (valueChange)="newCapacity.set($event)"
              />
              <p class="text-xs text-[var(--color-text-secondary)]">
                Must be at least the number of seats needed for this import.
              </p>
            }
          }
          @case ('choose_manager') {
            <app-select
              label="Reporting manager"
              placeholder="Select employee"
              [options]="managerOptions()"
              [value]="selectedManagerEmail()"
              (valueChange)="selectedManagerEmail.set($event)"
            />
          }
        }

        @if (showRowPicker()) {
          <div class="flex flex-col gap-2">
            <span class="text-xs font-medium text-[var(--color-text-secondary)]">Affected rows</span>
            <div class="flex flex-wrap gap-2">
              @for (rowNumber of issue()?.affectedRowNumbers ?? []; track rowNumber) {
                <label class="inline-flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    [checked]="selectedRowNumbers().includes(rowNumber)"
                    (change)="toggleRow(rowNumber)"
                  />
                  Row {{ rowNumber }}
                </label>
              }
            </div>
            <div class="flex gap-2">
              <button type="button" class="text-xs text-[var(--color-primary)]" (click)="selectAllRows()">
                Select all
              </button>
              <button type="button" class="text-xs text-[var(--color-primary)]" (click)="clearRowSelection()">
                Clear
              </button>
            </div>
          </div>
        }

        <div class="flex justify-end gap-2 pt-2">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="onClose()">Cancel</app-button>
          <app-button
            [loading]="submitting()"
            [disabled]="!canSubmit() || submitting()"
            (pressed)="onSubmit()"
          >
            Apply fix
          </app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkIssueResolverComponent {
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly checklistApi = inject(ChecklistApiService);

  readonly open = input(false);
  readonly issue = input<BulkOnboardingGroupedIssue | null>(null);
  readonly action = input<BulkIssueResolverAction | null>(null);
  readonly legalEntityId = input('');
  readonly canManageOrg = input(false);
  readonly workModeOptions = input<readonly SelectOption[]>([]);
  readonly submitting = input(false);

  readonly closed = output<void>();
  readonly apply = output<ResolveBulkOnboardingIssuesPayload>();

  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;

  readonly loadError = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly departmentOptions = signal<readonly SelectOption[]>([]);
  readonly selectorOptions = signal<readonly SelectOption[]>([]);
  readonly reportsToPositionOptions = signal<readonly SelectOption[]>([{ value: '', label: 'None' }]);
  readonly managerOptions = signal<readonly SelectOption[]>([]);
  readonly selectedTargetId = signal('');
  readonly selectedDepartmentId = signal('');
  readonly selectedWorkModeId = signal('');
  readonly selectedEmploymentType = signal('');
  readonly selectedManagerEmail = signal('');
  readonly editedValue = signal('');
  readonly createName = signal('');
  readonly createCode = signal('');
  readonly createCapacity = signal('1');
  readonly createDepartmentId = signal('');
  readonly createParentDepartmentId = signal('');
  readonly createReportsToPositionId = signal('');
  readonly newCapacity = signal('1');
  readonly selectedRowNumbers = signal<readonly number[]>([]);
  readonly positionsCache = signal<readonly PositionListItemResponse[]>([]);

  readonly modalTitle = computed(() => {
    switch (this.action()) {
      case 'map_existing':
        return 'Choose existing';
      case 'edit_imported_value':
        return 'Correct spelling';
      case 'create_department':
        return 'Create department';
      case 'create_position':
        return 'Create position';
      case 'set_default':
        return this.issue()?.field === 'employmentType' ? 'Set employment type' : 'Set work mode';
      case 'increase_capacity':
        return 'Increase capacity';
      case 'choose_manager':
        return 'Choose reporting manager';
      default:
        return 'Resolve issue';
    }
  });

  readonly explanation = computed(() => {
    const issue = this.issue();
    if (!issue) return '';
    switch (issue.issueType) {
      case 'department_not_found':
        return 'Match this imported department to an existing one, correct the spelling, or create it.';
      case 'position_not_found':
        return 'Match this imported position to an existing one, correct the spelling, or create it.';
      case 'position_capacity_exceeded':
        return 'This position does not have enough open seats for everyone in this import. Choose another position, split rows, create a position, or increase capacity.';
      case 'work_mode_missing':
      case 'work_mode_not_found':
        return 'Choose a work mode for the affected rows.';
      case 'employment_type_missing':
      case 'employment_type_not_found':
        return 'Choose an employment type for the affected rows.';
      case 'checklist_template_not_found':
        return 'Choose an onboarding checklist template, or correct the imported name.';
      case 'reporting_manager_required':
      case 'reporting_manager_not_found':
        return 'The selected position reports to a manager role with more than one current employee. Choose who should be the reporting manager.';
      default:
        return 'Correct the imported value for the affected rows.';
    }
  });

  readonly capacitySummary = computed(() => {
    const ctx = this.issue()?.context;
    if (ctx?.availableSeats == null || ctx.requiredSeatsInBatch == null) return null;
    return `${ctx.availableSeats} seat${ctx.availableSeats === 1 ? '' : 's'} available · ${ctx.requiredSeatsInBatch} needed in this import`;
  });

  readonly departmentOptionsWithEmpty = computed(() => [
    { value: '', label: 'None' },
    ...this.departmentOptions()
  ]);

  readonly needsDepartmentFirst = computed(() => {
    const issue = this.issue();
    return (
      this.action() === 'map_existing' &&
      (issue?.issueType === 'position_not_found' || issue?.issueType === 'position_capacity_exceeded') &&
      !issue.context?.departmentId
    );
  });

  readonly selectorLabel = computed(() => {
    switch (this.issue()?.field) {
      case 'department':
        return 'Department';
      case 'position':
        return 'Position';
      case 'checklistTemplate':
        return 'Checklist template';
      case 'workMode':
        return 'Work mode';
      case 'employmentType':
        return 'Employment type';
      default:
        return 'Record';
    }
  });

  readonly selectorPlaceholder = computed(() => `Select ${this.selectorLabel().toLowerCase()}`);

  readonly showRowPicker = computed(() => (this.issue()?.affectedRowCount ?? 0) > 1);

  constructor() {
    effect(() => {
      if (!this.open() || !this.issue() || !this.action()) return;
      void this.bootstrap();
    });
  }

  private async bootstrap(): Promise<void> {
    const issue = this.issue();
    if (!issue) return;

    this.loadError.set(null);
    this.formError.set(null);
    this.selectedTargetId.set(issue.suggestions[0]?.id ?? '');
    this.editedValue.set(issue.importedValue ?? '');
    this.createName.set(issue.importedValue ?? '');
    this.createCode.set('');
    this.createCapacity.set(String(Math.max(1, issue.context?.requiredSeatsInBatch ?? 1)));
    this.createDepartmentId.set(issue.context?.departmentId ?? '');
    this.createParentDepartmentId.set('');
    this.createReportsToPositionId.set('');
    this.selectedDepartmentId.set(issue.context?.departmentId ?? '');
    this.selectedWorkModeId.set(this.workModeOptions()[0]?.value ?? '');
    this.selectedEmploymentType.set('full_time');
    this.selectedManagerEmail.set('');
    this.selectedRowNumbers.set([...issue.affectedRowNumbers]);

    const needed = Math.max(
      issue.context?.requiredSeatsInBatch ?? 1,
      (issue.context?.currentPrimaryAssignments ?? 0) + (issue.affectedRowCount ?? 1)
    );
    this.newCapacity.set(String(Math.max(issue.context?.maxOccupancy ?? 1, needed)));

    try {
      await this.loadOptionsForAction();
    } catch (err: unknown) {
      this.loadError.set(toSafeErrorMessage(err, 'Could not load options. Try again.'));
    }
  }

  private async loadOptionsForAction(): Promise<void> {
    const issue = this.issue();
    const action = this.action();
    const legalEntityId = this.legalEntityId();
    if (!issue || !action || !legalEntityId) return;

    if (
      action === 'map_existing' ||
      action === 'create_department' ||
      action === 'create_position'
    ) {
      await this.ensureDepartmentsLoaded(legalEntityId);
    }

    if (action === 'map_existing') {
      if (issue.field === 'department') {
        this.selectorOptions.set(this.departmentOptions());
      } else if (issue.field === 'position' || issue.issueType === 'position_capacity_exceeded') {
        await this.loadPositions(legalEntityId, this.selectedDepartmentId() || issue.context?.departmentId || undefined);
      } else if (issue.field === 'workMode') {
        this.selectorOptions.set(this.workModeOptions());
      } else if (issue.field === 'employmentType') {
        this.selectorOptions.set(this.employmentTypeOptions);
      } else if (issue.field === 'checklistTemplate') {
        await this.loadChecklists(legalEntityId, issue.context?.departmentId, issue.context?.positionId);
      }
    }

    if (action === 'create_position') {
      await this.loadPositions(legalEntityId, this.createDepartmentId() || undefined, true);
    }

    if (action === 'choose_manager') {
      const reportsToPositionId = issue.context?.positionId;
      if (!reportsToPositionId) {
        this.loadError.set('Resolve the position first, then choose a reporting manager.');
        return;
      }
      const holders = await firstValueFrom(this.peopleApi.getActiveHolders(legalEntityId, reportsToPositionId));
      this.managerOptions.set(
        holders.map((holder: ActiveHolder) => ({
          value: holder.workEmail,
          label: `${holder.firstName} ${holder.lastName}`.trim() || holder.workEmail
        }))
      );
    }
  }

  private async ensureDepartmentsLoaded(legalEntityId: string): Promise<void> {
    if (this.departmentOptions().length > 0) return;
    const page = await firstValueFrom(
      this.departmentApi.listFlat(legalEntityId, { pageSize: 100, includeInactive: false })
    );
    this.departmentOptions.set(
      (page.items ?? []).map((d) => ({
        value: d.id,
        label: d.code ? `${d.name} (${d.code})` : d.name
      }))
    );
  }

  private async loadPositions(
    legalEntityId: string,
    departmentId?: string,
    forReportsTo = false
  ): Promise<void> {
    const page = await firstValueFrom(
      this.positionApi.listFlat(legalEntityId, {
        pageSize: 100,
        includeInactive: false,
        departmentId
      })
    );
    this.positionsCache.set(page.items ?? []);
    const options = (page.items ?? []).map((p) => ({
      value: p.id,
      label: positionOptionLabel(p)
    }));
    if (forReportsTo) {
      this.reportsToPositionOptions.set([{ value: '', label: 'None' }, ...options]);
    } else {
      this.selectorOptions.set(options);
    }
  }

  private async loadChecklists(
    legalEntityId: string,
    departmentId?: string | null,
    positionId?: string | null
  ): Promise<void> {
    const matches = await firstValueFrom(
      this.checklistApi.getOnboardingMatches({
        legalEntityId,
        departmentId: departmentId || undefined,
        positionId: positionId || undefined
      })
    );
    this.selectorOptions.set(matches.map((m) => ({ value: m.id, label: m.name })));
  }

  async onDepartmentFilterChange(departmentId: string): Promise<void> {
    this.selectedDepartmentId.set(departmentId);
    this.selectedTargetId.set('');
    if (!departmentId) {
      this.selectorOptions.set([]);
      return;
    }
    try {
      await this.loadPositions(this.legalEntityId(), departmentId);
    } catch (err: unknown) {
      this.loadError.set(toSafeErrorMessage(err, 'Could not load positions.'));
    }
  }

  toggleRow(rowNumber: number): void {
    const current = this.selectedRowNumbers();
    this.selectedRowNumbers.set(
      current.includes(rowNumber) ? current.filter((n) => n !== rowNumber) : [...current, rowNumber]
    );
  }

  selectAllRows(): void {
    this.selectedRowNumbers.set([...(this.issue()?.affectedRowNumbers ?? [])]);
  }

  clearRowSelection(): void {
    this.selectedRowNumbers.set([]);
  }

  canSubmit(): boolean {
    const action = this.action();
    const issue = this.issue();
    if (!action || !issue || this.selectedRowNumbers().length === 0) return false;

    switch (action) {
      case 'map_existing':
        return !!this.selectedTargetId();
      case 'edit_imported_value':
        return !!this.editedValue().trim();
      case 'create_department':
        return this.canManageOrg() && !!this.createName().trim();
      case 'create_position': {
        const capacity = Number(this.createCapacity());
        return (
          this.canManageOrg() &&
          !!this.createDepartmentId() &&
          !!this.createName().trim() &&
          !!this.createCode().trim() &&
          this.createCode().trim().length <= 5 &&
          Number.isFinite(capacity) &&
          capacity >= 1
        );
      }
      case 'set_default':
        return issue.field === 'employmentType'
          ? !!this.selectedEmploymentType()
          : !!this.selectedWorkModeId();
      case 'increase_capacity': {
        const capacity = Number(this.newCapacity());
        return this.canManageOrg() && Number.isFinite(capacity) && capacity >= 1;
      }
      case 'choose_manager':
        return !!this.selectedManagerEmail();
      default:
        return false;
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    const issue = this.issue();
    const action = this.action();
    if (!issue || !action || !this.canSubmit()) {
      this.formError.set('Choose a valid option to continue.');
      return;
    }

    const applyToRowNumbers = [...this.selectedRowNumbers()];

    if (action === 'choose_manager') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'edit_imported_value',
        newValue: this.selectedManagerEmail(),
        applyToRowNumbers
      });
      return;
    }

    if (action === 'map_existing') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'map_existing',
        targetId: this.selectedTargetId(),
        applyToRowNumbers
      });
      return;
    }

    if (action === 'edit_imported_value') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'edit_imported_value',
        newValue: this.editedValue().trim(),
        applyToRowNumbers
      });
      return;
    }

    if (action === 'create_department') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'create_department',
        applyToRowNumbers,
        create: {
          name: this.createName().trim(),
          code: this.createCode().trim() || null,
          parentDepartmentId: this.createParentDepartmentId() || null
        }
      });
      return;
    }

    if (action === 'create_position') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'create_position',
        applyToRowNumbers,
        createPosition: {
          departmentId: this.createDepartmentId(),
          name: this.createName().trim(),
          code: this.createCode().trim(),
          capacity: Number(this.createCapacity()),
          reportsToPositionId: this.createReportsToPositionId() || null
        }
      });
      return;
    }

    if (action === 'set_default') {
      if (issue.field === 'employmentType') {
        this.apply.emit({
          issueKey: issue.issueKey,
          action: 'set_default',
          newValue: this.selectedEmploymentType(),
          applyToRowNumbers
        });
      } else {
        this.apply.emit({
          issueKey: issue.issueKey,
          action: 'set_default',
          workModeId: Number(this.selectedWorkModeId()),
          applyToRowNumbers
        });
      }
      return;
    }

    if (action === 'increase_capacity') {
      this.apply.emit({
        issueKey: issue.issueKey,
        action: 'increase_capacity',
        targetId: issue.context?.positionId ?? null,
        newValue: String(Number(this.newCapacity())),
        applyToRowNumbers
      });
    }
  }
}
