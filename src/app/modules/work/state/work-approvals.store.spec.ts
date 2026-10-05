import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { WorkApprovalsStore } from './work-approvals.store';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';
import { ApprovalCommentDto, ApprovalDetailDto, ApprovalFeedItemDto } from '../models/dto/approval-feed.dto';

function feedItem(overrides: Partial<ApprovalFeedItemDto> = {}): ApprovalFeedItemDto {
  return {
    id: 'r1', source: 'engine', actionType: 'task.edit', targetType: 'task', targetId: 't1', targetTitle: 'Audit',
    moduleId: 'm1', moduleTitle: 'Payments', projectName: 'Apollo', status: 'pending', direction: 'received',
    requestedById: 'e1', requestedByName: 'Bala', approverId: 'e2', approverName: 'Anu', decidedById: null,
    decidedByName: null, decisionComment: null, createdAt: '2026-09-29T10:00:00Z', decidedAt: null,
    canDecide: true, canCancel: false, commentCount: 0, summary: null, ...overrides
  };
}

function detailFor(item: ApprovalFeedItemDto): ApprovalDetailDto {
  return {
    item, requestedPayloadJson: '{}', appliedPayloadJson: null, fields: [], canEditPayload: false,
    note: null, currentAllocatedHours: null, invitation: null, canRevert: false, revertableUntil: null
  };
}

const comment: ApprovalCommentDto = {
  id: 'c1', parentCommentId: null, authorId: 'e2', authorName: 'Anu', content: 'hi', isEdited: false,
  canEdit: true, createdAt: '2026-09-30T00:00:00Z', updatedAt: null
};

