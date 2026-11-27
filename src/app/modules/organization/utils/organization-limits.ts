/**
 * Form limits for the organization module (Improvements task 24). Each mirrors a backend validator. The frontend may
 * be stricter, never looser: a looser limit lets the user submit a form the server rejects.
 */
export const DEPARTMENT_LIMITS = {
  /** `DepartmentInputValidator`: name required, max 100. */
  nameMax: 100,
  /** `DepartmentInputValidator`: code max 20. The backend allows an empty code; the form requires one (stricter). */
  codeMax: 20,
  /** `DepartmentInputValidator.CodePattern`, checked on the trimmed code. */
  codePattern: /^[A-Za-z0-9_-]{1,20}$/,
} as const;

export const POSITION_LIMITS = {
  /** `PositionInputValidator`: name max 100 (the form requires it). */
  nameMax: 100,
  /** `PositionInputValidator`: code max 5, letters, numbers, hyphens and underscores, checked on the trimmed code. */
  codeMax: 5,
  codePattern: /^[A-Za-z0-9_-]{1,5}$/,
  /** `PositionInputValidator`: capacity at least 1. */
  minOccupancy: 1,
} as const;

export const ROLE_LIMITS = {
  /** `CreateRoleCommandValidator` / `UpdateRoleCommandValidator`: name max 50. */
  nameMax: 50,
  /** Same validators: `Matches("^[A-Za-z0-9 _-]+$")`. */
  namePattern: /^[A-Za-z0-9 _-]+$/,
  /** Same validators: description max 255 (`TEXT_LIMITS.roleDescription`). */
  descriptionMax: 255,
} as const;

/** `CreateLegalEntityCommandValidator` and `UpdateLegalEntityGeneralSettingsCommandValidator`. */
export const COMPANY_LIMITS = {
  nameMax: 200,
  codeMax: 20,
  registrationNumberMax: 50,
  taxRegistrationNumberMax: 80,
  vatGstNumberMax: 50,
  emailMax: 254,
  phoneMax: 20,
  websiteMax: 255,
  countryCodeMax: 3,
  currencyCodeMax: 3,
  timezoneMax: 50,
  defaultLanguageMax: 10,
  dateFormatMax: 20,
  officeAddressMax: 500,
} as const;
