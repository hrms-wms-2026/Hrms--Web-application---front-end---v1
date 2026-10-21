import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { InboxChatRowDto } from '../../models/inbox-chat.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { ForwardDialogComponent } from './forward-dialog.component';

function row(id: string, title: string, type: InboxChatRowDto['type'] = 'direct'): InboxChatRowDto {
  return {
    conversationId: id, source: type === 'direct' ? 'direct' : 'group', kind: type === 'direct' ? 'direct' : 'group', subjectId: id, type, title,
    otherEmployeeId: null, avatarFileId: null, memberCount: 2, preview: null, lastMessageAt: null, unread: 0, pending: [], caseItem: null
  };
}

describe('ForwardDialogComponent', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [ForwardDialogComponent],
      providers: [{ provide: InboxChatsStore, useValue: { rows: signal([row('c1', 'Priya'), row('c2', 'Payroll review', 'group'), row('c3', 'Ravi')]) } }]
    });
    const fixture = TestBed.createComponent(ForwardDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('fromConversationId', 'c1');
    fixture.componentRef.setInput('caseTitle', 'Sick Leave - Sam');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    return { fixture, q };
  }

  it('offers every other chat, filters by name, and sends the picked ones', async () => {
    const { fixture, q } = await render();
    const sent: string[][] = [];
    fixture.componentInstance.send.subscribe((ids) => sent.push(ids));

    expect(q('forward-row-c1')).toBeNull();
    expect(q('forward-row-c2')).not.toBeNull();
    (q('forward-row-c2')!.querySelector('input') as HTMLInputElement).click();
    (q('forward-row-c3')!.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(q('forward-send')!.textContent).toContain('Forward to 2');

    const search = q('forward-search') as HTMLInputElement;
    search.value = 'pay';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('forward-row-c3')).toBeNull();

    (q('forward-send') as HTMLButtonElement).click();
    expect(sent).toEqual([['c2', 'c3']]);
  });
});
