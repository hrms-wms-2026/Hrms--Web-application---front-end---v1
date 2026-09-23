import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { BulkOnboardingApiService } from '../../data-access/bulk-onboarding-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  BULK_ONBOARDING_ISSUE_TYPE_LABELS,
  BULK_ONBOARDING_SYSTEM_FIELD_LABELS,
  BulkOnboardingGroupedIssue,
  BulkOnboardingIssueAction,
  BulkOnboardingRowStatus,
  BulkOnboardingSystemField,
  ResolveBulkOnboardingIssuesPayload,
  RowValidationResultItem
} from '../../models/bulk-onboarding.model';
import { DRAFT_STATUS_LABELS } from '../../models/onboarding-draft.model';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';
import {
  BulkIssueResolverAction,
  BulkIssueResolverComponent
} from '../../ui/bulk-issue-resolver/bulk-issue-resolver.component';

export type BulkOnboardingStep = 'upload' | 'map-columns' | 'validate' | 'review' | 'finalize';

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' }
];

const REQUIRED_MAPPING_FIELDS = new Set<BulkOnboardingSystemField>(['workEmail', 'startDate']);

const BULK_ROW_STATUS_LABELS: Record<BulkOnboardingRowStatus, string> = {
  pending_mapping: 'Pending mapping',
  valid: 'Valid',
  invalid: 'Invalid',
  draft_created: DRAFT_STATUS_LABELS.draft,
  draft_failed: 'Draft failed',
  finalized: DRAFT_STATUS_LABELS.finalized,
  waiting_for_seat: DRAFT_STATUS_LABELS.waiting_for_seat,
  waiting_for_position_approval: DRAFT_STATUS_LABELS.waiting_for_position_approval,
  finalize_failed: 'Finalize failed'
};

