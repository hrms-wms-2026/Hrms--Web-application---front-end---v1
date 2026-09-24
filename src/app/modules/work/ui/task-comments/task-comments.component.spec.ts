import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskCommentsComponent } from './task-comments.component';
import { TaskCommentApiService } from '../../data-access/task-comment-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskCommentDto } from '../../models/dto/task-comment.dto';
import { NotificationService } from '../../../../core/services/notification.service';

describe('TaskCommentsComponent', () => {
  let fixture: ComponentFixture<TaskCommentsComponent>;
  let component: TaskCommentsComponent;
  let commentApi: { getComments: ReturnType<typeof vi.fn>; postComment: ReturnType<typeof vi.fn>; postReply: ReturnType<typeof vi.fn>; editComment: ReturnType<typeof vi.fn>; deleteComment: ReturnType<typeof vi.fn>; addReaction: ReturnType<typeof vi.fn>; removeReaction: ReturnType<typeof vi.fn> };
  let taskApi: { getCurrentEmployee: ReturnType<typeof vi.fn> };
  let notificationService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn>; warning: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

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
    notificationService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TaskCommentsComponent],
      providers: [
        { provide: TaskCommentApiService, useValue: commentApi },
        { provide: TaskApiService, useValue: taskApi },
        { provide: NotificationService, useValue: notificationService }
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

  it('toggleReaction adds a reaction the caller has not made yet', async () => {
    const comment = authorComment({ reactions: [] });

    await component.toggleReaction(comment, '👍');

    expect(commentApi.addReaction).toHaveBeenCalledWith('c1', '👍');
  });

  it('toggleReaction removes a reaction the caller already made', async () => {
    const comment = authorComment({ reactions: [{ emoji: '👍', employeeIds: ['me'] }] });

    await component.toggleReaction(comment, '👍');

    expect(commentApi.removeReaction).toHaveBeenCalledWith('c1', '👍');
  });

  it('hasReacted reflects whether the current employee is in the reaction', () => {
    const comment = authorComment({ reactions: [{ emoji: '👍', employeeIds: ['me'] }] });

    expect(component.hasReacted(comment, '👍')).toBe(true);
    expect(component.hasReacted(comment, '🎉')).toBe(false);
  });

  it('activeReactions only returns emojis with positive count', () => {
    const comment = authorComment({
      reactions: [
        { emoji: '👍', employeeIds: ['u1', 'u2'] },
        { emoji: '🎉', employeeIds: [] },
        { emoji: '❤️', employeeIds: ['u3'] }
      ]
    });

    const active = component.activeReactions(comment);
    expect(active).toEqual([
      { emoji: '👍', count: 2 },
      { emoji: '❤️', count: 1 }
    ]);
  });

  it('formatTimeAgo formats recent timestamps correctly', () => {
    expect(component.formatTimeAgo('')).toBe('');
    expect(component.formatTimeAgo('invalid-date')).toBe('');

    const now = new Date();
    expect(component.formatTimeAgo(now.toISOString())).toBe('now');

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    expect(component.formatTimeAgo(tenMinAgo.toISOString())).toBe('10m ago');

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(component.formatTimeAgo(twoHoursAgo.toISOString())).toBe('2h ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(component.formatTimeAgo(threeDaysAgo.toISOString())).toBe('3d ago');
  });

  it('otherActiveReactions filters out thumbs up reaction', () => {
    const comment = authorComment({
      reactions: [
        { emoji: '👍', employeeIds: ['u1'] },
        { emoji: '❤️', employeeIds: ['u2', 'u3'] },
        { emoji: '🎉', employeeIds: [] }
      ]
    });

    const others = component.otherActiveReactions(comment);
    expect(others).toEqual([{ emoji: '❤️', count: 2 }]);
  });

  it('copyCommentLink triggers notification and copies url', () => {
    component.copyCommentLink('c1');
    expect(notificationService.success).toHaveBeenCalledWith('Link copied to clipboard');
  });

  it('toggleMoreMenu and closeMoreMenu manage menu state', () => {
    expect(component.moreMenuOpenFor()).toBeNull();

    component.toggleMoreMenu('c1');
    expect(component.moreMenuOpenFor()).toBe('c1');

    component.toggleMoreMenu('c1');
    expect(component.moreMenuOpenFor()).toBeNull();

    component.toggleMoreMenu('c1');
    component.closeMoreMenu();
    expect(component.moreMenuOpenFor()).toBeNull();
  });

  it('renders rich-text editor markup in posted comments (checklist class, <font> color, links, headings)', async () => {
    commentApi.getComments.mockReturnValue(of([authorComment({ content: '<div><span style="color: rgb(224, 49, 49);">red</span><font color="#e03131">old</font></div><div class="tfm-check-item is-checked"><input type="checkbox" contenteditable="false" checked="checked"><span class="tfm-check-text">done</span></div><a href="https://x" target="_blank" class="tfm-preview-link">x</a><h1>H</h1><code class="tfm-inline-code">c</code>' })]));
    fixture = TestBed.createComponent(TaskCommentsComponent);
    fixture.componentRef.setInput('taskId', 't1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.querySelector('.tc-text') as HTMLElement;
    expect(text.querySelector('font[color="#e03131"]')).toBeTruthy();
    expect(text.querySelector('.tfm-check-item.is-checked .tfm-check-text')?.textContent).toBe('done');
    expect(text.querySelector('a.tfm-preview-link')?.getAttribute('href')).toBe('https://x');
    expect(text.querySelector('h1')).toBeTruthy();
    expect(text.querySelector('code.tfm-inline-code')).toBeTruthy();
    // Angular's sanitizer strips style attributes - why the comment editor applies color via <font>.
    expect(text.querySelector('[style]')).toBeNull();
  });
});
