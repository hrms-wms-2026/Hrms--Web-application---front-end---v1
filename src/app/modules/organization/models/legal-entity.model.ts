/**
 * Legal entity list item model matching backend LegalEntityListItemResponse DTO
 * (HRMS-Backend-v1 LegalEntitiesController.cs line 30, LegalEntityListItemResponse.cs).
 */
export interface LegalEntityListItem {
  readonly id: string;
  readonly name: string;
  readonly companyCode: string | null;
  readonly logoFileId: string | null;
  readonly isActive: boolean;
  readonly isPrimary: boolean;
}

/**
 * Matches backend LegalEntityGeneralSettingsResponse DTO verbatim
 * (LegalEntityGeneralSettingsResponse.cs).
 */
export interface LegalEntityGeneralSettings {
  readonly id: string;
  readonly name: string;
  readonly companyCode: string | null;
  readonly logoFileId: string | null;
  readonly registrationNumber: string | null;
  readonly taxRegistrationNumber: string | null;
  readonly vatGstNumber: string | null;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly website: string | null;
  readonly countryCode: string;
  readonly currencyCode: string;
  readonly timezone: string | null;
  readonly financialYearStartMonth: number;
  readonly firstDayOfWeek: number;
  readonly standardWorkingDays: readonly number[];
  readonly defaultLanguage: string;
  readonly dateFormat: string;
  readonly timeFormat: '12h' | '24h';
  readonly status: 'active' | 'inactive';
  /** Default company work start time in HH:mm 24-hour format. Null when unset. */
  readonly workStartTime: string | null;
  /** Default company work end time in HH:mm 24-hour format. Null when unset. */
  readonly workEndTime: string | null;
  /** Default company break duration in minutes. Null when not configured. Independent of workStartTime/workEndTime. */
  readonly breakDurationMinutes: number | null;
}

/**
 * Matches backend UpdateLegalEntityGeneralSettingsRequest verbatim
 * (UpdateLegalEntityGeneralSettingsRequest.cs). Deliberately excludes id,
 * tenantId, parentLegalEntityId, and logoFileId - none of those are part of
 * this request's field set server-side.
 */
export interface UpdateLegalEntityGeneralSettingsRequest {
  name: string;
  companyCode: string;
  registrationNumber: string;
  taxRegistrationNumber: string | null;
  vatGstNumber: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  financialYearStartMonth: number;
  firstDayOfWeek: number;
  standardWorkingDays: number[];
  defaultLanguage: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  status: 'active' | 'inactive';
  /** Default company work start time in HH:mm 24-hour format. Null to clear. */
  workStartTime: string | null;
  /** Default company work end time in HH:mm 24-hour format. Null to clear. */
  workEndTime: string | null;
  /** Default company break duration in minutes. Null to clear. Independent of workStartTime/workEndTime. */
  breakDurationMinutes: number | null;
}

/**
 * Matches backend CreateLegalEntityRequest verbatim (CreateLegalEntityRequest.cs /
 * LegalEntitiesController.cs POST /api/v1/org/legal-entities). Deliberately excludes
 * tenantId, userId, logoFileId, isPrimary, isActive, and every General Settings-only
 * field (timezone, financialYearStartMonth, firstDayOfWeek, standardWorkingDays,
 * defaultLanguage, dateFormat, timeFormat, status) - none of those are accepted by the
 * create endpoint; the backend applies its own fixed defaults for them. companyCode is
 * typed nullable to mirror the C# DTO's string?, but the backend validator requires it
 * (NotEmpty + max 20) - the create form must treat it as required.
 */
export interface CreateLegalEntityRequest {
  name: string;
  companyCode: string | null;
  registrationNumber: string;
  countryCode: string;
  currencyCode: string;
  taxRegistrationNumber: string | null;
  parentLegalEntityId: string | null;
}
