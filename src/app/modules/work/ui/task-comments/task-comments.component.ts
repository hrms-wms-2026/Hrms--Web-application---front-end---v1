import { Component, inject, input, signal, OnInit } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TaskCommentApiService } from '../../data-access/task-comment-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCommentDto } from '../../models/dto/task-comment.dto';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { CommentComposerComponent } from '../comment-composer/comment-composer.component';

@Component({
  selector: 'app-task-comments',
  standalone: true,
  imports: [EmployeeAvatarComponent, NgTemplateOutlet, DatePipe, CommentComposerComponent],
  template: `
    <app-comment-composer placeholder="Write a comment..." submitLabel="Comment" (submitted)="submitComment($event)" />

    @if (comments().length === 0) {
      <p class="tc-empty">No comments yet</p>
    } @else {
      <ul class="tc-list">
        @for (comment of comments(); track comment.id) {
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
            } @else if (!comment.parentCommentId) {
              <button type="button" class="tc-reply-link" (click)="startReply(comment.id)">Reply</button>
            }
          </li>
        }
      </ul>
    }

    <ng-template #commentRow let-comment>
      <div class="tc-row">
        <app-employee-avatar [employeeId]="comment.employeeId" />
        <div class="tc-row-body">
          <div class="tc-row-head">
            <span class="tc-author">{{ comment.employeeName }}</span>
            <time class="tc-time">{{ comment.createdAt | date: 'short' }}</time>
            @if (comment.isEdited) { <span class="tc-edited">(edited)</span> }
          </div>

          @if (comment.isDeleted) {
            <p class="tc-deleted">[comment deleted]</p>
          } @else if (editingCommentId() === comment.id) {
            <app-comment-composer [initialContent]="comment.content" [initialAttachments]="comment.attachments" submitLabel="Save" [showCancel]="true"
              (submitted)="saveEdit(comment.id, $event)" (cancelled)="cancelEdit()" />
          } @else {
            <p class="tc-content" [innerHTML]="comment.content"></p>
            @if (canModify(comment)) {
              <div class="tc-actions">
                <button type="button" (click)="startEdit(comment)">Edit</button>
                <button type="button" (click)="deleteComment(comment.id)">Delete</button>
              </div>
            }
          }
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    .tc-empty { color: var(--color-text-secondary); font-size: 13px; }
    .tc-list, .tc-replies { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    .tc-replies { margin-left: 32px; margin-top: 8px; }
    .tc-row { display: flex; gap: 8px; }
    .tc-row-body { flex: 1; min-width: 0; }
    .tc-row-head { display: flex; align-items: baseline; gap: 6px; }
    .tc-author { font-weight: 650; }
    .tc-time { font-size: 11px; color: var(--color-text-secondary); }
    .tc-edited { font-size: 11px; color: var(--color-text-secondary); }
    .tc-content { margin: 2px 0; white-space: pre-wrap; }
    .tc-deleted { margin: 2px 0; color: var(--color-text-secondary); font-style: italic; }
    .tc-actions, .tc-reply-link { display: flex; gap: 8px; }
    .tc-reply-composer { margin-top: 8px; }
  `]
})
export class TaskCommentsComponent implements OnInit {
  private readonly commentApi = inject(TaskCommentApiService);
  private readonly taskApi = inject(TaskApiService);

  taskId = input.required<string>();

  comments = signal<TaskCommentDto[]>([]);
  currentEmployeeId = signal<string | null>(null);
  editingCommentId = signal<string | null>(null);
  replyingToId = signal<string | null>(null);

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
}