describe('WorkApprovalsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof WorkApprovalsStore>;

  beforeEach(() => {
    api = {
      getApprovalFeed: vi.fn().mockReturnValue(of([])),
      getApprovalDetail: vi.fn().mockImplementation((id: string) => of(detailFor(feedItem({ id })))),
      getApprovalComments: vi.fn().mockReturnValue(of([])),
      createApprovalComment: vi.fn().mockReturnValue(of(comment)),
      replyApprovalComment: vi.fn().mockReturnValue(of(comment)),
      editApprovalComment: vi.fn().mockReturnValue(of(comment)),
      approveWorkApproval: vi.fn().mockReturnValue(of({})),
      rejectWorkApproval: vi.fn().mockReturnValue(of({})),
      cancelWorkApproval: vi.fn().mockReturnValue(of({})),
      revertWorkApproval: vi.fn().mockReturnValue(of({})),
      acceptObjectiveInvitation: vi.fn().mockReturnValue(of(null)),
      rejectObjectiveInvitation: vi.fn().mockReturnValue(of(null))
    };
    TestBed.configureTestingModule({ providers: [{ provide: WorkApprovalsApiService, useValue: api }] });
    store = TestBed.inject(WorkApprovalsStore);
  });

  it('loadAll sorts pending first and counts received decidable rows', async () => {
    api['getApprovalFeed'].mockReturnValue(of([
      feedItem({ id: 'decided', status: 'approved', canDecide: false, createdAt: '2026-09-30T00:00:00Z' }),
      feedItem({ id: 'mine', direction: 'sent', canDecide: false, canCancel: true }),
      feedItem({ id: 'todo' })
    ]));

    await store.loadAll('p1');

    expect(api['getApprovalFeed']).toHaveBeenCalledWith('p1');
    expect(store.items().map((i) => i.id)).toEqual(['mine', 'todo', 'decided']);
    expect(store.pendingCount()).toBe(1);
    expect(store.projectId()).toBe('p1');
    expect(store.loading()).toBe(false);
  });

  it('loadAll reports errors', async () => {
    api['getApprovalFeed'].mockReturnValue(throwError(() => ({ error: { detail: 'boom' } })));
    await store.loadAll('p1');
    expect(store.error()).toBe('boom');
  });

  it('select loads detail with the source and comments with the matching subject type', async () => {
    const invitation = feedItem({ id: 'i1', source: 'invitation', actionType: 'module.invitation' });
    await store.select(invitation);

    expect(api['getApprovalDetail']).toHaveBeenCalledWith('i1', 'invitation');
    expect(api['getApprovalComments']).toHaveBeenCalledWith('invitation', 'i1');
    expect(store.selectedId()).toBe('i1');
    expect(store.detail()?.item.id).toBe('i1');

    await store.select(feedItem());
    expect(api['getApprovalComments']).toHaveBeenLastCalledWith('approval', 'r1');

    await store.select(null);
    expect(store.selectedId()).toBeNull();
    expect(store.detail()).toBeNull();
    expect(store.comments()).toEqual([]);
  });

  it('approve on an engine row passes the edited payload, then reloads and re-selects', async () => {
    const item = feedItem();
    api['getApprovalFeed'].mockReturnValue(of([item]));
    await store.loadAll('p1');
    await store.select(item);
    api['getApprovalFeed'].mockReturnValue(of([{ ...item, status: 'approved', canDecide: false }]));

    const ok = await store.approve(item, '{"Title":"B"}');

    expect(ok).toBe(true);
    expect(api['approveWorkApproval']).toHaveBeenCalledWith('r1', '{"Title":"B"}');
    expect(api['getApprovalFeed']).toHaveBeenCalledTimes(2);
    expect(store.items()[0].status).toBe('approved');
    expect(store.selectedId()).toBe('r1');
    expect(api['getApprovalDetail']).toHaveBeenCalledTimes(2);
  });

  it('approve on an invitation accepts it', async () => {
    await store.approve(feedItem({ id: 'i1', source: 'invitation' }));
    expect(api['acceptObjectiveInvitation']).toHaveBeenCalledWith('i1');
    expect(api['approveWorkApproval']).not.toHaveBeenCalled();
  });

  it('reject without a reason sends undefined; invitations are declined', async () => {
    await store.reject(feedItem(), null);
    expect(api['rejectWorkApproval']).toHaveBeenCalledWith('r1', undefined);

    await store.reject(feedItem({ id: 'i1', source: 'invitation' }), 'no');
    expect(api['rejectObjectiveInvitation']).toHaveBeenCalledWith('i1');
  });

  it('a failed decision keeps the row and sets the detail error', async () => {
    api['approveWorkApproval'].mockReturnValue(throwError(() => ({ error: { detail: 'Not allowed' } })));
    const ok = await store.approve(feedItem());
    expect(ok).toBe(false);
    expect(store.detailError()).toBe('Not allowed');
    expect(store.busy()).toBe(false);
  });

  it('cancel calls the cancel endpoint', async () => {
    await store.cancel(feedItem({ direction: 'sent', canCancel: true }));
    expect(api['cancelWorkApproval']).toHaveBeenCalledWith('r1');
  });

  it('revert calls the revert endpoint, then reloads and re-selects the row', async () => {
    const item = feedItem({ status: 'approved', canDecide: false });
    api['getApprovalFeed'].mockReturnValue(of([item]));
    await store.loadAll('p1');
    await store.select(item);

    const reverted = feedItem({ status: 'pending' });
    api['getApprovalFeed'].mockReturnValue(of([reverted]));
    await store.revert(item);

    expect(api['revertWorkApproval']).toHaveBeenCalledWith('r1');
    expect(store.items().find((i: ApprovalFeedItemDto) => i.id === 'r1')?.status).toBe('pending');
  });

  it('addComment posts on the selected subject, reloads comments and bumps the count', async () => {
    const item = feedItem();
    api['getApprovalFeed'].mockReturnValue(of([item]));
    await store.loadAll('p1');
    await store.select(item);
    api['getApprovalComments'].mockReturnValue(of([comment]));

    const ok = await store.addComment('hi');

    expect(ok).toBe(true);
    expect(api['createApprovalComment']).toHaveBeenCalledWith('approval', 'r1', 'hi');
    expect(store.comments()).toEqual([comment]);
    expect(store.items()[0].commentCount).toBe(1);
  });

  it('reply and edit hit their endpoints and reload comments', async () => {
    await store.select(feedItem());
    await store.reply('c1', 'yes');
    await store.editComment('c1', 'edited');
    expect(api['replyApprovalComment']).toHaveBeenCalledWith('c1', 'yes');
    expect(api['editApprovalComment']).toHaveBeenCalledWith('c1', 'edited');
    expect(api['getApprovalComments']).toHaveBeenCalledTimes(3);
  });
});
