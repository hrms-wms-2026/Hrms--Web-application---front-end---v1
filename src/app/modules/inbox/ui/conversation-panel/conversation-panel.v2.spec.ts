import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { ParticipantRemovedEvent } from '../../../../core/realtime/inbox-realtime.models';
import { FileApiService } from '../../../../shared/data-access/file-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { ConversationDto, ConversationMessageDto, ConversationParticipantDto } from '../../models/inbox.dto';
import { InboxStore } from '../../state/inbox.store';
import { ConversationStore } from '../../state/conversation.store';
import { ConversationPanelComponent } from './conversation-panel.component';

/** FS3: roles, remove/leave, edit/delete, realtime removal, attachments, tags, export. */

const REF = { source: 'attendance', kind: 'alert', id: 'a1' };

function message(id: string, extra: Partial<ConversationMessageDto> = {}): ConversationMessageDto {
  return {
    id, conversationId: 'c1', authorEmployeeId: 'mgr', authorName: 'Maya', authorAvatarFileId: null, kind: 'text',
    bodyHtml: `<p>${id}</p>`, systemEventJson: null, mentionEmployeeIds: [], createdAt: '2026-10-13T09:00:00Z', ...extra
  };
}

function person(employeeId: string, name: string, joinReason: 'base' | 'added' | 'viewer', addedBy: string | null = null): ConversationParticipantDto {
  return { employeeId, name, avatarFileId: null, joinReason, addedByEmployeeId: addedBy, addedAt: null };
}

