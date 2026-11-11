const MESSAGES: Record<string, string> = {
  planner_disabled: 'The planner is not available yet.',
  /** v1; kept while older APIs may still answer it. */
  planner_not_today: 'Only today can be planned.',
  planner_day_read_only: "Past days can't be changed.",
  planner_beyond_horizon: 'You can plan up to 28 days ahead.',
  planner_invalid_range: 'That range is too long to show.',
  planner_block_overlap: 'This overlaps another planned block.',
  planner_task_not_plannable: 'Only a task assigned to you can be planned.',
  planner_invalid_time: 'A block lasts at least 15 minutes.',
  planner_not_found: 'This plan is not available.',
  planner_block_changed: 'This block was changed by someone else. Refresh and try again.',
};

/** Copy for a planner ProblemDetails `code` (backend PlannerErrorCodes). */
export function plannerErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'Something went wrong. Try again.';
}
