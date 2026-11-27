/**
 * Form limits for the profile module (Improvements task 24). Each mirrors a backend validator. The frontend may be
 * stricter, never looser: a looser limit lets the user submit a form the server rejects.
 */

/** `UpdatePersonalInformationCommandValidator`. */
export const PERSONAL_INFO_LIMITS = { firstNameMax: 100, lastNameMax: 100, phoneMax: 20 } as const;

/** `AddEmergencyContactCommandValidator` / `UpdateEmergencyContactCommandValidator`. */
export const EMERGENCY_CONTACT_LIMITS = { nameMax: 100, relationshipMax: 30, phoneMax: 20, emailMax: 255 } as const;

/** `AddDependentCommandValidator` / `UpdateDependentCommandValidator`. */
export const DEPENDENT_LIMITS = { nameMax: 100, phoneMax: 20 } as const;

/** `UpdateBankDetailsCommandValidator`. */
export const BANK_DETAILS_LIMITS = {
  bankNameMax: 100,
  branchNameMax: 100,
  accountHolderNameMax: 100,
  accountNumberMax: 34,
  accountTypeMax: 30,
  routingNumberMax: 20,
} as const;
