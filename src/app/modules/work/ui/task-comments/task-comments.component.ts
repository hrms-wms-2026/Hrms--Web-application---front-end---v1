import { Component, HostListener, computed, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { TaskCommentApiService } from '../../data-access/task-comment-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCommentDto, TaskCommentReactionDto } from '../../models/dto/task-comment.dto';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { CommentComposerComponent } from '../comment-composer/comment-composer.component';
import { EmojiPickerComponent } from '../emoji-picker/emoji-picker.component';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [EmployeeAvatarComponent, NgTemplateOutlet, DatePipe, CommentComposerComponent, EmojiPickerComponent],
  template: `
    <div class="tc-composer-row">
      <div class="tc-current-user-avatar">
        <app-employee-avatar [employeeId]="currentEmployeeId() || ''" />
      </div>
      <div class="tc-composer-wrap">
        <app-comment-composer
          placeholder="Add a comment..."
          submitLabel="Save"
          [showCancel]="true"
          [showQuickChips]="true"
          [showProTip]="true"
          (submitted)="submitComment($event)"
        />
      </div>
    </div>

    @if (comments().length === 0) {
      <p class="tc-empty">No comments yet</p>
    } @else {
      <ul class="tc-list">
        @for (comment of sortedComments(); track comment.id) {
          <li class="tc-item">
            <ng-container *ngTemplateOutlet="commentRow; context: { $implicit: comment }" />
            @if (comment.replies.length > 0) {
              <ul class="tc-replies">
                @for (reply of comment.replies; track reply.id) {
                  <li><ng-container *ngTemplateOutlet="commentRow; context: { $implicit: reply }" /></li>
                }
              </ul>
            }
            @if (replyingToId() === comment.id) {
              <div class="tc-reply-composer">
                <app-comment-composer placeholder="Write a reply..." submitLabel="Reply" [showCancel]="true"
                  (submitted)="submitReply(comment.id, $event)" (cancelled)="cancelReply()" />
              </div>
            }
          </li>
        }
      </ul>
    }

    <ng-template #commentRow let-comment>
      <div class="tc-comment-item" [class.tc-comment-item--reply]="comment.parentCommentId" data-testid="comment-card">
        <!-- Avatar Column -->
        <div class="tc-avatar-col">
          <app-employee-avatar [employeeId]="comment.employeeId" />
        </div>

        <!-- Body Column -->
        <div class="tc-body-col">
          <!-- Header: Line 1 (Name + Copy link icon), Line 2 (Time) -->
          <div class="tc-header">
            <div class="tc-author-row">
              <span class="tc-author-name">{{ comment.employeeName }}</span>
              <button
                type="button"
                class="tc-link-btn"
                title="Copy link to comment"
                aria-label="Copy link to comment"
                (click)="copyCommentLink(comment.id)"
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                </svg>
              </button>
            </div>
            <div class="tc-time-row">
              <time class="tc-time" [title]="comment.createdAt | date: 'medium'">{{ formatTimeAgo(comment.createdAt) }}</time>
              @if (comment.isEdited) {
                <span class="tc-edited">· edited</span>
              }
            </div>
          </div>

          <!-- Body Content / Inline Edit -->
          <div class="tc-content-wrap">
            @if (comment.isDeleted) {
              <p class="tc-deleted">[comment deleted]</p>
            } @else if (editingCommentId() === comment.id) {
              <app-comment-composer
                [initialContent]="comment.content"
                [initialAttachments]="comment.attachments"
                submitLabel="Save"
                [showCancel]="true"
                (submitted)="saveEdit(comment.id, $event)"
                (cancelled)="cancelEdit()"
              />
            } @else {
              <div class="tc-text" [innerHTML]="comment.content"></div>
            }
          </div>

          <!-- Action bar: ↩ Reply | 👍 / [ 👍 1 ] | Other reaction pills | ☺+ Add reaction | ✏ Edit | ••• More -->
          @if (!comment.isDeleted && editingCommentId() !== comment.id) {
            <div class="tc-actions-bar">
              <!-- ↩ Reply (only for top-level comments) -->
              @if (!comment.parentCommentId) {
                <button
                  type="button"
                  class="tc-icon-btn tc-reply-btn"
                  title="Reply"
                  aria-label="Reply to comment"
                  (click)="startReply(comment.id)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 14 4 9 9 4"></polyline>
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                  </svg>
                </button>
              }

              <!-- Thumbs-up: Pill if count > 0, else outline icon -->
              @if (reactionCount(comment, '👍') > 0) {
                <button
                  type="button"
                  class="tc-reaction-pill"
                  [class.tc-reaction-pill--active]="hasReacted(comment, '👍')"
                  [title]="hasReacted(comment, '👍') ? 'You reacted with 👍' : '👍'"
                  (click)="toggleReaction(comment, '👍')"
                >
                  <span class="tc-reaction-emoji">👍</span>
                  <span class="tc-reaction-count">{{ reactionCount(comment, '👍') }}</span>
                </button>
              } @else {
                <button
                  type="button"
                  class="tc-icon-btn"
                  title="React with 👍"
                  aria-label="React with thumbs up"
                  (click)="toggleReaction(comment, '👍')"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                  </svg>
                </button>
              }

              <!-- Other reactions with count > 0 -->
              @for (r of otherActiveReactions(comment); track r.emoji) {
                <button
                  type="button"
                  class="tc-reaction-pill"
                  [class.tc-reaction-pill--active]="hasReacted(comment, r.emoji)"
                  [title]="hasReacted(comment, r.emoji) ? 'You reacted with ' + r.emoji : r.emoji"
                  (click)="toggleReaction(comment, r.emoji)"
                >
                  <span class="tc-reaction-emoji">{{ r.emoji }}</span>
                  <span class="tc-reaction-count">{{ r.count }}</span>
                </button>
              }

              <!-- ☺+ Add reaction (smiley face with +) -->
              <div class="tc-picker-anchor">
                <button
                  type="button"
                  class="tc-icon-btn"
                  title="Add reaction"
                  aria-label="Add reaction"
                  (click)="toggleEmojiPicker(comment.id)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="13" r="8"></circle>
                    <path d="M8 15s1 1.5 3 1.5 3-1.5 3-1.5"></path>
                    <line x1="9" y1="12" x2="9.01" y2="12"></line>
                    <line x1="13" y1="12" x2="13.01" y2="12"></line>
                    <line x1="19" y1="2" x2="19" y2="8"></line>
                    <line x1="16" y1="5" x2="22" y2="5"></line>
                  </svg>
                </button>
                @if (emojiPickerOpenFor() === comment.id) {
                  <app-emoji-picker (emojiSelected)="onEmojiPicked(comment, $event)" />
                }
              </div>

              <!-- ✏ Edit button -->
              @if (canModify(comment)) {
                <button
                  type="button"
                  class="tc-icon-btn"
                  title="Edit comment"
                  aria-label="Edit comment"
                  (click)="startEdit(comment)"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
              }

              <!-- ••• More options menu -->
              <div class="tc-more-anchor">
                <button
                  type="button"
                  class="tc-icon-btn"
                  title="More actions"
                  aria-label="More actions"
                  (click)="toggleMoreMenu(comment.id, $event)"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <circle cx="5" cy="12" r="1.5"></circle>
                    <circle cx="12" cy="12" r="1.5"></circle>
                    <circle cx="19" cy="12" r="1.5"></circle>
                  </svg>
                </button>

                @if (moreMenuOpenFor() === comment.id) {
                  <div class="tc-more-menu" (click)="$event.stopPropagation()">
                    <button type="button" class="tc-more-item" (click)="copyCommentLink(comment.id); closeMoreMenu()">
                      <span>Copy link</span>
                    </button>
                    @if (canModify(comment)) {
                      <button type="button" class="tc-more-item tc-more-item--danger" (click)="deleteComment(comment.id); closeMoreMenu()">
                        <span>Delete</span>
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .tc-composer-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 24px; }
    .tc-current-user-avatar { flex-shrink: 0; margin-top: 2px; }
    .tc-composer-wrap { flex: 1; min-width: 0; }
    .tc-empty { color: var(--color-text-secondary); font-size: 13.5px; text-align: center; padding: 24px 16px; border: 1px dashed var(--color-border); border-radius: 8px; }
    .tc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .tc-item { display: flex; flex-direction: column; gap: 8px; }

    /* Clean open comment layout (ClickUp style) */
    .tc-comment-item {
      position: relative;
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 4px 0;
    }
    .tc-avatar-col { flex-shrink: 0; margin-top: 2px; }
    .tc-body-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

    /* Header */
    .tc-header { display: flex; flex-direction: column; gap: 1px; }
    .tc-author-row { display: flex; align-items: center; gap: 6px; }
    .tc-author-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary, #1e293b);
      line-height: 1.3;
    }
    .tc-link-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      padding: 2px;
      color: var(--color-text-secondary, #64748b);
      cursor: pointer;
      opacity: 0.6;
      border-radius: 4px;
      transition: opacity 0.15s ease, color 0.15s ease;
    }
    .tc-comment-item:hover .tc-link-btn { opacity: 0.85; }
    .tc-link-btn:hover { opacity: 1; color: var(--color-accent, #2563eb); }

    .tc-time-row { display: flex; align-items: center; gap: 4px; }
    .tc-time { font-size: 12px; color: var(--color-text-secondary, #64748b); line-height: 1.2; }
    .tc-edited { font-size: 11.5px; color: var(--color-text-secondary, #64748b); }

    /* Body & Text */
    .tc-content-wrap { margin: 6px 0 2px 0; }
    .tc-text {
      font-size: 14px;
      line-height: 1.5;
      color: var(--color-text-primary, #1e293b);
      word-break: break-word;
      white-space: pre-wrap;
    }
    /*
     * Comment HTML comes from the shared rich-text editor and is rendered via [innerHTML], so these
     * need ::ng-deep (no _ngcontent attribute on those nodes). Angular's sanitizer strips the
     * checklist <input>, so the checkbox is drawn from the persisted .is-checked class instead.
     */
    .tc-text ::ng-deep h1 { font-size: 20px; font-weight: 750; line-height: 1.3; margin: 10px 0 4px; }
    .tc-text ::ng-deep h2 { font-size: 17px; font-weight: 700; line-height: 1.35; margin: 8px 0 4px; }
    .tc-text ::ng-deep ul { margin: 4px 0; padding-left: 20px; list-style-type: disc; }
    .tc-text ::ng-deep ol { margin: 4px 0; padding-left: 20px; list-style-type: decimal; }
    .tc-text ::ng-deep hr { border: 0; height: 1px; background: var(--color-border); margin: 10px 0; }
    .tc-text ::ng-deep img { max-width: 100%; border-radius: 6px; }
    .tc-text ::ng-deep code, .tc-text ::ng-deep .tfm-inline-code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12.5px; background: var(--color-surface-secondary); border: 1px solid var(--color-border); padding: 1px 5px; border-radius: 4px; color: var(--color-accent); }
    .tc-text ::ng-deep a { color: var(--color-accent); text-decoration: underline; }
    .tc-text ::ng-deep .tfm-check-item { position: relative; display: block; padding-left: 24px; min-height: 22px; margin: 2px 0; }
    .tc-text ::ng-deep .tfm-check-item::before { content: ''; position: absolute; left: 2px; top: 4px; width: 13px; height: 13px; border: 1.5px solid var(--color-border); border-radius: 3px; background: var(--color-surface); }
    .tc-text ::ng-deep .tfm-check-item.is-checked::before { content: '✓'; border-color: var(--color-accent); background: var(--color-accent); color: #fff; font-size: 10px; font-weight: 700; line-height: 13px; text-align: center; }
    .tc-text ::ng-deep .tfm-check-item.is-checked > .tfm-check-text { text-decoration: line-through; opacity: 0.6; }
    /* Action Bar */
    .tc-actions-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .tc-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--color-text-secondary, #64748b);
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .tc-icon-btn:hover {
      background: var(--color-surface-secondary, #f1f5f9);
      color: var(--color-text-primary, #1e293b);
    }
    .tc-more-anchor { position: relative; display: inline-flex; }
    .tc-more-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      z-index: 200;
      min-width: 120px;
      background: var(--color-surface, #ffffff);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 4px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: tc-menu-in 0.1s ease-out;
    }
    @keyframes tc-menu-in { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
    .tc-more-item {
      display: flex;
      align-items: center;
      width: 100%;
      padding: 7px 10px;
      border: none;
      background: transparent;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      color: var(--color-text-primary);
      cursor: pointer;
      text-align: left;
    }
    .tc-more-item:hover { background: var(--color-surface-secondary); }
    .tc-more-item--danger { color: var(--color-danger); }
    .tc-more-item--danger:hover { background: var(--color-danger-subtle, #ffe4e6); }
    .tc-deleted { margin: 2px 0; color: var(--color-text-secondary); font-style: italic; font-size: 13px; }

    /* Reaction Pill */
    .tc-reaction-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 24px;
      padding: 0 7px;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      background: var(--color-surface-secondary, #f8fafc);
      cursor: pointer;
      color: var(--color-text-primary);
      transition: all 0.12s ease;
    }
    .tc-reaction-pill:hover {
      border-color: var(--color-accent, #3b82f6);
    }
    .tc-reaction-pill--active {
      border-color: var(--color-accent, #3b82f6);
      background: var(--color-accent-subtle, #eff6ff);
      color: var(--color-accent, #2563eb);
    }
    .tc-reaction-emoji { font-size: 13px; line-height: 1; }
    .tc-reaction-count { font-size: 12px; font-weight: 600; }

    /* Emoji Picker Anchor */
    .tc-picker-anchor { position: relative; display: inline-flex; }

    /* Threading & Replies */
    .tc-replies {
      list-style: none;
      margin: 4px 0 0 24px;
      padding: 0 0 0 16px;
      border-left: 2px solid var(--color-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .tc-reply-composer {
      margin-left: 48px;
      margin-top: 6px;
      padding: 10px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-secondary);
    }
  `]
})
export class TaskCommentsComponent implements OnInit {
  private readonly commentApi = inject(TaskCommentApiService);
  private readonly taskApi = inject(TaskApiService);
  private readonly notificationService = inject(NotificationService);

