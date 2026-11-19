// The one place meeting error codes become copy (backend docs/api/meetings-v1.md "Errors").
// meeting_not_found means "does not exist or you may not see it": the copy never mentions access.
const MESSAGES: Record<string, string> = {
  meeting_organizer_cannot_be_removed: "The organizer can't be removed from their own meeting.",
  meeting_response_invalid: 'Choose accept or decline.',
  meeting_title_invalid: 'Give the meeting a title.',
  meeting_platform_invalid: 'Choose Microsoft Teams or Zoom.',
  meeting_guest_email_invalid: 'One of the guest emails is not valid.',
  meeting_invalid_time: 'The meeting must end after it starts.',
  meeting_start_in_past: 'The first occurrence must be in the future.',
  meeting_invalid_timezone: 'Choose a valid time zone.',
  meeting_recurrence_invalid: "That repeat pattern isn't supported.",
  meeting_module_unavailable: 'That module is no longer available.',
  meeting_scope_invalid: 'Choose this, following or all occurrences.',
  meeting_same_module: 'The meeting is already in that module.',
  meeting_organizer_required: 'Only the organizer can do this.',
  meeting_module_member_required: 'You need to be a member of this module.',
  meeting_calendar_write_required: 'You need calendar access to create an Office meeting.',
  meeting_not_found: "This meeting isn't available",
  meeting_changed: 'Someone else changed this meeting. Reload and try again.',
  meeting_occurrence_started: 'This occurrence has already started.',
  meeting_recurrence_empty: 'That change leaves no occurrences.',
  meeting_busy: 'This meeting is being changed. Try again in a moment.',
  meeting_nothing_to_move: 'There are no upcoming occurrences to move.',
  meeting_office_not_ready: "The Office project isn't ready yet. Try again shortly.",
  meeting_provider_not_connected: 'Connect your Teams or Zoom account first, or create the meeting without a link.',
  meetings_read_only: 'Meetings are read-only right now',
  meeting_cancelled: 'This meeting was cancelled.',
  meeting_link_exists: 'This meeting already has a link.',
  meeting_link_in_progress: 'The link is still being created.',
  meeting_link_status_unknown: "We couldn't confirm the link with the provider. Retry to check again.",
  meeting_link_unresolved: 'Delete the meeting in Teams or Zoom, then confirm here.',
  meeting_link_not_retryable: "This link can't be retried now.",
  meeting_link_not_unresolved: 'There is nothing to clean up for this link.',
  attendance_recheck_expired: 'Attendance can only be rechecked for 7 days after the meeting.',
  attendance_check_in_progress: 'Attendance is already being checked.',
  attendance_not_applicable: "This meeting has no online link, so there's no attendance to check.",
  approval_already_decided: 'This request has already been decided.',
  meeting_approval_not_editable: "A meeting request can't be changed by the approver.",
  bulk_invite_unavailable: "Bulk invite isn't available right now.",
  meetings_disabled: "Meetings aren't available right now.",
};

export const MEETING_ERROR_CODES: readonly string[] = Object.keys(MESSAGES);

const FALLBACK = 'Something went wrong. Try again.';

export function meetingErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK;
}
