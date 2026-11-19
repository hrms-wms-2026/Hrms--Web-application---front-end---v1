/**
 * Employment types offered when creating or changing an employee. "Intern" is no longer one of
 * them - it's a role, so it belongs in the position (e.g. "Design Intern"), not the contract type.
 */
export const SELECTABLE_EMPLOYMENT_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' }
];

/** Retired option, still in the backend employment_types lookup: existing employees may hold it. */
export const LEGACY_INTERN_EMPLOYMENT_TYPE = { value: 'intern', label: 'Intern' } as const;

/** Every code the backend lookup can return - for filters/labels over existing data, not for picking. */
export const EMPLOYMENT_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  ...SELECTABLE_EMPLOYMENT_TYPE_OPTIONS,
  LEGACY_INTERN_EMPLOYMENT_TYPE
];