@Component({
  selector: 'app-bulk-onboarding',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent,
    ButtonComponent,
    EmptyStateComponent,
    SelectComponent,
    RouterLink,
    BulkIssueResolverComponent
  ],
  templateUrl: './bulk-onboarding.component.html',
  styleUrl: './bulk-onboarding.component.css'
})
export class BulkOnboardingComponent implements OnInit, OnDestroy {
  store = inject(BulkOnboardingStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly bulkOnboardingApi = inject(BulkOnboardingApiService);
  private readonly permissionService = inject(PermissionService);

  readonly fieldLabels = BULK_ONBOARDING_SYSTEM_FIELD_LABELS;
  readonly fieldIds = Object.keys(BULK_ONBOARDING_SYSTEM_FIELD_LABELS) as BulkOnboardingSystemField[];
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly requiredMappingFields = REQUIRED_MAPPING_FIELDS;
  readonly rowStatusLabels = BULK_ROW_STATUS_LABELS;

  readonly defaultWorkModeId = signal<string | null>(null);
  readonly defaultEmploymentType = signal<string | null>(null);
  readonly selectedFileName = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly expandedIssueKey = signal<string | null>(null);

  readonly resolverOpen = signal(false);
  readonly resolverIssue = signal<BulkOnboardingGroupedIssue | null>(null);
  readonly resolverAction = signal<BulkIssueResolverAction | null>(null);
  readonly resolverSubmitting = signal(false);

  readonly selectedLegalEntityId = computed(() => this.legalEntityStore.selectedLegalEntity()?.id ?? '');
  readonly hasCompany = computed(() => !!this.selectedLegalEntityId());
  readonly workModeSelectValue = computed(() => this.defaultWorkModeId() ?? '');
  readonly workModeOptions = signal<readonly SelectOption[]>([]);
  readonly unresolvedIssueCount = computed(() => this.store.validationResult()?.issues?.length ?? 0);
  readonly canManageOrg = computed(() => this.permissionService.hasPermission('org:manage'));

  private readonly manualStep = signal<BulkOnboardingStep | null>(null);

  currentStep = computed<BulkOnboardingStep>(() => {
    if (this.manualStep()) return this.manualStep()!;
    if (!this.store.batch()) return 'upload';
    return 'map-columns';
  });

  async ngOnInit(): Promise<void> {
    await this.legalEntityStore.loadCompanies();

    const legalEntityId = this.selectedLegalEntityId();
    if (!legalEntityId) {
      this.workModeOptions.set([]);
      return;
    }

    try {
      const modes = await firstValueFrom(this.peopleApi.getWorkModes(legalEntityId));
      this.workModeOptions.set(modes.map((mode) => ({ value: mode.id, label: mode.label })));
    } catch {
      this.workModeOptions.set([]);
    }
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  onWorkModeChange(value: string): void {
    this.defaultWorkModeId.set(value || null);
  }

  onEmploymentTypeChange(value: string): void {
    this.defaultEmploymentType.set(value || null);
  }

  async onFileSelected(
    event: Event,
    legalEntityId: string,
    defaultWorkModeId: string | null,
    defaultEmploymentType: string | null
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isSupported =
      file.name.toLowerCase().endsWith('.csv') ||
      file.name.toLowerCase().endsWith('.xlsx');
    if (!isSupported) {
      this.fileError.set('Upload a CSV or Excel (.xlsx) file.');
      input.value = '';
      this.selectedFileName.set(null);
      return;
    }

    if (!legalEntityId) {
      this.fileError.set('Select a company from the top navigation before uploading.');
      return;
    }

    this.fileError.set(null);
    this.selectedFileName.set(file.name);
    await this.store.upload({
      file,
      legalEntityId,
      defaultWorkModeId,
      defaultEmploymentType,
      defaultChecklistTemplateId: null
    });
  }

  onDownloadTemplate(format: 'csv' | 'xlsx'): void {
    this.bulkOnboardingApi.downloadTemplate(format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = format === 'csv' ? 'bulk-onboarding-template.csv' : 'bulk-onboarding-template.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  onCsvInput(event: Event): void {
    void this.onFileSelected(
      event,
      this.selectedLegalEntityId(),
      this.defaultWorkModeId(),
      this.defaultEmploymentType()
    );
  }

  onMappingFieldChange(field: BulkOnboardingSystemField, csvColumn: string | null): void {
    this.store.updateMapping(field, csvColumn);
  }

  onMappingSelectChange(field: BulkOnboardingSystemField, csvColumn: string): void {
    this.onMappingFieldChange(field, csvColumn || null);
  }

  goToStep(step: BulkOnboardingStep): void {
    this.manualStep.set(step);
  }

  onToggleRow(onboardingDraftId: string): void {
    this.store.toggleRowSelection(onboardingDraftId);
  }

  isRowSelected(onboardingDraftId: string): boolean {
    return this.store.selectedDraftIds().includes(onboardingDraftId);
  }

  async onValidate(): Promise<void> {
    await this.store.validate();
    this.goToStep('validate');
  }

  async onCreateDrafts(): Promise<void> {
    await this.store.createDrafts();
    this.goToStep('review');
  }

  async onFinalizeSelected(): Promise<void> {
    await this.store.finalizeSelected();
    this.goToStep('finalize');
  }

  mappingColumnOptions(): readonly SelectOption[] {
    const columns = this.store.batch()?.detectedColumns ?? [];
    return [{ value: '', label: 'Not mapped' }, ...columns.map((column) => ({ value: column, label: column }))];
  }

  issueTypeLabel(issueType: string): string {
    return BULK_ONBOARDING_ISSUE_TYPE_LABELS[issueType] ?? 'Import issue';
  }

  canAction(issue: BulkOnboardingGroupedIssue, action: BulkOnboardingIssueAction): boolean {
    return issue.allowedActions.includes(action);
  }

  issueCapacityLabel(issue: BulkOnboardingGroupedIssue): string | null {
    const ctx = issue.context;
    if (ctx?.availableSeats == null || ctx.requiredSeatsInBatch == null) return null;
    return `${ctx.availableSeats} seat${ctx.availableSeats === 1 ? '' : 's'} available · ${ctx.requiredSeatsInBatch} needed`;
  }

  toggleIssueRows(issueKey: string): void {
    this.expandedIssueKey.set(this.expandedIssueKey() === issueKey ? null : issueKey);
  }

  friendlyRowMessage(row: RowValidationResultItem): string {
    const code = row.errors?.[0]?.code;
    switch (code) {
      case 'department_not_found':
        return 'This department could not be matched. Choose an existing department or create a new one.';
      case 'position_not_found':
        return 'This position could not be matched. Choose an existing position or create a new one.';
      case 'position_capacity_exceeded':
        return 'This position does not have enough open seats for everyone assigned to it in this import.';
      case 'work_mode_missing':
        return 'Work mode is required.';
      case 'duplicate_work_email':
        return 'This email is already used by another employee.';
      case 'missing_first_name':
        return 'First name is required.';
      case 'missing_last_name':
        return 'Last name is required.';
      case 'reporting_manager_required':
      case 'reporting_manager_not_found':
        return 'Choose which employee should be the reporting manager.';
      default:
        return row.errorMessage ?? 'This row needs attention.';
    }
  }

  openResolver(issue: BulkOnboardingGroupedIssue, action: BulkIssueResolverAction): void {
    this.resolverIssue.set(issue);
    this.resolverAction.set(action);
    this.resolverOpen.set(true);
  }

  closeResolver(): void {
    this.resolverOpen.set(false);
    this.resolverIssue.set(null);
    this.resolverAction.set(null);
    this.resolverSubmitting.set(false);
  }

  async onUseSuggestedMatch(issue: BulkOnboardingGroupedIssue): Promise<void> {
    const suggestion = issue.suggestions[0];
    if (!suggestion) return;
    await this.store.resolveIssue({
      issueKey: issue.issueKey,
      action: 'map_existing',
      targetId: suggestion.id,
      applyToRowNumbers: issue.affectedRowNumbers
    });
  }

  async onResolverApply(payload: ResolveBulkOnboardingIssuesPayload): Promise<void> {
    this.resolverSubmitting.set(true);
    const ok = await this.store.resolveIssue(payload);
    this.resolverSubmitting.set(false);
    if (ok) this.closeResolver();
  }

  onChooseExisting(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'map_existing');
  }

  onEditImportedValue(issue: BulkOnboardingGroupedIssue): void {
    if (
      issue.issueType === 'reporting_manager_required' ||
      issue.issueType === 'reporting_manager_not_found'
    ) {
      this.openResolver(issue, 'choose_manager');
      return;
    }
    this.openResolver(issue, 'edit_imported_value');
  }

  onSetDefault(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'set_default');
  }

  onCreateDepartment(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'create_department');
  }

  onCreatePosition(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'create_position');
  }

  onIncreaseCapacity(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'increase_capacity');
  }

  onResolveCapacity(issue: BulkOnboardingGroupedIssue): void {
    this.openResolver(issue, 'map_existing');
  }
}
