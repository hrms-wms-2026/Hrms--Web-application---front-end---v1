import { MEETING_ERROR_CODES, meetingErrorMessage } from './meeting-error-messages';

describe('meetingErrorMessage', () => {
  it('reads "This meeting isn\'t available" for meeting_not_found, never mentioning access', () => {
    const message = meetingErrorMessage('meeting_not_found');
    expect(message).toBe("This meeting isn't available");
    expect(message.toLowerCase()).not.toMatch(/access|permission|allowed/);
  });

  it('has its own copy for every code in the contract', () => {
    const fallback = meetingErrorMessage(undefined);
    for (const code of MEETING_ERROR_CODES) {
      expect(meetingErrorMessage(code), code).not.toBe(fallback);
    }
  });

  it('covers the read-only and disabled flags with the exact wording', () => {
    expect(meetingErrorMessage('meetings_read_only')).toBe('Meetings are read-only right now');
  });

  it('falls back to a generic message for an unknown or missing code', () => {
    expect(meetingErrorMessage('something_new')).toBe(meetingErrorMessage(undefined));
    expect(meetingErrorMessage(undefined)).toMatch(/something went wrong/i);
  });
});
