/**
 * Character limits for free-text description fields. Where the backend stores the value in a
 * sized column (or validates it), the limit here must match it, or saves past it will fail.
 */
export const TEXT_LIMITS = {
  /** RoleConfiguration: HasMaxLength(255). */
  roleDescription: 255,
  /** ConversationConfigurations: HasMaxLength(500). */
  conversationDescription: 500,
  /** Leave type form (frontend limit). */
  leaveTypeDescription: 500,
  /** Create/UpdateLeavePolicy validators: MaximumLength(1000). */
  leavePolicyDescription: 1000,
  /** CreateCalendarEventCommandValidator: MaximumLength(2000). */
  calendarEventDescription: 2000,
  /** EmployeeChecklistTaskConfiguration: BypassPenaltyDescription HasMaxLength(500). */
  bypassPenaltyDescription: 500,
  /** Project description (no backend column limit; frontend limit). */
  projectDescription: 1000,
  /** Sub-module description (no backend column limit; frontend limit). */
  subModuleDescription: 500,
  /** Rich-text descriptions (tasks, meetings, checklist tasks), counted as visible text. */
  richTextDescription: 10000,
  /** Rich-text comments, counted as visible text. */
  comment: 5000
} as const;

/** Share of the limit at which the character counter appears. */
export const CHAR_COUNTER_THRESHOLD = 0.8;
