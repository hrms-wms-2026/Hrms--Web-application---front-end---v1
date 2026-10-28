import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeetingApiService } from '../data-access/meeting-api.service';
import { MeetingOccurrenceResponse } from '../models/meeting.models';
import { MeetingOccurrenceStore } from './meeting-occurrence.store';

describe('MeetingOccurrenceStore', () => {
  const api = { getOccurrenceAt: vi.fn(), getOccurrence: vi.fn(), cancel: vi.fn(), move: vi.fn(), respond: vi.fn() };
  let store: InstanceType<typeof MeetingOccurrenceStore>;
  const occ = { seriesId: 's1', originalStart: '2026-11-02T03:30:00Z', taskId: 't1' } as MeetingOccurrenceResponse;

  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    TestBed.configureTestingModule({ providers: [MeetingOccurrenceStore, { provide: MeetingApiService, useValue: api }] });
    store = TestBed.inject(MeetingOccurrenceStore);
  });

  it('keeps the key it loaded by, so later reloads address the same occurrence', async () => {
    api.getOccurrence.mockReturnValue(of(occ));
    api.getOccurrenceAt.mockReturnValue(of(occ));
    await store.load({ taskId: 't1' });
    await store.reload();
    expect(api.getOccurrenceAt).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z');
  });

  it('marks a 404 as not available and clears the occurrence', async () => {
    api.getOccurrenceAt.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { code: 'meeting_not_found' } })));
    await store.load({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    expect(store.notFound()).toBe(true);
    expect(store.occurrence()).toBeNull();
  });

  it('cancel then reloads; a moved series is followed', async () => {
    api.getOccurrenceAt.mockReturnValue(of(occ));
    await store.load({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
    api.cancel.mockReturnValue(of(undefined));
    await store.cancel('this');
    expect(api.cancel).toHaveBeenCalledWith('s1', '2026-11-02T03:30:00Z', 'this');

    api.move.mockReturnValue(of({ outcome: 'moved', seriesId: 's3', approvalRequestId: null }));
    const outcome = await store.move('following', 'p2', 'o2');
    expect(outcome).toBe('moved');
    expect(api.getOccurrenceAt).toHaveBeenLastCalledWith('s3', '2026-11-02T03:30:00Z');
  });
});
