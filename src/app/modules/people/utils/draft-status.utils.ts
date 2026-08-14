import { DraftReason, DraftStatus } from '../models/onboarding-draft.model';

/**
 * A draft is terminal once finalized, or once its invitation has been sent - the backend rejects
 * any further save/finalize call against it with "This draft has already been finalized."
 * Frontend must treat both signals as terminal since a draft can carry draftReason
 * 'invitation_sent' slightly ahead of its status flipping to 'finalized'.
 */
export function isTerminalDraft(
  status: DraftStatus | string | null | undefined,
  draftReason: DraftReason | string | null | undefined
): boolean {
  return status === 'finalized' || draftReason === 'invitation_sent';
}
