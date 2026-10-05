import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';
import {
  ApprovalCommentDto,
  ApprovalCommentSubjectType,
  ApprovalDetailDto,
  ApprovalFeedItemDto
} from '../models/dto/approval-feed.dto';
import { sortFeed } from '../utils/approval-feed.util';

interface WorkApprovalsState {
  /** Every request the caller sent or received in the project, pending first. */
  readonly items: readonly ApprovalFeedItemDto[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly projectId: string | null;
  readonly selectedId: string | null;
  readonly detail: ApprovalDetailDto | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly comments: readonly ApprovalCommentDto[];
  readonly commentsLoading: boolean;
  /** A decision is in flight. */
  readonly busy: boolean;
}

const initialState: WorkApprovalsState = {
  items: [],
  loading: false,
  error: null,
  projectId: null,
  selectedId: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  comments: [],
  commentsLoading: false,
  busy: false
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

function subjectTypeOf(item: ApprovalFeedItemDto): ApprovalCommentSubjectType {
  return item.source === 'invitation' ? 'invitation' : 'approval';
}

export const WorkApprovalsStore = signalStore(
  { providedIn: 'root' },
  withState<WorkApprovalsState>(initialState),
  withComputed((store) => ({
    /** The red dot on the Approvals tab: requests waiting on the caller. */
    pendingCount: computed(() => store.items().filter((i) => i.direction === 'received' && i.canDecide).length),
    selected: computed(() => store.items().find((i) => i.id === store.selectedId()) ?? null)
  })),
  withMethods((store, api = inject(WorkApprovalsApiService)) => {
    // Guards against a slow detail/comments response overwriting a newer selection.
    let selectVersion = 0;

    const loadComments = async (item: ApprovalFeedItemDto, version: number): Promise<void> => {
      patchState(store, { commentsLoading: true });
      try {
        const comments = await firstValueFrom(api.getApprovalComments(subjectTypeOf(item), item.id));
        if (version === selectVersion) patchState(store, { comments, commentsLoading: false });
      } catch {
        if (version === selectVersion) patchState(store, { commentsLoading: false });
      }
    };

    const loadAll = async (projectId: string): Promise<void> => {
      patchState(store, { loading: true, error: null, projectId });
      try {
        const items = await firstValueFrom(api.getApprovalFeed(projectId));
        // A project switch while loading makes this response stale.
        if (store.projectId() === projectId) patchState(store, { items: sortFeed(items), loading: false });
      } catch (err) {
        if (store.projectId() === projectId) patchState(store, { error: extractError(err, 'Failed to load approvals.'), loading: false });
      }
    };

    const select = async (item: ApprovalFeedItemDto | null): Promise<void> => {
      const version = ++selectVersion;
      if (!item) {
        patchState(store, { selectedId: null, detail: null, detailLoading: false, detailError: null, comments: [], commentsLoading: false });
        return;
      }
      const sameRow = store.selectedId() === item.id;
      patchState(store, {
        selectedId: item.id, detailLoading: true, detailError: null,
        // Keep the current card while re-selecting the same row (after a decision) to avoid a flash.
        ...(sameRow ? {} : { detail: null, comments: [] })
      });
      const commentsLoad = loadComments(item, version);
      try {
        const detail = await firstValueFrom(api.getApprovalDetail(item.id, item.source));
        if (version === selectVersion) patchState(store, { detail, detailLoading: false });
      } catch (err) {
        if (version === selectVersion) patchState(store, { detailError: extractError(err, 'Failed to load the request.'), detailLoading: false });
      }
      await commentsLoad;
    };

    /** Runs a decision, then reloads the feed (the row moves into history) and re-selects it. */
    const decide = async (item: ApprovalFeedItemDto, action: () => Promise<unknown>, fallback: string): Promise<boolean> => {
      patchState(store, { busy: true, detailError: null });
      try {
        await action();
      } catch (err) {
        patchState(store, { busy: false, detailError: extractError(err, fallback) });
        return false;
      }
      const projectId = store.projectId();
      if (projectId) await loadAll(projectId);
      patchState(store, { busy: false });
      if (store.selectedId() === item.id) {
        await select(store.items().find((i) => i.id === item.id) ?? null);
      }
      return true;
    };

    const bumpCommentCount = (id: string) => patchState(store, {
      items: store.items().map((i) => i.id === id ? { ...i, commentCount: i.commentCount + 1 } : i)
    });

    /** Runs a comment mutation on the selected row, then reloads its thread. */
    const mutateComment = async (run: (item: ApprovalFeedItemDto) => Promise<unknown>, adds: boolean): Promise<boolean> => {
      const item = store.detail()?.item ?? store.selected();
      if (!item) return false;
      patchState(store, { detailError: null });
      try {
        await run(item);
      } catch (err) {
        patchState(store, { detailError: extractError(err, 'Failed to save the comment.') });
        return false;
      }
      if (adds) bumpCommentCount(item.id);
      await loadComments(item, selectVersion);
      return true;
    };

    return {
      loadAll,
      select,

      approve(item: ApprovalFeedItemDto, editedPayloadJson?: string): Promise<boolean> {
        return decide(item, () => item.source === 'invitation'
          ? firstValueFrom(api.acceptObjectiveInvitation(item.id))
          : firstValueFrom(api.approveWorkApproval(item.id, editedPayloadJson)), 'Failed to approve.');
      },

      /** The reason is optional; an empty one is sent as no comment. Invitations can't carry one. */
      reject(item: ApprovalFeedItemDto, reason?: string | null): Promise<boolean> {
        return decide(item, () => item.source === 'invitation'
          ? firstValueFrom(api.rejectObjectiveInvitation(item.id))
          : firstValueFrom(api.rejectWorkApproval(item.id, reason || undefined)), 'Failed to reject.');
      },

      cancel(item: ApprovalFeedItemDto): Promise<boolean> {
        return decide(item, () => firstValueFrom(api.cancelWorkApproval(item.id)), 'Failed to cancel the request.');
      },

      revert(item: ApprovalFeedItemDto): Promise<boolean> {
        return decide(item, () => firstValueFrom(api.revertWorkApproval(item.id)), 'Failed to revert the decision.');
      },

      addComment(content: string): Promise<boolean> {
        return mutateComment((item) => firstValueFrom(api.createApprovalComment(subjectTypeOf(item), item.id, content)), true);
      },

      reply(parentId: string, content: string): Promise<boolean> {
        return mutateComment(() => firstValueFrom(api.replyApprovalComment(parentId, content)), true);
      },

      editComment(id: string, content: string): Promise<boolean> {
        return mutateComment(() => firstValueFrom(api.editApprovalComment(id, content)), false);
      }
    };
  })
);
