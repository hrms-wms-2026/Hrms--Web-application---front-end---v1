const MESSAGES: Record<string, string> = {
  planner_disabled: 'The planner is not available yet.',
  planner_not_today: 'Only today can be planned.',
  planner_block_overlap: 'This overlaps another planned block.',
  planner_task_not_plannable: 'Only a task assigned to you can be planned.',
  planner_invalid_time: 'A block lasts at least 15 minutes.',
  planner_not_found: 'This plan is not available.',
};

/** Copy for a planner ProblemDetails `code` (backend PlannerErrorCodes). */
export function plannerErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || 'Something went wrong. Try again.';
}
