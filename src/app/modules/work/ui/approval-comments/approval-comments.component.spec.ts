import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalCommentsComponent, formatTimeAgo } from './approval-comments.component';
import { ApprovalCommentDto } from '../../models/dto/approval-feed.dto';

function comment(overrides: Partial<ApprovalCommentDto> = {}): ApprovalCommentDto {
  return {
    id: 'c1', parentCommentId: null, authorId: 'e1', authorName: 'Bala', content: 'Can we keep the date?',
    isEdited: false, canEdit: false, createdAt: '2026-09-30T08:00:00Z', updatedAt: null, ...overrides
  };
}

describe('ApprovalCommentsComponent', () => {
  let fixture: ComponentFixture<ApprovalCommentsComponent>;
  let el: HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const type = (id: string, value: string) => {
    const input = q(id) as HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  function render(comments: ApprovalCommentDto[]): void {
    fixture.componentRef.setInput('comments', comments);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApprovalCommentsComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApprovalCommentsComponent);
    el = fixture.nativeElement;
  });

  it('nests replies under their parent and marks edited comments', () => {
    render([
      comment(),
      comment({ id: 'c2', authorName: 'Anu', content: 'Sure', isEdited: true }),
      comment({ id: 'r1', parentCommentId: 'c1', authorName: 'Anu', content: 'Only if QA agrees' })
    ]);

    expect(el.querySelectorAll('[data-testid="approval-comment"]').length).toBe(2);
    const reply = q('approval-reply')!;
    expect(reply.dataset['parent']).toBe('c1');
    expect(reply.textContent).toContain('Only if QA agrees');
    expect(q('approval-comment-edited')).not.toBeNull();
  });

  it('shows Edit only on comments the caller can edit and emits the edit', () => {
    render([comment(), comment({ id: 'mine', canEdit: true, content: 'draft' })]);
    const edits: { id: string; content: string }[] = [];
    fixture.componentInstance.edit.subscribe((e) => edits.push(e));

    const editButtons = el.querySelectorAll<HTMLButtonElement>('[data-testid="approval-comment-edit"]');
    expect(editButtons.length).toBe(1);
    editButtons[0].click();
    fixture.detectChanges();
    type('approval-comment-edit-input', ' final ');
    q('approval-comment-edit-save')!.click();

    expect(edits).toEqual([{ id: 'mine', content: 'final' }]);
  });

  it('the composer is disabled while empty and emits trimmed content', () => {
    render([]);
    const added: string[] = [];
    fixture.componentInstance.add.subscribe((c) => added.push(c));

    expect((q('approval-comment-submit') as HTMLButtonElement).disabled).toBe(true);
    type('approval-comment-input', '   ');
    expect((q('approval-comment-submit') as HTMLButtonElement).disabled).toBe(true);
    type('approval-comment-input', '  Looks good  ');
    q('approval-comment-submit')!.click();
    fixture.detectChanges();

    expect(added).toEqual(['Looks good']);
    expect((q('approval-comment-input') as HTMLTextAreaElement).value).toBe('');
  });

  it('reply emits with the top-level parent id', () => {
    render([comment(), comment({ id: 'r1', parentCommentId: 'c1' })]);
    const replies: { parentId: string; content: string }[] = [];
    fixture.componentInstance.reply.subscribe((r) => replies.push(r));

    // Reply on the reply: it still targets the top-level comment.
    const replyButtons = el.querySelectorAll<HTMLButtonElement>('[data-testid="approval-comment-reply"]');
    replyButtons[1].click();
    fixture.detectChanges();
    type('approval-reply-input', 'ok');
    q('approval-reply-submit')!.click();

    expect(replies).toEqual([{ parentId: 'c1', content: 'ok' }]);
  });

  it('formats relative times', () => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    expect(formatTimeAgo('2026-09-30T11:59:30Z', now)).toBe('now');
    expect(formatTimeAgo('2026-09-30T11:50:00Z', now)).toBe('10m ago');
    expect(formatTimeAgo('2026-09-30T09:00:00Z', now)).toBe('3h ago');
    expect(formatTimeAgo('2026-09-28T12:00:00Z', now)).toBe('2d ago');
  });
});
