import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../../models/legal-entity.model';
import { GeneralSettingsStore } from '../../state/general-settings.store';
import { LegalEntityStore } from '../../state/legal-entity.store';
import {
  COUNTRY_CODE_OPTIONS,
  COUNTRY_NAME_OPTIONS,
  CURRENCY_CODE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  FINANCIAL_YEAR_MONTH_OPTIONS,
  FIRST_DAY_OF_WEEK_OPTIONS,
  normalizeCountryCode,
  normalizeCountryName,
  STATUS_OPTIONS,
  TIME_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAY_OPTIONS
} from '../../utils/general-settings-options';
import { absoluteUrlValidator, nonEmptyArrayValidator, oneOfValidator } from '../../utils/general-settings-validators';

/**
 * Settings -> General Settings page for the currently selected Legal Entity.
 * GET/PUT api/v1/org/legal-entities/{id}/general-settings, both legal_entity:update
 * (LegalEntitiesController.cs:39-48/72-107). Route-level permissionGuard
 * already blocks unauthorized navigation (app.routes.ts); the hasAccess()
 * check here is defense for direct/embedded use of this component.
 */
@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InputComponent,
    SelectComponent
  ],
  templateUrl: './general-settings.component.html',
  styleUrl: './general-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly settingsStore = inject(GeneralSettingsStore);

  readonly WEEKDAY_OPTIONS = WEEKDAY_OPTIONS;
  readonly FIRST_DAY_OF_WEEK_OPTIONS = FIRST_DAY_OF_WEEK_OPTIONS;
  readonly FINANCIAL_YEAR_MONTH_OPTIONS = FINANCIAL_YEAR_MONTH_OPTIONS;
  readonly TIME_FORMAT_OPTIONS = TIME_FORMAT_OPTIONS;
  readonly STATUS_OPTIONS = STATUS_OPTIONS;
  readonly DATE_FORMAT_OPTIONS = DATE_FORMAT_OPTIONS;
  readonly COUNTRY_NAME_OPTIONS = COUNTRY_NAME_OPTIONS;
  readonly COUNTRY_CODE_OPTIONS = COUNTRY_CODE_OPTIONS;
  readonly CURRENCY_CODE_OPTIONS = CURRENCY_CODE_OPTIONS;
  readonly TIMEZONE_OPTIONS = TIMEZONE_OPTIONS;

  readonly hasAccess = computed(() => this.permissionService.hasPermission('legal_entity:update'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    companyCode: ['', [Validators.required, Validators.maxLength(20)]],
    registrationNumber: ['', [Validators.required, Validators.maxLength(50)]],
    taxRegistrationNumber: ['', [Validators.maxLength(80)]],
    vatGstNumber: ['', [Validators.maxLength(50)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phoneNumber: ['', [Validators.maxLength(20)]],
    website: ['', [Validators.maxLength(255), absoluteUrlValidator()]],
    countryCode: ['', [Validators.required, Validators.maxLength(3)]],
    currencyCode: ['', [Validators.required, Validators.maxLength(3)]],
    timezone: ['', [Validators.required, Validators.maxLength(50)]],
    financialYearStartMonth: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    firstDayOfWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
    standardWorkingDays: this.fb.nonNullable.control<number[]>([], [nonEmptyArrayValidator()]),
    defaultLanguage: ['', [Validators.required, Validators.maxLength(10)]],
    dateFormat: ['', [Validators.required, Validators.maxLength(20)]],
    timeFormat: ['24h' as '12h' | '24h', [Validators.required, oneOfValidator(['12h', '24h'])]],
    status: ['active' as 'active' | 'inactive', [Validators.required, oneOfValidator(['active', 'inactive'])]],
    addressLine1: ['', [Validators.maxLength(255)]],
    addressLine2: ['', [Validators.maxLength(255)]],
    addressCity: ['', [Validators.maxLength(100)]],
    addressState: ['', [Validators.maxLength(100)]],
    addressPostalCode: ['', [Validators.maxLength(20)]],
    addressCountry: ['', [Validators.maxLength(100)]]
  });

  constructor() {
    // Reload (or clear) whenever the selected company changes - never patch across companies.
    effect(() => {
      const company = this.selectedLegalEntity();
      this.form.reset(this.emptyFormValue());
      if (!company) {
        this.settingsStore.clear();
        return;
      }
      if (!this.hasAccess()) {
        return; // avoid an API call the route guard would already have blocked
      }
      void this.settingsStore.load(company.id);
    });

    // Populate the form whenever a fresh settings payload lands for the current company.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (settings) {
        this.form.reset(this.toFormValue(settings));
      }
    });
  }

  isDaySelected(day: number): boolean {
    return this.form.controls.standardWorkingDays.value.includes(day);
  }

  toggleDay(day: number, checked: boolean): void {
    const current = this.form.controls.standardWorkingDays.value;
    const next = checked ? [...current, day] : current.filter((d) => d !== day);
    this.form.controls.standardWorkingDays.setValue(next);
    this.form.controls.standardWorkingDays.markAsDirty();
  }

  async onSubmit(): Promise<void> {
    const company = this.selectedLegalEntity();
    if (!company || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const payload = this.toRequestPayload();
      const result = await this.settingsStore.save(company.id, payload);
      if (result) {
        this.legalEntityStore.updateCompanyDisplay(company.id, {
          name: result.name,
          companyCode: result.companyCode,
          isActive: result.status === 'active'
        });
        this.notificationService.success('General Settings saved.');
      } else {
        this.notificationService.error(this.settingsStore.saveError() ?? 'Failed to save General Settings.');
        // Failed values stay in the form - no reset here.
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private emptyFormValue() {
    return {
      name: '',
      companyCode: '',
      registrationNumber: '',
      taxRegistrationNumber: '',
      vatGstNumber: '',
      email: '',
      phoneNumber: '',
      website: '',
      countryCode: '',
      currencyCode: '',
      timezone: '',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [] as number[],
      defaultLanguage: '',
      dateFormat: '',
      timeFormat: '24h' as const,
      status: 'active' as const,
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: ''
    };
  }

  private toFormValue(settings: LegalEntityGeneralSettings) {
    return {
      name: settings.name,
      companyCode: settings.companyCode ?? '',
      registrationNumber: settings.registrationNumber ?? '',
      taxRegistrationNumber: settings.taxRegistrationNumber ?? '',
      vatGstNumber: settings.vatGstNumber ?? '',
      email: settings.email ?? '',
      phoneNumber: settings.phoneNumber ?? '',
      website: settings.website ?? '',
      countryCode: normalizeCountryCode(settings.countryCode),
      currencyCode: settings.currencyCode,
      timezone: settings.timezone ?? '',
      financialYearStartMonth: settings.financialYearStartMonth,
      firstDayOfWeek: settings.firstDayOfWeek,
      standardWorkingDays: [...settings.standardWorkingDays],
      defaultLanguage: settings.defaultLanguage,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      status: settings.status,
      addressLine1: settings.registeredBusinessAddress?.line1 ?? '',
      addressLine2: settings.registeredBusinessAddress?.line2 ?? '',
      addressCity: settings.registeredBusinessAddress?.city ?? '',
      addressState: settings.registeredBusinessAddress?.state ?? '',
      addressPostalCode: settings.registeredBusinessAddress?.postalCode ?? '',
      addressCountry: normalizeCountryName(settings.registeredBusinessAddress?.country ?? '')
    };
  }

  private toRequestPayload(): UpdateLegalEntityGeneralSettingsRequest {
    const v = this.form.getRawValue();
    const nullIfBlank = (value: string): string | null => (value.trim() === '' ? null : value);

    const hasAddress = [v.addressLine1, v.addressLine2, v.addressCity, v.addressState, v.addressPostalCode, v.addressCountry].some(
      (f) => f.trim() !== ''
    );

    return {
      name: v.name,
      companyCode: v.companyCode,
      registrationNumber: v.registrationNumber,
      taxRegistrationNumber: nullIfBlank(v.taxRegistrationNumber),
      vatGstNumber: nullIfBlank(v.vatGstNumber),
      email: nullIfBlank(v.email),
      phoneNumber: nullIfBlank(v.phoneNumber),
      website: nullIfBlank(v.website),
      countryCode: v.countryCode,
      currencyCode: v.currencyCode,
      timezone: v.timezone,
      financialYearStartMonth: v.financialYearStartMonth,
      firstDayOfWeek: v.firstDayOfWeek,
      standardWorkingDays: v.standardWorkingDays,
      defaultLanguage: v.defaultLanguage,
      dateFormat: v.dateFormat,
      timeFormat: v.timeFormat,
      status: v.status,
      registeredBusinessAddress: hasAddress
        ? {
            line1: nullIfBlank(v.addressLine1),
            line2: nullIfBlank(v.addressLine2),
            city: nullIfBlank(v.addressCity),
            state: nullIfBlank(v.addressState),
            postalCode: nullIfBlank(v.addressPostalCode),
            country: nullIfBlank(v.addressCountry)
          }
        : null
    };
  }
}
