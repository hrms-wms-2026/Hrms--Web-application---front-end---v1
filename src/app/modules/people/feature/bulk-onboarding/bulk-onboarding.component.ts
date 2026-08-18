import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  BULK_ONBOARDING_SYSTEM_FIELD_LABELS,
  BulkOnboardingSystemField
} from '../../models/bulk-onboarding.model';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';

export type BulkOnboardingStep = 'upload' | 'map-columns' | 'validate' | 'review' | 'finalize';

const EMPLOYMENT_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'intern', label: 'Intern' }
];

const REQUIRED_MAPPING_FIELDS = new Set<BulkOnboardingSystemField>(['workEmail', 'startDate']);

@Component({
  selector: 'app-bulk-onboarding',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, SelectComponent],
  templateUrl: './bulk-onboarding.component.html',
  styleUrl: './bulk-onboarding.component.css'
})
export class BulkOnboardingComponent implements OnInit, OnDestroy {
  store = inject(BulkOnboardingStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly peopleApi = inject(PeopleApiService);
  private readonly checklistApi = inject(ChecklistApiService);

  readonly fieldLabels = BULK_ONBOARDING_SYSTEM_FIELD_LABELS;
  readonly fieldIds = Object.keys(BULK_ONBOARDING_SYSTEM_FIELD_LABELS) as BulkOnboardingSystemField[];
  readonly employmentTypeOptions = EMPLOYMENT_TYPE_OPTIONS;
  readonly requiredMappingFields = REQUIRED_MAPPING_FIELDS;

  readonly legalEntityId = signal('');
  readonly defaultWorkModeId = signal<number | null>(null);
  readonly defaultEmploymentType = signal<string | null>(null);
  readonly defaultChecklistTemplateId = signal<string | null>(null);
  readonly selectedFileName = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly companyOptions = computed<readonly SelectOption[]>(() =>
    this.legalEntityStore.companies().map((company) => ({ value: company.id, label: company.name }))
  );
  readonly workModeSelectValue = computed(() => {
    const id = this.defaultWorkModeId();
    return id === null ? '' : String(id);
  });
  readonly workModeOptions = signal<readonly SelectOption[]>([]);
  readonly checklistOptions = signal<readonly SelectOption[]>([]);

  private readonly manualStep = signal<BulkOnboardingStep | null>(null);

  readonly steps: readonly { id: BulkOnboardingStep; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map-columns', label: 'Map columns' },
    { id: 'validate', label: 'Validate' },
    { id: 'review', label: 'Review' },
    { id: 'finalize', label: 'Finalize' }
  ];

  currentStep = computed<BulkOnboardingStep>(() => {
    if (this.manualStep()) return this.manualStep()!;
    if (!this.store.batch()) return 'upload';
    return 'map-columns';
  });

  async ngOnInit(): Promise<void> {
    await this.legalEntityStore.loadCompanies();
    const selected = this.legalEntityStore.selectedLegalEntity();
    if (selected) {
      this.legalEntityId.set(selected.id);
      await this.loadLookupsForCompany(selected.id);
    }

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

  async onCompanyChange(legalEntityId: string): Promise<void> {
    this.legalEntityId.set(legalEntityId);
    this.defaultChecklistTemplateId.set(null);
    await this.loadLookupsForCompany(legalEntityId);
  }

  onWorkModeChange(value: string): void {
    this.defaultWorkModeId.set(value ? Number(value) : null);
  }

  onEmploymentTypeChange(value: string): void {
    this.defaultEmploymentType.set(value || null);
  }

  onChecklistTemplateChange(value: string): void {
    this.defaultChecklistTemplateId.set(value || null);
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

    const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
    if (!isCsv) {
      this.fileError.set('Upload a CSV file. Spreadsheet formats are not accepted in this step.');
      input.value = '';
      this.selectedFileName.set(null);
      return;
    }

    if (!legalEntityId) {
      this.fileError.set('Select a legal entity before uploading.');
      return;
    }

    this.fileError.set(null);
    this.selectedFileName.set(file.name);
    await this.store.upload({
      file,
      legalEntityId,
      defaultWorkModeId,
      defaultEmploymentType,
      defaultChecklistTemplateId: this.defaultChecklistTemplateId()
    });
  }

  onCsvInput(event: Event): void {
    void this.onFileSelected(
      event,
      this.legalEntityId(),
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

  mappingColumnOptions(): readonly SelectOption[] {
    const columns = this.store.batch()?.detectedColumns ?? [];
    return [{ value: '', label: 'Not mapped' }, ...columns.map((column) => ({ value: column, label: column }))];
  }

  private async loadLookupsForCompany(legalEntityId: string): Promise<void> {
    try {
      const page = await firstValueFrom(
        this.checklistApi.listChecklistTemplates({
          legalEntityId,
          templateType: 'onboarding',
          includeInactive: false,
          page: 1,
          pageSize: 100
        })
      );
      this.checklistOptions.set(page.items.map((item) => ({ value: item.id, label: item.name })));
    } catch {
      this.checklistOptions.set([]);
    }
  }
}
