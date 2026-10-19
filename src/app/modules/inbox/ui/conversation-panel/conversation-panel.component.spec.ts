import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { MessageCreatedEvent } from '../../../../core/realtime/inbox-realtime.models';
import { CommentComposerComponent } from '../../../../shared/ui/comment-composer/comment-composer.component';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { ConversationDto, ConversationMessageDto } from '../../models/inbox.dto';
import { ConversationPanelComponent, decorateMentions } from './conversation-panel.component';
import { ConversationStore } from '../../state/conversation.store';
import { InboxStore } from '../../state/inbox.store';

const ME = 'e1';
const REF = { source: 'work', kind: 'approval', id: 'a1' };

function message(id: string, createdAt: string, extra: Partial<ConversationMessageDto> = {}): ConversationMessageDto {
  return {
    id, conversationId: 'c1', authorEmployeeId: 'e2', authorName: 'Anu', authorAvatarFileId: null, kind: 'text',
    bodyHtml: `<p>${id}</p>`, systemEventJson: null, mentionEmployeeIds: [], createdAt, ...extra
  };
}

function conversation(): ConversationDto {
  return {
    id: 'c1', source: 'work', kind: 'approval', subjectId: 'a1', title: 'Task edit: Audit', projectId: 'p1',
    participants: [
      { employeeId: ME, name: 'Bala', avatarFileId: null, joinReason: 'base', addedByEmployeeId: null, addedAt: null },
      { employeeId: 'e2', name: 'Anu', avatarFileId: null, joinReason: 'base', addedByEmployeeId: null, addedAt: null },
      { employeeId: 'e3', name: 'Priya', avatarFileId: null, joinReason: 'added', addedByEmployeeId: ME, addedAt: '2026-10-12T09:00:00Z' }
    ],
    messages: [
      message('m1', '2026-10-12T09:00:00Z', { authorEmployeeId: ME, authorName: 'Bala' }),
      message('m2', '2026-10-12T09:01:00Z', { authorEmployeeId: null, authorName: null, kind: 'system', bodyHtml: 'Bala added Priya' }),
      message('m3', '2026-10-13T09:02:00Z', { bodyHtml: '<p>hey <span class="mention" data-employee-id="e1">@Bala</span></p>', mentionEmployeeIds: [ME] })
    ],
    hasMoreMessages: true, lastReadAt: '2026-10-13T09:00:00Z'
  };
}

