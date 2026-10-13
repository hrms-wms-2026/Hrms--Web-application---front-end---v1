import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InboxCommentDialogComponent } from './inbox-comment-dialog.component';

describe('InboxCommentDialogComponent', () => {
  let fixture: ComponentFixture<InboxCommentDialogComponent>;
  let el: HTMLElement;
  let confirmed: (string | null)[];
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const click = (id: string) => {
    const host = q(id)!;
    (host.querySelector('button') ?? host).click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InboxCommentDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(InboxCommentDialogComponent);
    el = fixture.nativeElement;
    confirmed = [];
    fixture.componentInstance.confirmed.subscribe((v) => confirmed.push(v));
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('offers "Reject without reason" while empty and emits null', () => {
    expect(el.textContent).toContain("It's optional.");
    expect(q('inbox-comment-without-reason')!.textContent!.trim()).toBe('Reject without reason');
    click('inbox-comment-without-reason');
    expect(confirmed).toEqual([null]);
  });

  it('Reject with an empty box also emits null', () => {
    click('inbox-comment-confirm');
    expect(confirmed).toEqual([null]);
  });

  it('with a reason, hides the no-reason button and emits the trimmed text', () => {
    const input = q('inbox-comment-reason') as HTMLTextAreaElement;
    input.value = '  Too big for this sprint  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(q('inbox-comment-without-reason')).toBeNull();
    click('inbox-comment-confirm');
    expect(confirmed).toEqual(['Too big for this sprint']);
  });

  it('uses the decline wording for invitations', () => {
    fixture.componentRef.setInput('title', 'Decline invitation?');
    fixture.componentRef.setInput('confirmLabel', 'Decline');
    fixture.detectChanges();
    expect(el.textContent).toContain('Decline invitation?');
    expect(q('inbox-comment-without-reason')!.textContent!.trim()).toBe('Decline without reason');
  });
});
