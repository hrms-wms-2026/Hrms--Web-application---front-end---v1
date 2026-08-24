/** Client-side mirror of backend EmployeeNumberRules — validation only; uniqueness is server-owned. */
export const EMPLOYEE_NUMBER_MAX_LENGTH = 20;
export const EMPLOYEE_NUMBER_PATTERN = /^[A-Za-z0-9_-]+$/;

export const EMPLOYEE_NUMBER_INVALID_FORMAT_MESSAGE =
  'Employee number can only contain letters, numbers, hyphens, and underscores.';
export const EMPLOYEE_NUMBER_IN_USE_MESSAGE = 'This employee number is already in use.';
export const EMPLOYEE_NUMBER_GENERATE_FAILED_MESSAGE =
  'Could not generate an employee number. Enter one manually.';

export function normalizeEmployeeNumber(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function isValidEmployeeNumberFormat(value: string): boolean {
  return value.length > 0 && value.length <= EMPLOYEE_NUMBER_MAX_LENGTH && EMPLOYEE_NUMBER_PATTERN.test(value);
}