describe('ConversationPanelComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let created: Subject<MessageCreatedEvent>;

  beforeEach(() => {
    api = {
      open: vi.fn(() => of(conversation())),
      messages: vi.fn(() => of({ items: [message('m0', '2026-10-11T09:00:00Z')], hasMore: false })),
      post: vi.fn((_: string, html: string) => of(message('m9', '2026-10-13T10:00:00Z', { authorEmployeeId: ME, bodyHtml: html }))),
      addParticipants: vi.fn((_: string, ids: string[]) => of(ids.map((id) => ({ employeeId: id, name: 'New', avatarFileId: null, joinReason: 'added', addedByEmployeeId: ME, addedAt: null })))),
      markRead: vi.fn(() => of(undefined)),
      searchPeople: vi.fn(() => of([{ employeeId: 'e7', name: 'Chen Li', avatarFileId: null }, { employeeId: 'e2', name: 'Anu', avatarFileId: null }]))
    };
    created = new Subject();
    TestBed.configureTestingModule({
      imports: [ConversationPanelComponent],
      providers: [
        ConversationStore,
        { provide: ConversationsApiService, useValue: api },
        { provide: InboxRealtimeService, useValue: { messageCreated$: created.asObservable(), participantAdded$: new Subject(), reconnected$: new Subject(), messageUpdated$: new Subject(), messageDeleted$: new Subject(), participantRemoved$: new Subject() } },
        { provide: AuthStore, useValue: { employeeId: () => ME } },
        { provide: InboxStore, useValue: { loadCounts: vi.fn(() => Promise.resolve()) } },
        { provide: TaskApiService, useValue: { uploadPendingFile: vi.fn(), deletePendingFile: vi.fn(), getFileUrl: vi.fn() } }
      ]
    });
  });

  async function render(actions = [{ key: 'approve', label: 'Approve', tone: 'primary' as const, needsComment: false, needsPayload: false }]) {
    const fixture = TestBed.createComponent(ConversationPanelComponent);
    fixture.componentRef.setInput('itemRef', REF);
    fixture.componentRef.setInput('actions', actions);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('opens the item conversation without a header: no title, reference, status or menu', async () => {
    const { el } = await render();

    expect(api['open']).toHaveBeenCalledWith(REF);
    expect(el.querySelector('header')).toBeNull();
    expect(el.querySelector('[data-testid="conversation-ref"]')).toBeNull();
    expect(el.querySelector('[data-testid="conversation-menu"]')).toBeNull();
  });

  it('floats only the details toggle when the details are hidden', async () => {
    const { fixture, el } = await render();
    const toggle = () => el.querySelector('[data-testid="conversation-toggle-details"]') as HTMLButtonElement;
    expect(toggle().classList).not.toContain('conv__details-toggle--always');

    fixture.componentRef.setInput('detailsVisible', false);
    fixture.detectChanges();
    expect(toggle().classList).toContain('conv__details-toggle--always');
    const emitted = vi.fn();
    fixture.componentInstance.toggleDetails.subscribe(emitted);
    toggle().click();
    expect(emitted).toHaveBeenCalled();
  });

  it('keeps an unsent draft per ticket and never carries it into another ticket', async () => {
    const { fixture } = await render();
    const panel = fixture.componentInstance as unknown as {
      composer(): { editorHtml: { (): string; set(v: string): void } } | undefined; draftFor(key: string): string;
    };
    panel.composer()!.editorHtml.set('<p>half written</p>');

    fixture.componentRef.setInput('itemRef', { ...REF, id: 'other' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(panel.draftFor('work:approval:other')).toBe('');
    expect(panel.draftFor(`${REF.source}:${REF.kind}:${REF.id}`)).toBe('<p>half written</p>');
    expect(panel.composer()!.editorHtml()).toBe('');

    fixture.componentRef.setInput('itemRef', REF);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(panel.composer()!.editorHtml()).toBe('<p>half written</p>');
  });

  it('groups by day, right-aligns own messages, centres system messages and marks the unread divider', async () => {
    const { el } = await render();

    expect(Array.from(el.querySelectorAll('[data-testid="conversation-day"]')).length).toBe(2);
    expect(el.querySelector('[data-message-id="m1"]')?.classList).toContain('msg--own');
    expect(el.querySelector('[data-message-id="m2"]')?.classList).toContain('msg--system');
    expect(el.querySelector('[data-message-id="m2"]')?.textContent).toContain('Bala added Priya');
    const divider = el.querySelector('[data-testid="conversation-unread-divider"]');
    expect(divider?.nextElementSibling?.getAttribute('data-message-id')).toBe('m3');
  });

  it('highlights the current user mention more strongly', async () => {
    const { el } = await render();
    expect(el.querySelector('[data-message-id="m3"] .mention')?.classList).toContain('mention--me');
  });

  it('sends from the composer with mentions', async () => {
    const { fixture } = await render();
    const composer = fixture.debugElement.query(By.directive(CommentComposerComponent)).componentInstance as CommentComposerComponent;

    composer.submitted.emit({ content: '<p>hi</p>', attachmentFileIds: [], mentions: ['e2'] });
    await fixture.whenStable();

    expect(api['post']).toHaveBeenCalledWith('c1', '<p>hi</p>', ['e2'], [], null, null);
  });

  it('offers the item actions and /add in the composer slash menu', async () => {
    const { fixture } = await render();
    const composer = fixture.debugElement.query(By.directive(CommentComposerComponent)).componentInstance as CommentComposerComponent;
    const actions: string[] = [];
    fixture.componentInstance.action.subscribe((k) => actions.push(k));

    expect(composer.extraSlashCommands().map((c) => c.id)).toEqual(['approve', 'add']);
    composer.slashCommand.emit('approve');
    composer.slashCommand.emit('add');
    fixture.detectChanges();

    expect(actions).toEqual(['approve']);
    expect(fixture.nativeElement.querySelector('[data-testid="conversation-add-panel"]')).not.toBeNull();
  });

  it('add-and-tag adds the person first, then inserts the mention', async () => {
    const { fixture } = await render();
    const composer = fixture.debugElement.query(By.directive(CommentComposerComponent)).componentInstance as CommentComposerComponent;
    const insert = vi.spyOn(composer, 'insertMention');

    composer.addAndTag.emit({ id: 'e7', name: 'Chen Li' });
    await fixture.whenStable();

    expect(api['addParticipants']).toHaveBeenCalledWith('c1', ['e7']);
    expect(insert).toHaveBeenCalledWith({ id: 'e7', name: 'Chen Li' });
  });

  it('adds members picked in the add panel (/add)', async () => {
    const { fixture, el } = await render();
    (fixture.componentInstance as unknown as { onSlashCommand(id: string): void }).onSlashCommand('add');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="conversation-add-panel"]')).not.toBeNull();
    const panel = fixture.componentInstance as unknown as { toggleCandidate(id: string): void; confirmAdd(): Promise<void> };

    panel.toggleCandidate('e7');
    await panel.confirmAdd();

    expect(api['addParticipants']).toHaveBeenCalledWith('c1', ['e7']);
  });

  it('finds people to add through the conversation people lookup, leaving out current members', async () => {
    const { fixture } = await render();
    (fixture.componentInstance as unknown as { onSlashCommand(id: string): void }).onSlashCommand('add');

    fixture.detectChanges();
    const panel = fixture.componentInstance as unknown as {
      candidateOptions(): { id: string; name: string }[];
      mentionSearch(q: string): import('rxjs').Observable<readonly { id: string; name: string }[]>;
    };

    expect(api['searchPeople']).toHaveBeenCalledWith('');
    expect(panel.candidateOptions().map((o) => o.id)).toEqual(['e7']);
    let found: readonly { id: string; name: string }[] = [];
    panel.mentionSearch('ch').subscribe((r) => (found = r));
    expect(api['searchPeople']).toHaveBeenCalledWith('ch');
    expect(found.map((p) => p.id)).toEqual(['e7', 'e2']);
  });

  it('keeps the add panel usable when the people lookup fails', async () => {
    api['searchPeople'].mockReturnValue(throwError(() => new Error('boom')));
    const { fixture } = await render();
    (fixture.componentInstance as unknown as { onSlashCommand(id: string): void }).onSlashCommand('add');
    fixture.detectChanges();
    const panel = fixture.componentInstance as unknown as {
      candidateOptions(): unknown[];
      mentionSearch(q: string): import('rxjs').Observable<readonly unknown[]>;
    };

    expect(panel.candidateOptions()).toEqual([]);
    let found: readonly unknown[] | null = null;
    panel.mentionSearch('x').subscribe((r) => (found = r));
    expect(found).toEqual([]);
  });

  it('loads older messages when scrolled to the top (no button)', async () => {
    const { fixture, el } = await render();
    expect(el.querySelector('[data-testid="conversation-load-older"]')).toBeNull();
    el.querySelector('[data-testid="conversation-messages"]')!.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(api['messages']).toHaveBeenCalledWith('c1', '2026-10-12T09:00:00Z');
  });

  it('shows live messages', async () => {
    const { fixture, el } = await render();
    created.next({ conversationId: 'c1', message: message('m4', '2026-10-13T09:30:00Z', { bodyHtml: '<p>live</p>' }) });
    fixture.detectChanges();
    expect(el.querySelector('[data-message-id="m4"]')?.textContent).toContain('live');
  });
});

describe('decorateMentions', () => {
  it('marks only the current user mention chips', () => {
    const html = '<p><span class="mention" data-employee-id="e1">@Bala</span> <span class="mention" data-employee-id="e2">@Anu</span></p>';
    const out = decorateMentions(html, 'e1');
    expect(out).toContain('class="mention mention--me" data-employee-id="e1"');
    expect(out).toContain('class="mention" data-employee-id="e2"');
    expect(decorateMentions('<p>plain</p>', 'e1')).toBe('<p>plain</p>');
  });
});
