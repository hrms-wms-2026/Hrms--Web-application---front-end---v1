import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { BulkOnboardingApiService } from '../../data-access/bulk-onboarding-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  BULK_ONBOARDING_SYSTEM_FIELD_LABELS,
  BulkOnboardingRowStatus,
  BulkOnboardingSystemField
} from '../../models/bulk-onboarding.model';
import { DRAFT_STATUS_LABELS } from '../../models/onboarding-draft.model';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';

export type BulkOnboardingStep = 'upload' | 'map-columns' | 'validate' | 'review' | 'finalize';

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractor', label: 'Contractor' },
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
  imports: [BreadcrumbHeaderComponent, ButtonComponent, EmptyStateComponent, SelectComponent, RouterLink],
  templateUrl: './bulk-onboarding.component.html',
  styleUrl: './bulk-onboarding.component.css'
})
export class BulkOnboardingComponent implements OnInit, OnDestroy {
  store = inject(BulkOnboardingStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly bulkOnboardingApi = inject(BulkOnboardingApiService);

  readonly fieldLabels = BULK_ONBOARDING_SYSTEM_FIELD_LABELS;
  readonly fieldIds = Object.keys(BULK_ONBOARDING_SYSTEM_FIELD_LABELS) as BulkOnboardingSystemField[];
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly requiredMappingFields = REQUIRED_MAPPING_FIELDS;
  readonly rowStatusLabels = BULK_ROW_STATUS_LABELS;

  readonly defaultWorkModeId = signal<number | null>(null);
  readonly defaultEmploymentType = signal<string | null>(null);
  readonly selectedFileName = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly selectedLegalEntityId = computed(() => this.legalEntityStore.selectedLegalEntity()?.id ?? '');
  readonly hasCompany = computed(() => !!this.selectedLegalEntityId());
  readonly workModeSelectValue = computed(() => {
    const id = this.defaultWorkModeId();
    return id === null ? '' : String(id);
  });
  readonly workModeOptions = signal<readonly SelectOption[]>([]);

  private readonly manualStep = signal<BulkOnboardingStep | null>(null);

  currentStep = computed<BulkOnboardingStep>(() => {
    if (this.manualStep()) return this.manualStep()!;
    if (!this.store.batch()) return 'upload';
    return 'map-columns';
  });

  async ngOnInit(): Promise<void> {
    await this.legalEntityStore.loadCompanies();

    try {
      const modes = await firstValueFrom(this.peopleApi.getWorkModes());
      this.workModeOptions.set(modes.map((mode) => ({ value: String(mode.id), label: mode.label })));
    } catch {
      this.workModeOptions.set([]);
    }
  }

  ngOnDestroy(): void {
    this.store.reset();
  }

  onWorkModeChange(value: string): void {
    this.defaultWorkModeId.set(value ? Number(value) : null);
  }

  onEmploymentTypeChange(value: string): void {
    this.defaultEmploymentType.set(value || null);
  }

  async onFileSelected(
    event: Event,
    legalEntityId: string,
    defaultWorkModeId: number | null,
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
}
