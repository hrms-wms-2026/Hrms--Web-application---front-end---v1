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
