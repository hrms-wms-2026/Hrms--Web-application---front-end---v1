import { isTerminalDraft } from './draft-status.utils';

describe('isTerminalDraft', () => {
  it('is terminal when status is finalized', () => {
    expect(isTerminalDraft('finalized', 'saved_manually')).toBe(true);
  });

  it('is terminal when draftReason is invitation_sent, regardless of status', () => {
    expect(isTerminalDraft('draft', 'invitation_sent')).toBe(true);
  });

  it('is not terminal for an in-progress draft with no special reason', () => {
    expect(isTerminalDraft('draft', 'saved_manually')).toBe(false);
  });

  it('is not terminal for waiting_for_seat', () => {
    expect(isTerminalDraft('waiting_for_seat', 'waiting_for_seat')).toBe(false);
  });

  it('is not terminal for waiting_for_position_approval', () => {
    expect(isTerminalDraft('waiting_for_position_approval', 'waiting_for_position_approval')).toBe(false);
  });

  it('is not terminal when status and reason are both null', () => {
    expect(isTerminalDraft(null, null)).toBe(false);
  });
});
