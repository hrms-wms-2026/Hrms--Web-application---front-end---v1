import { HttpErrorResponse } from '@angular/common/http';
import { meetingErrorMessage } from './meeting-error-message';

const problem = (detail: string, status = 409) => new HttpErrorResponse({ status, error: { detail } });

describe('meetingErrorMessage', () => {
  it('explains a failed link and that invitations still went out', () => {
    expect(meetingErrorMessage(problem('meeting_link_failed', 502), 'microsoft_teams'))
      .toBe("The event is saved, but the Microsoft Teams link couldn't be created. Invitations were sent without a link; you can add a meeting from the event.");
  });

  it('explains an unknown link status', () => {
    expect(meetingErrorMessage(problem('meeting_link_status_unknown'), 'zoom'))
      .toContain("couldn't confirm whether the Zoom meeting was created");
  });

  it('explains a missing connection', () => {
    expect(meetingErrorMessage(problem('meeting_provider_not_connected'), 'zoom')).toContain('Connect Zoom');
  });

  it('falls back to a generic message', () => {
    expect(meetingErrorMessage(new Error('boom'), 'zoom')).toBe('Failed to add the meeting.');
  });
});
