import { describe, expect, it } from 'vitest';
import { drawerKeyForCreated } from './meeting-created-drawer.util';

describe('drawerKeyForCreated', () => {
  it('opens the new meeting by its series and the start that was sent', () => {
    expect(drawerKeyForCreated({
      outcome: 'created', seriesId: 's9', firstOccurrenceTaskId: 't9', approvalRequestId: null, skipped: [],
      originalStart: '2026-11-02T09:00:00+05:30',
    })).toEqual({ seriesId: 's9', originalStart: '2026-11-02T09:00:00+05:30' });
  });

  it('opens nothing for a request sent for approval, which has no meeting yet', () => {
    expect(drawerKeyForCreated({
      outcome: 'requested', seriesId: null, firstOccurrenceTaskId: null, approvalRequestId: 'r1', skipped: [],
      originalStart: '2026-11-02T09:00:00+05:30',
    })).toBeNull();
  });
});