  taskId = input.required<string>();
  sortOrder = input<'desc' | 'asc'>('desc');

  comments = signal<TaskCommentDto[]>([]);
  sortedComments = computed(() => {
    const list = [...this.comments()];
    const order = this.sortOrder();
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
  });
  currentEmployeeId = signal<string | null>(null);
  editingCommentId = signal<string | null>(null);
  replyingToId = signal<string | null>(null);
  moreMenuOpenFor = signal<string | null>(null);

  readonly defaultReactionEmojis = ['👍', '❤️', '😂', '🎉'];
  emojiPickerOpenFor = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const me = await firstValueFrom(this.taskApi.getCurrentEmployee());
    this.currentEmployeeId.set(me.employeeId);
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.comments.set(await firstValueFrom(this.commentApi.getComments(this.taskId())));
  }

  canModify(comment: TaskCommentDto): boolean {
    return comment.employeeId === this.currentEmployeeId();
  }

  async submitComment(payload: { content: string; attachmentFileIds: string[] }): Promise<void> {
    await firstValueFrom(this.commentApi.postComment(this.taskId(), payload));
    await this.reload();
  }

  startEdit(comment: TaskCommentDto): void {
    this.editingCommentId.set(comment.id);
  }

  cancelEdit(): void {
    this.editingCommentId.set(null);
  }

  async saveEdit(commentId: string, payload: { content: string; attachmentFileIds: string[] }): Promise<void> {
    await firstValueFrom(this.commentApi.editComment(commentId, payload));
    this.editingCommentId.set(null);
    await this.reload();
  }

  async deleteComment(commentId: string): Promise<void> {
    await firstValueFrom(this.commentApi.deleteComment(commentId));
    await this.reload();
  }

  startReply(commentId: string): void {
    this.replyingToId.set(commentId);
  }

  cancelReply(): void {
    this.replyingToId.set(null);
  }

  async submitReply(parentCommentId: string, payload: { content: string; attachmentFileIds: string[] }): Promise<void> {
    await firstValueFrom(this.commentApi.postReply(parentCommentId, payload));
    this.replyingToId.set(null);
    await this.reload();
  }

  reactionFor(comment: TaskCommentDto, emoji: string): TaskCommentReactionDto | undefined {
    return comment.reactions.find(r => r.emoji === emoji);
  }

  reactionCount(comment: TaskCommentDto, emoji: string): number {
    return this.reactionFor(comment, emoji)?.employeeIds.length ?? 0;
  }

  hasReacted(comment: TaskCommentDto, emoji: string): boolean {
    const me = this.currentEmployeeId();
    return !!me && (this.reactionFor(comment, emoji)?.employeeIds.includes(me) ?? false);
  }

  otherReactions(comment: TaskCommentDto): TaskCommentReactionDto[] {
    return comment.reactions.filter(r => !this.defaultReactionEmojis.includes(r.emoji));
  }

  toggleEmojiPicker(commentId: string): void {
    this.emojiPickerOpenFor.set(this.emojiPickerOpenFor() === commentId ? null : commentId);
  }

  async onEmojiPicked(comment: TaskCommentDto, emoji: string): Promise<void> {
    this.emojiPickerOpenFor.set(null);
    await this.toggleReaction(comment, emoji);
  }

  async toggleReaction(comment: TaskCommentDto, emoji: string): Promise<void> {
    if (this.hasReacted(comment, emoji)) {
      await firstValueFrom(this.commentApi.removeReaction(comment.id, emoji));
    } else {
      await firstValueFrom(this.commentApi.addReaction(comment.id, emoji));
    }
    await this.reload();
  }

  toggleMoreMenu(commentId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.moreMenuOpenFor.set(this.moreMenuOpenFor() === commentId ? null : commentId);
  }

  closeMoreMenu(): void {
    this.moreMenuOpenFor.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.tc-more-anchor')) {
      this.moreMenuOpenFor.set(null);
    }
  }

  copyCommentLink(commentId: string): void {
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentId}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.notificationService.success('Link copied to clipboard');
      }).catch(() => {
        this.notificationService.success('Link copied to clipboard');
      });
    } else {
      this.notificationService.success('Link copied to clipboard');
    }
  }

  formatTimeAgo(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' at ' + date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  activeReactions(comment: TaskCommentDto): { emoji: string; count: number }[] {
    const list: { emoji: string; count: number }[] = [];
    if (!comment?.reactions) return list;
    for (const r of comment.reactions) {
      const count = r.employeeIds?.length || 0;
      if (count > 0) {
        list.push({ emoji: r.emoji, count });
      }
    }
    return list;
  }

  otherActiveReactions(comment: TaskCommentDto): { emoji: string; count: number }[] {
    return this.activeReactions(comment).filter(r => r.emoji !== '👍');
  }
}
