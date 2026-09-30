import { Component, computed, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ApprovalCommentDto } from '../../models/dto/approval-feed.dto';

interface CommentThread {
  comment: ApprovalCommentDto;
  replies: ApprovalCommentDto[];
}

/** "now", "5m ago", "3h ago", "2d ago", then a short date - same wording as task comments. */
export function formatTimeAgo(isoString: string, now = Date.now()): string {
  const date = new Date(isoString);
  if (!isoString || isNaN(date.getTime())) return '';
  const diffSec = Math.floor((now - date.getTime()) / 1000);
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** The requester <-> approver thread in the explanation card: comment, reply (one level), edit own. */
@Component({
  selector: 'app-approval-comments',
  standalone: true,
  imports: [AvatarComponent],
  template: `
    <div class="ac" data-testid="approval-comments">
      @if (loading() && comments().length === 0) {
        <p class="ac__muted">Loading comments…</p>
      }

      @for (thread of threads(); track thread.comment.id) {
        <div class="ac__thread">
          @let c = thread.comment;
          <article class="ac__comment" data-testid="approval-comment" [attr.data-id]="c.id">
            <app-avatar [userName]="c.authorName" size="sm" />
            <div class="ac__body">
              <div class="ac__meta">
                <strong>{{ c.authorName }}</strong>
                <span>{{ timeAgo(c.createdAt) }}</span>
                @if (c.isEdited) { <span data-testid="approval-comment-edited">(edited)</span> }
              </div>
              @if (editingId() === c.id) {
                <textarea class="ac__input" data-testid="approval-comment-edit-input" rows="3" [value]="editText()"
                  (input)="editText.set($any($event.target).value)"></textarea>
                <div class="ac__row-actions">
                  <button type="button" class="ac__link" (click)="editingId.set(null)">Cancel</button>
                  <button type="button" class="ac__btn" data-testid="approval-comment-edit-save" [disabled]="!editText().trim()" (click)="saveEdit(c.id)">Save</button>
                </div>
              } @else {
                <p class="ac__text">{{ c.content }}</p>
                <div class="ac__row-actions ac__row-actions--start">
                  <button type="button" class="ac__link" data-testid="approval-comment-reply" (click)="startReply(c.id)">Reply</button>
                  @if (c.canEdit) {
                    <button type="button" class="ac__link" data-testid="approval-comment-edit" (click)="startEdit(c)">Edit</button>
                  }
                </div>
              }
            </div>
          </article>

          @for (r of thread.replies; track r.id) {
            <article class="ac__comment ac__comment--reply" data-testid="approval-reply" [attr.data-id]="r.id" [attr.data-parent]="c.id">
              <app-avatar [userName]="r.authorName" size="xs" />
              <div class="ac__body">
                <div class="ac__meta">
                  <strong>{{ r.authorName }}</strong>
                  <span>{{ timeAgo(r.createdAt) }}</span>
                  @if (r.isEdited) { <span>(edited)</span> }
                </div>
                @if (editingId() === r.id) {
                  <textarea class="ac__input" data-testid="approval-comment-edit-input" rows="3" [value]="editText()"
                    (input)="editText.set($any($event.target).value)"></textarea>
                  <div class="ac__row-actions">
                    <button type="button" class="ac__link" (click)="editingId.set(null)">Cancel</button>
                    <button type="button" class="ac__btn" data-testid="approval-comment-edit-save" [disabled]="!editText().trim()" (click)="saveEdit(r.id)">Save</button>
                  </div>
                } @else {
                  <p class="ac__text">{{ r.content }}</p>
                  <div class="ac__row-actions ac__row-actions--start">
                    <button type="button" class="ac__link" data-testid="approval-comment-reply" (click)="startReply(c.id)">Reply</button>
                    @if (r.canEdit) {
                      <button type="button" class="ac__link" data-testid="approval-comment-edit" (click)="startEdit(r)">Edit</button>
                    }
                  </div>
                }
              </div>
            </article>
          }

          @if (replyingTo() === c.id) {
            <div class="ac__reply-box">
              <textarea class="ac__input" data-testid="approval-reply-input" rows="2" placeholder="Write a reply…" [value]="replyText()"
                (input)="replyText.set($any($event.target).value)"></textarea>
              <div class="ac__row-actions">
                <button type="button" class="ac__link" (click)="replyingTo.set(null)">Cancel</button>
                <button type="button" class="ac__btn" data-testid="approval-reply-submit" [disabled]="!replyText().trim()" (click)="submitReply(c.id)">Reply</button>
              </div>
            </div>
          }
        </div>
      }

      <div class="ac__composer">
        <textarea class="ac__input" data-testid="approval-comment-input" rows="2" maxlength="4000" placeholder="Add a comment…"
          [value]="draft()" (input)="draft.set($any($event.target).value)"></textarea>
        <div class="ac__row-actions">
          <button type="button" class="ac__btn" data-testid="approval-comment-submit" [disabled]="!draft().trim()" (click)="submit()">Comment</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ac { display: flex; flex-direction: column; gap: 12px; }
    .ac__muted { margin: 0; color: var(--color-text-secondary); font-size: 12px; }
    .ac__thread { display: flex; flex-direction: column; gap: 8px; }
    .ac__comment { display: flex; gap: 10px; }
    .ac__comment--reply { margin-left: 34px; }
    .ac__body { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 3px; }
    .ac__meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; color: var(--color-text-secondary); font-size: 11px; }
    .ac__meta strong { color: var(--color-text-primary); font-size: 12px; font-weight: 650; }
    .ac__text { margin: 0; color: var(--color-text-primary); font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
    .ac__row-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .ac__row-actions--start { justify-content: flex-start; }
    .ac__link { padding: 0; border: 0; background: none; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ac__link:hover { color: var(--color-accent); }
    .ac__btn { padding: 6px 14px; border: 0; border-radius: 8px; background: var(--color-accent); color: var(--color-accent-contrast); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
    .ac__btn:disabled { opacity: .45; cursor: default; }
    .ac__input { width: 100%; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; resize: vertical; }
    .ac__input:focus { border-color: var(--color-accent); outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .ac__reply-box { display: flex; flex-direction: column; gap: 6px; margin-left: 34px; }
    .ac__composer { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
  `]
})
export class ApprovalCommentsComponent {
  comments = input<readonly ApprovalCommentDto[]>([]);
  loading = input(false);

