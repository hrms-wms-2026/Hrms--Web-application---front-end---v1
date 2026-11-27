/** Auth form limits (Improvements task 24). Each mirrors the backend. */
export const AUTH_LIMITS = {
  /** `PasswordPolicy.MinimumLength` (tenant users), used by reset password and accept invitation. */
  passwordMin: 8,
} as const;
