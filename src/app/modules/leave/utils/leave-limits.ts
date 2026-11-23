/**
 * Form limits for the leave module (Improvements task 24). Each mirrors a backend validator. The frontend may be
 * stricter, never looser: a looser limit lets the user submit a form the server rejects.
 */
export const LEAVE_TYPE_LIMITS = {
  /** `LeaveTypeInputValidator`: name required, max 100. */
  nameMax: 100,
  /** `CreateLeaveTypeCommandValidator`: code required, max 20. */
  codeMax: 20,
  /** No backend rule (the column is nvarchar(max)). 500 keeps descriptions short on the type list (stricter). */
  descriptionMax: 500,
  /** `LeaveTypeInputValidator`: a `#RRGGBB` colour. */
  colorPattern: /^#[0-9a-fA-F]{6}$/,
  /** `LeaveTypeInputValidator`: the document threshold must be more than 0 hours. The form asks for at least 0.5. */
  documentAfterHoursMin: 0.5,
} as const;

export const LEAVE_REQUEST_LIMITS = {
  /** `SubmitLeaveRequestCommandValidator` allows 2000. The form keeps 500 (stricter, a product decision). */
  reasonMax: 500,
} as const;
