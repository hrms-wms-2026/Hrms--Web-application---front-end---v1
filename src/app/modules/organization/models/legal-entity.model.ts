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
 * Registered business address shape matching backend LegalEntityAddressDto
 * verbatim (LegalEntityAddressDto.cs). Reused by both the GET response and
 * the PUT request - not flattened, and not merged with the top-level
 * countryCode, which is a separate field.
 */
export interface LegalEntityAddress {
  readonly line1: string | null;
  readonly line2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
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
  readonly registeredBusinessAddress: LegalEntityAddress | null;
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
  registeredBusinessAddress: LegalEntityAddress | null;
}
