import { HttpErrorResponse } from '@angular/common/http';

const providerName = (provider: string | null | undefined): string => (provider === 'zoom' ? 'Zoom' : 'Microsoft Teams');

/** Turns the backend's meeting problem codes into what happened and what the organizer can do. */
export function meetingErrorMessage(err: unknown, provider: string | null | undefined): string {
  const detail = err instanceof HttpErrorResponse ? (err.error as { detail?: string } | null)?.detail : undefined;
  const name = providerName(provider);
  switch (detail) {
    case 'meeting_link_failed':
      return `The event is saved, but the ${name} link couldn't be created. Invitations were sent without a link; you can add a meeting from the event.`;
    case 'meeting_link_status_unknown':
      return `The event is saved, but we couldn't confirm whether the ${name} meeting was created. Open the event to retry or remove it.`;
    case 'meeting_provider_not_connected':
      return `Connect ${name} in calendar settings to add a ${name} meeting. Invitations were sent without a link.`;
    case 'meeting_link_in_progress':
      return `A ${name} link is already being created for this event.`;
    case 'meeting_link_unresolved':
      return `A ${name} meeting for this event may still exist. Delete it in ${name}, then confirm in the event.`;
    default:
      return 'Failed to add the meeting.';
  }
}
