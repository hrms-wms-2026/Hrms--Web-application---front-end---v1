import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CompanyLogoTileComponent } from '../../../../shared/ui/company-logo-tile/company-logo-tile.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { LegalEntityApiService } from '../../data-access/legal-entity-api.service';
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../../models/legal-entity.model';
import { GeneralSettingsStore } from '../../state/general-settings.store';
import { LegalEntityStore } from '../../state/legal-entity.store';
import { OfficeLocationChange, OfficeLocationPickerComponent } from './office-location-picker/office-location-picker.component';
import { TimePickerComponent } from '../../../../shared/ui/time-picker/time-picker.component';
import {
  COUNTRY_CODE_OPTIONS,
  CURRENCY_CODE_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_LANGUAGE_OPTIONS,
  FINANCIAL_YEAR_MONTH_OPTIONS,
  FIRST_DAY_OF_WEEK_OPTIONS,
  normalizeCountryCode,
  STATUS_OPTIONS,
  TIME_FORMAT_OPTIONS,
  TIMEZONE_OPTIONS,
  WEEKDAY_OPTIONS
} from '../../utils/general-settings-options';
import {
  absoluteUrlValidator,
  nonEmptyArrayValidator,
  officeLocationValidator,
  oneOfValidator,
  workTimePairValidator
} from '../../utils/general-settings-validators';
import { computeWorkDayHours, isOvernightWorkWindow } from '../../utils/work-day-hours';

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
    BreadcrumbHeaderComponent,
    ButtonComponent,
    CompanyLogoTileComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InputComponent,
    SelectComponent,
    TimePickerComponent,
    OfficeLocationPickerComponent
  ],
  templateUrl: './general-settings.component.html',
  styleUrl: './general-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly legalEntityApi = inject(LegalEntityApiService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly settingsStore = inject(GeneralSettingsStore);

  readonly WEEKDAY_OPTIONS = WEEKDAY_OPTIONS;
  readonly FIRST_DAY_OF_WEEK_OPTIONS = FIRST_DAY_OF_WEEK_OPTIONS;
  readonly FINANCIAL_YEAR_MONTH_OPTIONS = FINANCIAL_YEAR_MONTH_OPTIONS;
  readonly TIME_FORMAT_OPTIONS = TIME_FORMAT_OPTIONS;
  readonly STATUS_OPTIONS = STATUS_OPTIONS;
  readonly DATE_FORMAT_OPTIONS = DATE_FORMAT_OPTIONS;
  readonly DEFAULT_LANGUAGE_OPTIONS = DEFAULT_LANGUAGE_OPTIONS;
  readonly COUNTRY_CODE_OPTIONS = COUNTRY_CODE_OPTIONS;
  readonly CURRENCY_CODE_OPTIONS = CURRENCY_CODE_OPTIONS;
  readonly TIMEZONE_OPTIONS = TIMEZONE_OPTIONS;

  readonly hasAccess = computed(() => this.permissionService.hasPermission('legal_entity:update'));
  readonly selectedLegalEntity = this.legalEntityStore.selectedLegalEntity;
  readonly submitting = signal(false);
  readonly uploadingLogo = this.settingsStore.uploadingLogo;
  readonly removingLogo = this.settingsStore.removingLogo;

  private static readonly ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  private static readonly MAX_LOGO_BYTES = 5 * 1024 * 1024;

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
    // Phase 1 supports English only - locked, not user-editable (CreateLegalEntityCommandHandler.cs
    // always sets DefaultLanguage = "en-US" for new legal entities).
    defaultLanguage: [{ value: 'en-US', disabled: true }, [Validators.required, Validators.maxLength(10)]],
    dateFormat: ['DD/MM/YYYY', [Validators.required, Validators.maxLength(20)]],
    timeFormat: ['24h' as '12h' | '24h', [Validators.required, oneOfValidator(['12h', '24h'])]],
    status: ['active' as 'active' | 'inactive', [Validators.required, oneOfValidator(['active', 'inactive'])]],
    // Work hours — optional pair, validated as a group (both-or-neither, start < end).
    workStartTime: ['', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    workEndTime: ['', [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)]],
    // Break duration — optional, independent of work start/end time. Blank allowed;
    // non-negative whole-minute values only (the pattern rejects decimals/negatives).
    breakDurationMinutes: ['', [Validators.pattern(/^\d+$/)]],
    // Office location for the on-site work-location warning — optional, all-or-nothing
    // (officeLocationValidator). officeLatitude/officeLongitude are set by the map picker, never
    // typed directly. The geofence radius lives on Clock-in Policy (Allowed distance), not here.
    officeAddress: ['', [Validators.maxLength(500)]],
    officeLatitude: this.fb.control<number | null>(null),
    officeLongitude: this.fb.control<number | null>(null)
  }, { validators: [workTimePairValidator(), officeLocationValidator()] });

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

  onOfficeLocationChange(change: OfficeLocationChange): void {
    this.form.patchValue({
      officeAddress: change.address,
      officeLatitude: change.latitude,
      officeLongitude: change.longitude
    });
    this.form.controls.officeAddress.markAsDirty();
    this.form.controls.officeLatitude.markAsDirty();
    this.form.controls.officeLongitude.markAsDirty();
  }

  onOfficeLocationCleared(): void {
    this.form.patchValue({ officeAddress: '', officeLatitude: null, officeLongitude: null });
    this.form.controls.officeAddress.markAsDirty();
    this.form.controls.officeLatitude.markAsDirty();
    this.form.controls.officeLongitude.markAsDirty();
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

  getWorkingHoursSummary(): string | null {
    const hours = computeWorkDayHours(
      this.form.controls.workStartTime.value,
      this.form.controls.workEndTime.value,
      this.form.controls.breakDurationMinutes.value
    );
    if (hours === null || hours <= 0) return null;
    return `${hours.toFixed(1)} working hours / day · this is 1 leave day`;
  }

  isOvernightWindow(): boolean {
    const start = this.form.controls.workStartTime.value;
    const end = this.form.controls.workEndTime.value;
    if (!start || !end) return false;
    return isOvernightWorkWindow(start, end);
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

  logoUrl(): string | null {
    const company = this.selectedLegalEntity();
    const logoFileId = this.settingsStore.settings()?.logoFileId;
    if (!company || !logoFileId) {
      return null;
    }
    return this.legalEntityApi.getLogoUrl(company.id, logoFileId);
  }

  async onLogoFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (!GeneralSettingsComponent.ALLOWED_LOGO_TYPES.includes(file.type)) {
      this.notificationService.error('Logo must be a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > GeneralSettingsComponent.MAX_LOGO_BYTES) {
      this.notificationService.error('Logo must be 5 MB or smaller.');
      return;
    }

    const company = this.selectedLegalEntity();
    if (!company) {
      return;
    }

    const ok = await this.settingsStore.uploadLogo(company.id, file);
    if (ok) {
      this.notificationService.success('Logo uploaded.');
    } else {
      this.notificationService.error(this.settingsStore.saveError() ?? 'Failed to upload logo.');
    }
  }

  async onRemoveLogo(): Promise<void> {
    const company = this.selectedLegalEntity();
    if (!company) {
      return;
    }

    const ok = await this.settingsStore.removeLogo(company.id);
    if (ok) {
      this.notificationService.success('Logo removed.');
    } else {
      this.notificationService.error(this.settingsStore.saveError() ?? 'Failed to remove logo.');
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
      defaultLanguage: 'en-US',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h' as const,
      status: 'active' as const,
      workStartTime: '',
      workEndTime: '',
      breakDurationMinutes: '',
      officeAddress: '',
      officeLatitude: null as number | null,
      officeLongitude: null as number | null
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
      defaultLanguage: settings.defaultLanguage || 'en-US',
      dateFormat: settings.dateFormat || 'DD/MM/YYYY',
      timeFormat: settings.timeFormat || '24h',
      status: settings.status,
      workStartTime: settings.workStartTime ?? '',
      workEndTime: settings.workEndTime ?? '',
      breakDurationMinutes: settings.breakDurationMinutes != null ? String(settings.breakDurationMinutes) : '',
      officeAddress: settings.officeAddress ?? '',
      officeLatitude: settings.officeLatitude,
      officeLongitude: settings.officeLongitude
    };
  }

  private toRequestPayload(): UpdateLegalEntityGeneralSettingsRequest {
    const v = this.form.getRawValue();
    const nullIfBlank = (value: string): string | null => (value.trim() === '' ? null : value);

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
      defaultLanguage: v.defaultLanguage || 'en-US',
      dateFormat: v.dateFormat || 'DD/MM/YYYY',
      timeFormat: v.timeFormat || '24h',
      status: v.status,
      workStartTime: v.workStartTime.trim() !== '' ? v.workStartTime : null,
      workEndTime: v.workEndTime.trim() !== '' ? v.workEndTime : null,
      breakDurationMinutes: v.breakDurationMinutes.trim() !== '' ? Number(v.breakDurationMinutes) : null,
      officeAddress: nullIfBlank(v.officeAddress),
      officeLatitude: v.officeLatitude,
      officeLongitude: v.officeLongitude
    };
  }
}
