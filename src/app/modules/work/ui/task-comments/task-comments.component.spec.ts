import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskCommentsComponent } from './task-comments.component';
import { TaskCommentApiService } from '../../data-access/task-comment-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCommentDto } from '../../models/dto/task-comment.dto';

describe('TaskCommentsComponent', () => {
  let fixture: ComponentFixture<TaskCommentsComponent>;
  let component: TaskCommentsComponent;
  let commentApi: { getComments: ReturnType<typeof vi.fn>; postComment: ReturnType<typeof vi.fn>; postReply: ReturnType<typeof vi.fn>; editComment: ReturnType<typeof vi.fn>; deleteComment: ReturnType<typeof vi.fn>; addReaction: ReturnType<typeof vi.fn>; removeReaction: ReturnType<typeof vi.fn> };
  let taskApi: { getCurrentEmployee: ReturnType<typeof vi.fn> };

  const authorComment = (overrides: Partial<TaskCommentDto> = {}): TaskCommentDto => ({
    id: 'c1', taskId: 't1', parentCommentId: null, employeeId: 'me', employeeName: 'Priya',
    content: 'hello', isEdited: false, isDeleted: false, createdAt: new Date().toISOString(),
    reactions: [], attachments: [], replies: [], ...overrides
  });

  beforeEach(async () => {
    commentApi = {
      getComments: vi.fn(() => of([authorComment()])),
      postComment: vi.fn(() => of(authorComment())),
      postReply: vi.fn(() => of(authorComment({ id: 'r1', parentCommentId: 'c1' }))),
      editComment: vi.fn(() => of(authorComment({ content: 'edited', isEdited: true }))),
      deleteComment: vi.fn(() => of(void 0)),
      addReaction: vi.fn(() => of(void 0)),
      removeReaction: vi.fn(() => of(void 0))
    };
    taskApi = { getCurrentEmployee: vi.fn(() => of({ employeeId: 'me' })) };

    await TestBed.configureTestingModule({
      imports: [TaskCommentsComponent],
      providers: [
        { provide: TaskCommentApiService, useValue: commentApi },
        { provide: TaskApiService, useValue: taskApi }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCommentsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('taskId', 't1');
    fixture.detectChanges();
  });

  it('loads comments for the task on init', () => {
    expect(commentApi.getComments).toHaveBeenCalledWith('t1');
    expect(component.comments().length).toBe(1);
  });

  it('posts a new top-level comment and reloads the list', async () => {
    await component.submitComment({ content: 'a new comment', attachmentFileIds: [] });

    expect(commentApi.postComment).toHaveBeenCalledWith('t1', { content: 'a new comment', attachmentFileIds: [] });
    expect(commentApi.getComments).toHaveBeenCalledTimes(2);
  });

  it('shows edit/delete controls only for the caller\'s own comment', () => {
    expect(component.canModify(authorComment({ employeeId: 'me' }))).toBe(true);
    expect(component.canModify(authorComment({ employeeId: 'someone-else' }))).toBe(false);
  });

  it('editComment sends the update and exits edit mode', async () => {
    component.startEdit(authorComment());
    await component.saveEdit('c1', { content: 'edited', attachmentFileIds: [] });

    expect(commentApi.editComment).toHaveBeenCalledWith('c1', { content: 'edited', attachmentFileIds: [] });
    expect(component.editingCommentId()).toBeNull();
  });

  it('deleteComment calls the API and reloads', async () => {
    await component.deleteComment('c1');

    expect(commentApi.deleteComment).toHaveBeenCalledWith('c1');
    expect(commentApi.getComments).toHaveBeenCalledTimes(2);
  });

  it('postReply targets the parent comment id', async () => {
    component.startReply('c1');
    await component.submitReply('c1', { content: 'a reply', attachmentFileIds: [] });

    expect(commentApi.postReply).toHaveBeenCalledWith('c1', { content: 'a reply', attachmentFileIds: [] });
    expect(component.replyingToId()).toBeNull();
  });
});
