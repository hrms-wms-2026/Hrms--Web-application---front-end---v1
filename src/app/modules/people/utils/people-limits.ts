/**
 * Form limits for the people module (Improvements task 24). Each mirrors a backend validator. The frontend may be
 * stricter, never looser: a looser limit lets the user submit a form the server rejects.
 */

/** `CreateChecklistTemplateCommandValidator`: name max 100, each task title max 200. */
export const CHECKLIST_LIMITS = { templateNameMax: 100, taskTitleMax: 200 } as const;

/** `StartOffboardingCommandValidator`: notes max 4000. */
export const OFFBOARDING_LIMITS = { notesMax: 4000 } as const;
