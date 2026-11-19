import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { ChatMediaItemDto, InboxChatRowDto } from '../../models/inbox-chat.dto';
import { ConversationParticipantDto } from '../../models/inbox.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { InboxStore } from '../../state/inbox.store';
import { ChatInfoPanelComponent, fileSize } from './chat-info-panel.component';

const group: InboxChatRowDto = {
  conversationId: 'g1', source: 'group', kind: 'group', subjectId: 'g1', type: 'group', title: 'Payroll review', otherEmployeeId: null,
  avatarFileId: null, memberCount: 12, preview: null, lastMessageAt: null, unread: 0, pending: [], caseItem: null, description: null
};

function file(i: number, kind: ChatMediaItemDto['kind'] = 'document'): ChatMediaItemDto {
  return {
    id: `f${i}`, messageId: `m${i}`, fileName: `file-${i}.pdf`, contentType: 'application/pdf', sizeBytes: 2048, kind,
    sentAt: '2026-10-20T08:00:00Z', authorEmployeeId: 'emp-1', authorName: 'Ravi'
  };
}

function person(i: number): ConversationParticipantDto {
  return { employeeId: `emp-${i}`, name: `Person ${String(i).padStart(2, '0')}`, avatarFileId: null, joinReason: 'added' } as ConversationParticipantDto;
}

describe('ChatInfoPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let rows: ReturnType<typeof signal<InboxChatRowDto[]>>;
  let toggleMuted: ReturnType<typeof vi.fn>;
  let loadCounts: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      media: vi.fn((_id: string, kind: string | null, page: number, size: number) => of({
        items: Array.from({ length: Math.min(size, kind ? 3 : 25 - (page - 1) * size) }, (_, i) => file((page - 1) * size + i)),
        total: kind ? 3 : 25, page, pageSize: size, counts: { document: 22, image: 3 }
      })),
      search: vi.fn(() => of([])),
      setDescription: vi.fn(() => of(undefined)),
      renameGroup: vi.fn(() => of(undefined))
    };
    rows = signal([group]);
    toggleMuted = vi.fn(() => Promise.resolve(true));
    loadCounts = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      imports: [ChatInfoPanelComponent],
      providers: [
        { provide: InboxChatsApiService, useValue: api },
        { provide: ConversationsApiService, useValue: { attachment: vi.fn(() => of(new Blob())) } },
        { provide: InboxChatsStore, useValue: { favorites: signal(new Set<string>()), toggleFavorite: vi.fn(), toggleMuted, load: vi.fn(() => Promise.resolve()), rows } },
        { provide: InboxStore, useValue: { loadCounts } },
        { provide: NotificationService, useValue: { error: vi.fn(), info: vi.fn() } }
      ]
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render(row: InboxChatRowDto = group, members = Array.from({ length: 12 }, (_, i) => person(i + 1))) {
    const fixture = TestBed.createComponent(ChatInfoPanelComponent);
    fixture.componentRef.setInput('row', row);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('myEmployeeId', 'emp-3');
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const click = async (id: string) => {
      q(id).click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
    };
    return { fixture, el, q, click };
  }

  it('shows 5 files and 5 members (you first), with the totals', async () => {
    const { q } = await render();

    expect(api['media']).toHaveBeenCalledWith('g1', null, 1, 5);
    expect(q('chat-info-media-preview').querySelectorAll('.cip__tile').length).toBe(5);
    expect(q('chat-info-media').textContent).toContain('25');
    const members = q('chat-info-members').querySelectorAll('.cip__member');
    expect(members.length).toBe(5);
    expect(members[0].textContent).toContain('You');
    expect(q('chat-info-members-all').textContent).toContain('View all (12)');
  });

  it('files open page by page, and narrow by type', async () => {
    const { q, click } = await render();

    await click('chat-info-media');
    expect(q('chat-media-list').querySelectorAll('li').length).toBe(20);
    expect(q('chat-info-pager').textContent).toContain('1–20 of 25');
    (q('chat-info-pager').querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(api['media']).toHaveBeenLastCalledWith('g1', null, 2, 20);

    await click('chat-media-tab-image');
    expect(api['media']).toHaveBeenLastCalledWith('g1', 'image', 1, 20);
  });

  it('all members open 10 per page', async () => {
    const { fixture, q, click } = await render();

    await click('chat-info-members-all');
    expect(q('chat-members-page').querySelectorAll('.cip__member').length).toBe(10);
    (q('chat-info-pager').querySelector('[aria-label="Next page"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(q('chat-members-page').querySelectorAll('.cip__member').length).toBe(2);
  });

  it('"Add member" sits with the members and asks the page to add people', async () => {
    const { fixture, click } = await render();
    const added: void[] = [];
    fixture.componentInstance.addPeople.subscribe(() => added.push(undefined));

    await click('chat-info-add-member');
    await click('chat-info-members-all');
    await click('chat-members-add');

    expect(added.length).toBe(2);
  });

  it('clicking the group photo itself (not only the camera) opens the photo popup', async () => {
    const { fixture, q } = await render();
    const pick = vi.spyOn(fixture.componentInstance as unknown as { pickPhoto(input: HTMLInputElement): void }, 'pickPhoto')
      .mockImplementation(() => undefined);

    (q('chat-info-photo').querySelector('.cip__photo-icon') as HTMLElement).click();

    expect(pick).toHaveBeenCalled();
  });

  it('mutes the chat and refreshes the inbox badge', async () => {
    const { click } = await render();

    await click('chat-info-mute');

    expect(toggleMuted).toHaveBeenCalledWith('g1');
    expect(loadCounts).toHaveBeenCalled();
  });

  it('saves the group description as plain text', async () => {
    const { fixture, q, click } = await render();

    await click('chat-info-edit-description');
    const input = q('chat-info-description-input') as HTMLTextAreaElement;
    input.value = '  Monthly payroll checks ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await click('chat-info-save-description');

    expect(api['setDescription']).toHaveBeenCalledWith('g1', 'Monthly payroll checks');
  });

  it('a 1-on-1 chat is Contact info: no Add, members or description', async () => {
    const { el, q } = await render({ ...group, type: 'direct', source: 'direct', title: 'Ravi' }, [person(1), person(3)]);

    expect(el.textContent).toContain('Contact info');
    expect(q('chat-info-add')).toBeNull();
    expect(q('chat-info-members')).toBeNull();
    expect(q('chat-info-edit-description')).toBeNull();
  });

  it('formats file sizes', () => {
    expect(fileSize(500)).toBe('500 B');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(3.4 * 1024 * 1024)).toBe('3.4 MB');
  });
});