  add = output<string>();
  reply = output<{ parentId: string; content: string }>();
  edit = output<{ id: string; content: string }>();

  protected readonly draft = signal('');
  protected readonly replyingTo = signal<string | null>(null);
  protected readonly replyText = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editText = signal('');

  /** Top-level comments with their replies (a reply whose parent is missing is shown top-level). */
  protected readonly threads = computed<CommentThread[]>(() => {
    const all = this.comments();
    const topIds = new Set(all.filter((c) => !c.parentCommentId).map((c) => c.id));
    return all
      .filter((c) => !c.parentCommentId || !topIds.has(c.parentCommentId))
      .map((comment) => ({ comment, replies: all.filter((r) => r.parentCommentId === comment.id) }));
  });

  protected timeAgo(iso: string): string {
    return formatTimeAgo(iso);
  }

  protected submit(): void {
    const content = this.draft().trim();
    if (!content) return;
    this.add.emit(content);
    this.draft.set('');
  }

  protected startReply(parentId: string): void {
    this.replyingTo.set(parentId);
    this.replyText.set('');
  }

  protected submitReply(parentId: string): void {
    const content = this.replyText().trim();
    if (!content) return;
    this.reply.emit({ parentId, content });
    this.replyingTo.set(null);
    this.replyText.set('');
  }

  protected startEdit(comment: ApprovalCommentDto): void {
    this.editingId.set(comment.id);
    this.editText.set(comment.content);
  }

  protected saveEdit(id: string): void {
    const content = this.editText().trim();
    if (!content) return;
    this.edit.emit({ id, content });
    this.editingId.set(null);
  }
}
