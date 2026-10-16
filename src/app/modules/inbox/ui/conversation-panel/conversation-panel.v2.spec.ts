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
import { ConversationDto, ConversationMessageDto, ConversationParticipantDto } from '../../models/inbox.dto';
import { InboxStore } from '../../state/inbox.store';
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
        message('ask', { tag: 'info_request' }),
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
      removeParticipant: vi.fn(() => of(undefined)),
      leave: vi.fn(() => of(undefined)),
      attachment: vi.fn(() => of(new Blob(['x'])))
    };
    inboxApi = { exportItem: vi.fn(() => of(new Blob(['<html></html>'], { type: 'text/html' }))) };
    removed = new Subject();
    TestBed.configureTestingModule({
      imports: [ConversationPanelComponent],
      providers: [
        { provide: ConversationsApiService, useValue: api },
        { provide: InboxApiService, useValue: inboxApi },
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
  });

  async function render(requesterId: string | null = 'pat') {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('itemRef', REF);
    fixture.componentRef.setInput('requesterId', requesterId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const msg = (id: string) => el.querySelector(`[data-message-id="${id}"]`) as HTMLElement;
    const settle = async () => { fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges(); };
    const panel = fixture.componentInstance as unknown as { menu(): { id: string }[]; onMenu(id: string): void };
    /** Picks an entry of the header's ⋯ menu. */
    const menu = (id: string) => panel.onMenu(id);
    const menuIds = () => panel.menu().map((i) => i.id);
    return { fixture, el, q, msg, settle, menu, menuIds };
  }

  it('the participants popover shows each role; Remove shows for added members to base members', async () => {
    const { q, settle, el, menu } = await render(null);
    menu('members');
    await settle();

    const rows = Array.from(el.querySelectorAll('[data-testid="conversation-participant"]')) as HTMLElement[];
    expect(rows.map((r) => r.querySelector('[data-testid="participant-role"]')?.textContent?.trim()))
      .toEqual(['Subject', 'Approver', 'Viewer', 'Added', 'Added']);
    expect(q('participant-remove-sam')).not.toBeNull();
    expect(q('participant-remove-lee')).not.toBeNull();
    expect(q('participant-remove-pat')).toBeNull();
    expect(q('participant-remove-hr')).toBeNull();

    q('participant-remove-sam')!.click();
    await settle();
    expect(api['removeParticipant']).toHaveBeenCalledWith('c1', 'sam');
  });

  it('labels the requester; an added member may remove whom they added, and can leave', async () => {
    me = 'sam';
    const { q, settle, el, menu, menuIds } = await render('mgr');
    menu('members');
    await settle();

    expect(el.querySelector('[data-employee-id="mgr"] [data-testid="participant-role"]')?.textContent).toContain('Requester');
    expect(q('participant-remove-lee')).not.toBeNull();
    expect(q('participant-remove-pat')).toBeNull();
    expect(q('participant-remove-sam')).toBeNull();

    expect(menuIds()).toContain('leave');
    menu('leave');
    await settle();
    q('conversation-leave-confirm')!.click();
    await settle();
    expect(api['leave']).toHaveBeenCalledWith('c1');
    expect(q('conversation-removed')?.textContent).toContain('You were removed from this conversation');
    expect(el.querySelector('app-comment-composer')).toBeNull();
  });

  it('shows (edited), the deleted placeholder, tag labels and the justification card', async () => {
    const { msg } = await render();

    expect(msg('edited').textContent).toContain('(edited)');
    expect(msg('gone').textContent).toContain('Message deleted');
    expect(msg('ask').querySelector('[data-testid="message-tag"]')?.textContent).toContain('Info requested');
    expect(msg('why').classList.contains('msg--justification')).toBe(true);
  });

  it('the author edits inline with the composer and deletes; others get no menu', async () => {
    const { msg, q, settle, fixture } = await render();

    expect(msg('edited').querySelector('[data-testid="message-menu"]')).toBeNull();
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

    expect(api['post']).toHaveBeenCalledWith('c1', '<p>I was at the clinic</p>', [], ['f1'], 'justification');
  });

  it('export is offered to deciders and viewers, not to the subject or an added member', async () => {
    const { settle, menu, menuIds } = await render();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    expect(menuIds()).toContain('export');
    menu('export');
    await settle();
    expect(inboxApi.exportItem).toHaveBeenCalledWith(REF);
    click.mockRestore();
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
  });

  it('says so when the server refuses the export', async () => {
    inboxApi.exportItem.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    const { settle, el, menu } = await render();

    menu('export');
    await settle();

    expect(el.textContent).toContain('You cannot export this conversation.');
  });

  it('the subject is not offered Export in the menu', async () => {
    me = 'pat';
    expect((await render()).menuIds()).not.toContain('export');
  });
});