describe('ConversationPanelComponent (FS3)', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let inboxApi: { exportItem: ReturnType<typeof vi.fn> };
  let removed: Subject<ParticipantRemovedEvent>;
  let me: string;
  let conv: ConversationDto;

  beforeEach(() => {
    me = 'mgr';
    conv = {
      id: 'c1', source: 'attendance', kind: 'alert', subjectId: 'a1', title: 'Late clock-in', projectId: null, subjectEmployeeId: 'pat',
      participants: [
        person('pat', 'Pat', 'base'), person('mgr', 'Maya', 'base'), person('hr', 'Hana', 'viewer'),
        person('sam', 'Sam', 'added', 'mgr'), person('lee', 'Lee', 'added', 'sam')
      ],
      messages: [
        message('own', { authorEmployeeId: 'mgr' }),
        message('edited', { authorEmployeeId: 'pat', authorName: 'Pat', editedAt: '2026-10-13T09:30:00Z' }),
        message('gone', { authorEmployeeId: 'pat', authorName: 'Pat', isDeleted: true, bodyHtml: '' }),
        message('why', { authorEmployeeId: 'pat', authorName: 'Pat', tag: 'justification' }),
        message('file', { attachments: [{ id: 'att1', fileName: 'note.pdf', contentType: 'application/pdf', sizeBytes: 2048 }] })
      ],
      hasMoreMessages: false, lastReadAt: '2026-10-14T00:00:00Z'
    };
    api = {
      open: vi.fn(() => of(conv)),
      markRead: vi.fn(() => of(undefined)),
      messages: vi.fn(), addParticipants: vi.fn(), searchPeople: vi.fn(() => of([])),
      post: vi.fn((_: string, html: string) => of(message('new', { authorEmployeeId: me, bodyHtml: html }))),
      edit: vi.fn((_: string, id: string, html: string) => of(message(id, { authorEmployeeId: me, bodyHtml: html, editedAt: '2026-10-13T10:00:00Z' }))),
      deleteMessage: vi.fn(() => of(undefined)),
      react: vi.fn((_: string, id: string, emoji: string) => of(message(id, { reactions: [{ emoji, employeeIds: [me] }] }))),
      unreact: vi.fn((_: string, id: string) => of(message(id, { reactions: [] }))),
      removeParticipant: vi.fn(() => of(undefined)),
      leave: vi.fn(() => of(undefined)),
      attachment: vi.fn(() => of(new Blob(['x'])))
    };
    inboxApi = { exportItem: vi.fn(() => of(new Blob(['<html></html>'], { type: 'text/html' }))) };
    removed = new Subject();
    TestBed.configureTestingModule({
      imports: [ConversationPanelComponent],
      providers: [
        ConversationStore,
        { provide: ConversationsApiService, useValue: api },
        { provide: InboxApiService, useValue: inboxApi },
        { provide: InboxChatsApiService, useValue: { renameGroup: vi.fn(() => of(undefined)) } },
        { provide: FileApiService, useValue: { upload: vi.fn() } },
        {
          provide: InboxRealtimeService, useValue: {
            messageCreated$: new Subject(), participantAdded$: new Subject(), reconnected$: new Subject(),
            messageUpdated$: new Subject(), messageDeleted$: new Subject(), participantRemoved$: removed.asObservable()
          }
        },
        { provide: AuthStore, useValue: { employeeId: () => me } },
        { provide: InboxStore, useValue: { loadCounts: vi.fn(() => Promise.resolve()) } },
        { provide: TaskApiService, useValue: { uploadPendingFile: vi.fn(), deletePendingFile: vi.fn(), getFileUrl: vi.fn() } }
      ]
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    // A fixed clock, 10 minutes after the fixture messages were sent (inside the 30-minute edit window).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T09:10:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('itemRef', REF);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const msg = (id: string) => el.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
    const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    return { fixture, el, q, msg, settle };
  }

  it('shows (edited), the deleted placeholder, tag labels and the justification card', async () => {
    const { msg } = await render();

    expect(msg('edited').textContent).toContain('(edited)');
    expect(msg('gone').textContent).toContain('Message deleted');
    expect(msg('why').classList.contains('msg--justification')).toBe(true);
  });

  it('the author edits inline with the composer and deletes; others can only react', async () => {
    const { msg, q, settle, fixture } = await render();

    expect(msg('edited').querySelector('[data-testid="message-react-edited"]')).not.toBeNull();
    expect(msg('edited').querySelector('[data-testid="message-edit-edited"]')).toBeNull();
    expect(msg('edited').querySelector('[data-testid="message-delete-edited"]')).toBeNull();
    expect(msg('gone').querySelector('[data-testid="message-menu"]')).toBeNull();
    q('message-edit-own')!.click();
    await settle();
    const editor = fixture.nativeElement.querySelector('[data-testid="message-editor-own"]');
    expect(editor).not.toBeNull();
    await (fixture.componentInstance as unknown as { saveEdit(id: string, e: { content: string; mentions: string[] }): Promise<void> })
      .saveEdit('own', { content: '<p>fixed</p>', mentions: [] });
    await settle();
    expect(api['edit']).toHaveBeenCalledWith('c1', 'own', '<p>fixed</p>', []);
    expect(msg('own').textContent).toContain('fixed');
    expect(msg('own').textContent).toContain('(edited)');

    q('message-delete-own')!.click();
    await settle();
    expect(api['deleteMessage']).toHaveBeenCalledWith('c1', 'own');
    expect(msg('own').textContent).toContain('Message deleted');
  });

  it('after 30 minutes the author can no longer edit or delete, only react', async () => {
    vi.setSystemTime(new Date('2026-10-13T09:31:00Z'));
    const { msg } = await render();

    expect(msg('own').querySelector('[data-testid="message-edit-own"]')).toBeNull();
    expect(msg('own').querySelector('[data-testid="message-delete-own"]')).toBeNull();
    expect(msg('own').querySelector('[data-testid="message-react-own"]')).not.toBeNull();
  });

  /** jsdom's selector engine does not match emoji in attribute selectors, so chips are found by comparing the attribute. */
  function chip(root: HTMLElement, messageId: string, emoji: string): HTMLElement | undefined {
    return Array.from(root.querySelectorAll<HTMLElement>('.msg__reaction')).find((b) => b.dataset['testid'] === `reaction-${messageId}-${emoji}`);
  }

  it('shows each emoji with its count, marks your own, and names who reacted', async () => {
    conv.messages = [message('m1', { authorEmployeeId: 'pat', authorName: 'Pat', reactions: [
      { emoji: '👍', employeeIds: ['mgr', 'pat'] }, { emoji: '😂', employeeIds: ['sam'] }
    ] })];
    const { el } = await render();

    const thumbs = chip(el, 'm1', '👍')!;
    expect(thumbs.textContent).toContain('2');
    expect(thumbs.classList).toContain('msg__reaction--mine');
    expect(thumbs.getAttribute('title')).toBe('You, Pat');
    expect(chip(el, 'm1', '😂')!.classList).not.toContain('msg__reaction--mine');
  });

  it('one reaction per person: tapping your emoji removes it, another emoji replaces it', async () => {
    conv.messages = [message('m1', { authorEmployeeId: 'pat', authorName: 'Pat', reactions: [
      { emoji: '👍', employeeIds: ['mgr'] }, { emoji: '😂', employeeIds: ['sam'] }
    ] })];
    const { el, settle } = await render();

    chip(el, 'm1', '😂')!.click();
    await settle();
    expect(api['react']).toHaveBeenCalledWith('c1', 'm1', '😂');

    conv.messages = [message('m2', { authorEmployeeId: 'pat', reactions: [{ emoji: '👍', employeeIds: ['mgr'] }] })];
    const second = await render();
    chip(second.el, 'm2', '👍')!.click();
    await second.settle();
    expect(api['unreact']).toHaveBeenCalledWith('c1', 'm2');
  });

  it('the react button opens the emoji picker and the picked emoji is your reaction', async () => {
    const { q, settle, el } = await render();

    q('message-react-edited')!.click();
    await settle();
    const picker = q('message-react-picker-edited')!;
    (picker.querySelector('.ep-emoji') as HTMLButtonElement).click();
    await settle();

    expect(api['react']).toHaveBeenCalledWith('c1', 'edited', '😀');
    expect(el.querySelector('[data-testid="message-react-picker-edited"]')).toBeNull();
    expect(chip(el, 'edited', '😀')?.textContent).toContain('1');
  });

  it('a live removal of the caller switches the panel off', async () => {
    const { q, settle } = await render();

    removed.next({ conversationId: 'c1', employeeId: 'mgr' });
    await settle();

    expect(q('conversation-removed')).not.toBeNull();
  });

  it('downloads an attachment through the authenticated endpoint as a blob', async () => {
    const { q, settle } = await render();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    q('attachment-att1')!.click();
    await settle();

    expect(api['attachment']).toHaveBeenCalledWith('c1', 'att1');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('only the subject may mark a message as a justification, and it is sent with the tag', async () => {
    expect((await render()).q('conversation-justification')).toBeNull();
  });

  it('the subject sends a justification', async () => {
    me = 'pat';
    const { q, settle, fixture } = await render();
    const toggle = q('conversation-justification') as HTMLInputElement;
    toggle.click();
    await settle();

    await (fixture.componentInstance as unknown as { send(html: string, mentions: string[], files: string[]): Promise<void> })
      .send('<p>I was at the clinic</p>', [], ['f1']);
    await settle();

    expect(api['post']).toHaveBeenCalledWith('c1', '<p>I was at the clinic</p>', [], ['f1'], 'justification', null);
  });

  it('uploads chat attachments as conversation_attachment, at most 5 and 25 MB each', async () => {
    const files = TestBed.inject(FileApiService) as unknown as { upload: ReturnType<typeof vi.fn> };
    files.upload.mockReturnValue(of({ fileId: 'f1', originalFileName: 'a.pdf', fileSizeBytes: 10, contentType: 'application/pdf' }));
    const { fixture } = await render();
    const uploader = (fixture.componentInstance as unknown as { uploader: { upload(f: File): ReturnType<typeof of>; maxFiles: number; maxBytes: number } }).uploader;
    const file = new File(['x'], 'a.pdf');

    let uploaded: unknown;
    uploader.upload(file).subscribe((v) => (uploaded = v));

    expect(files.upload).toHaveBeenCalledWith(file, 'conversation_attachment');
    expect(uploaded).toEqual({ fileId: 'f1', originalFileName: 'a.pdf', fileSizeBytes: 10 });
    expect([uploader.maxFiles, uploader.maxBytes]).toEqual([5, 25 * 1024 * 1024]);
    expect((uploader as unknown as { accept: string }).accept).toBe('.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.zip');
  });

  it('replies to a message like a messenger: Reply shows a bar over the composer, the send carries the quoted id', async () => {
    const { fixture, q, settle } = await render();
    q('message-reply-edited')!.click();
    await settle();

    expect(q('conversation-replying')!.textContent).toContain('Replying to Pat');
    expect(q('conversation-replying')!.textContent).toContain('edited');

    await (fixture.componentInstance as unknown as { send(html: string, mentions: string[], files: string[]): Promise<void> })
      .send('<p>thanks</p>', [], []);
    await settle();
    expect(api['post']).toHaveBeenCalledWith('c1', '<p>thanks</p>', [], [], null, 'edited');
    expect(q('conversation-replying')).toBeNull();
  });

  it('cancels a reply, and offers no Reply on deleted messages', async () => {
    const { q, settle } = await render();
    expect(q('message-reply-gone')).toBeNull();

    q('message-reply-own')!.click();
    await settle();
    q('conversation-reply-cancel')!.click();
    await settle();
    expect(q('conversation-replying')).toBeNull();
  });

  it('shows the quote on a reply and jumps to the quoted message', async () => {
    conv.messages = [
      ...conv.messages,
      message('re', { authorEmployeeId: 'pat', authorName: 'Pat', replyTo: {
        id: 'own', authorEmployeeId: 'mgr', authorName: 'Maya', kind: 'text', excerpt: 'own', isDeleted: false } }),
      message('re-gone', { replyTo: { id: 'gone', authorEmployeeId: 'pat', authorName: 'Pat', kind: 'text', excerpt: '', isDeleted: true } })
    ];
    const { msg, settle } = await render();
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;

    const quote = msg('re').querySelector('[data-testid="message-quote"]') as HTMLButtonElement;
    expect(quote.textContent).toContain('You');
    expect(quote.textContent).toContain('own');
    expect(msg('re-gone').querySelector('[data-testid="message-quote"]')!.textContent).toContain('Message deleted');

    quote.click();
    await settle();
    expect(scroll).toHaveBeenCalled();
    expect(msg('own').classList).toContain('msg--highlight');
  });

  it('hides the evidence markers of the old per-ticket chats', async () => {
    conv.messages = [message('ev', { kind: 'evidence', authorEmployeeId: null, authorName: null, bodyHtml: '' })];
    const { msg, el } = await render();
    expect(msg('ev')).toBeNull();
    expect(el.textContent).toContain('No messages yet');
  });
});
