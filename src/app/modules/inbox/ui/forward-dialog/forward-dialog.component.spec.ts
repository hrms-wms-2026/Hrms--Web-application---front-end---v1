import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatRowDto } from '../../models/inbox-chat.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { ForwardDialogComponent, ForwardTargets } from './forward-dialog.component';

function row(id: string, title: string, type: InboxChatRowDto['type'] = 'direct', otherEmployeeId: string | null = null): InboxChatRowDto {
  return {
    conversationId: id, source: type === 'direct' ? 'direct' : 'group', kind: type === 'direct' ? 'direct' : 'group', subjectId: id, type, title,
    otherEmployeeId, avatarFileId: null, memberCount: 2, preview: null, lastMessageAt: null, unread: 0, pending: [], caseItem: null
  };
}

describe('ForwardDialogComponent', () => {
  let searchPeople: ReturnType<typeof vi.fn>;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function render() {
    searchPeople = vi.fn(() => of([
      { employeeId: 'emp-ravi', name: 'Ravi', avatarFileId: null },
      { employeeId: 'emp-new', name: 'Ravindu New', avatarFileId: null }
    ]));
    TestBed.configureTestingModule({
      imports: [ForwardDialogComponent],
      providers: [
        { provide: InboxChatsStore, useValue: { rows: signal([row('c1', 'Priya', 'direct', 'emp-priya'), row('c2', 'Payroll review', 'group'), row('c3', 'Ravi', 'direct', 'emp-ravi')]) } },
        { provide: ConversationsApiService, useValue: { searchPeople } }
      ]
    });
    const fixture = TestBed.createComponent(ForwardDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('fromConversationId', 'c1');
    fixture.componentRef.setInput('caseTitle', 'Sick Leave - Sam');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const type = async (text: string) => {
      const search = q('forward-search') as HTMLInputElement;
      search.value = text;
      search.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(300);
      fixture.detectChanges();
    };
    return { fixture, q, type };
  }

  it('offers every other chat, filters by name, and sends the picked ones', async () => {
    const { fixture, q, type } = await render();
    const sent: ForwardTargets[] = [];
    fixture.componentInstance.send.subscribe((t) => sent.push(t));

    expect(q('forward-row-c1')).toBeNull();
    (q('forward-row-c2')!.querySelector('input') as HTMLInputElement).click();
    (q('forward-row-c3')!.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(q('forward-send')!.textContent).toContain('Forward to 2');

    await type('pay');
    expect(q('forward-row-c3')).toBeNull();

    (q('forward-send') as HTMLButtonElement).click();
    expect(sent).toEqual([{ conversationIds: ['c2', 'c3'], employeeIds: [] }]);
  });

  it('finds people with no chat yet through the people search and sends them as new chats', async () => {
    const { fixture, q, type } = await render();
    const sent: ForwardTargets[] = [];
    fixture.componentInstance.send.subscribe((t) => sent.push(t));

    await type('rav');

    expect(searchPeople).toHaveBeenCalledWith('rav');
    // Ravi already has a chat (offered as that chat); Ravindu has none (offered as a new chat).
    expect(q('forward-person-emp-ravi')).toBeNull();
    (q('forward-person-emp-new')!.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
    (q('forward-send') as HTMLButtonElement).click();

    expect(sent).toEqual([{ conversationIds: [], employeeIds: ['emp-new'] }]);
  });
});
