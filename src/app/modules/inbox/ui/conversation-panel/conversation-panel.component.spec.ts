import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { By } from '@angular/platform-browser';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { MessageCreatedEvent } from '../../../../core/realtime/inbox-realtime.models';
import { CommentComposerComponent } from '../../../../shared/ui/comment-composer/comment-composer.component';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { ConversationDto, ConversationMessageDto } from '../../models/inbox.dto';
import { ConversationPanelComponent, decorateMentions } from './conversation-panel.component';

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
      markRead: vi.fn(() => of(undefined))
    };
    created = new Subject();
    TestBed.configureTestingModule({
      imports: [ConversationPanelComponent],
      providers: [
        { provide: ConversationsApiService, useValue: api },
        { provide: InboxRealtimeService, useValue: { messageCreated$: created.asObservable(), participantAdded$: new Subject(), reconnected$: new Subject() } },
        { provide: AuthStore, useValue: { employeeId: () => ME } },
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn(() => of({ items: [{ id: 'e7', fullName: 'Chen Li' }, { id: 'e2', fullName: 'Anu' }] })) } },
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

  it('opens the item conversation and lists members with base vs added in the tooltip', async () => {
    const { el } = await render();

    expect(api['open']).toHaveBeenCalledWith(REF);
    const members = el.querySelector('[data-testid="conversation-members"]') as HTMLElement;
    expect(members.getAttribute('title')).toContain('Priya (added)');
    expect(members.getAttribute('title')).toContain('Anu');
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

    expect(api['post']).toHaveBeenCalledWith('c1', '<p>hi</p>', ['e2']);
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

  it('adds members picked in the add panel', async () => {
    const { fixture, el } = await render();
    (el.querySelector('[data-testid="conversation-add-member"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const panel = fixture.componentInstance as unknown as { toggleCandidate(id: string): void; confirmAdd(): Promise<void> };

    panel.toggleCandidate('e7');
    await panel.confirmAdd();

    expect(api['addParticipants']).toHaveBeenCalledWith('c1', ['e7']);
  });

  it('loads older messages', async () => {
    const { fixture, el } = await render();
    (el.querySelector('[data-testid="conversation-load-older"]') as HTMLButtonElement).click();
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
