import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { ConversationParticipantDto } from '../../models/inbox.dto';
import { ConversationStore } from '../../state/conversation.store';
import { TicketParticipantsComponent } from './ticket-participants.component';

function person(employeeId: string, name: string, joinReason: 'base' | 'added' | 'viewer', addedBy: string | null = null,
  avatarFileId: string | null = null): ConversationParticipantDto {
  return { employeeId, name, avatarFileId, joinReason, addedByEmployeeId: addedBy, addedAt: null };
}

describe('TicketParticipantsComponent', () => {
  let participants: ReturnType<typeof signal<ConversationParticipantDto[]>>;
  let store: Record<string, unknown>;
  let directory: { get: ReturnType<typeof vi.fn>; seed: ReturnType<typeof vi.fn> };
  let api: { searchPeople: ReturnType<typeof vi.fn> };
  let inboxApi: { exportItem: ReturnType<typeof vi.fn> };
  let me: string;

  beforeEach(() => {
    participants = signal([
      person('pat', 'Pat', 'base'), person('me', 'Maya', 'base'), person('hr', 'Hana', 'viewer'),
      person('sam', 'Sam', 'added', 'me', 'file-sam'), person('lee', 'Lee', 'added', 'sam'), person('kim', 'Kim', 'added', 'me')
    ]);
    me = 'me';
    inboxApi = { exportItem: vi.fn(() => of(new Blob(['<html></html>']))) };
    store = {
      ref: signal({ source: 'monitoring', kind: 'exception_case', id: 'x1' }), leave: vi.fn(() => Promise.resolve(true)),
      conversationId: signal('c1'), participants, removed: signal(false), subjectEmployeeId: signal('pat'),
      removeParticipant: vi.fn(() => Promise.resolve(true)), addParticipants: vi.fn(() => Promise.resolve([]))
    };
    directory = { get: vi.fn((id: string) => (id === 'pat' ? { id, name: 'Pat', initials: 'P', avatarUrl: 'cached://pat' } : undefined)), seed: vi.fn() };
    api = { searchPeople: vi.fn(() => of([{ employeeId: 'new', name: 'Nia', avatarFileId: null }, { employeeId: 'sam', name: 'Sam', avatarFileId: null }])) };
    TestBed.configureTestingModule({
      imports: [TicketParticipantsComponent],
      providers: [
        { provide: ConversationStore, useValue: store },
        { provide: EmployeeDirectoryStore, useValue: directory },
        { provide: ConversationsApiService, useValue: api },
        { provide: InboxApiService, useValue: inboxApi },
        { provide: AuthStore, useValue: { employeeId: () => me } }
      ]
    });
  });

  function render(requesterId: string | null = null) {
    const fixture = TestBed.createComponent(TicketParticipantsComponent);
    fixture.componentRef.setInput('requesterId', requesterId);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const rows = () => Array.from(el.querySelectorAll('[data-testid="ticket-participant"]')).map((r) => r.getAttribute('data-employee-id'));
    const roles = () => Array.from(el.querySelectorAll('[data-testid="ticket-participant"]'))
      .map((r) => r.querySelector('.tp__role')?.textContent?.trim());
    const menuIds = () => (fixture.componentInstance as unknown as { menu(): { id: string }[] }).menu().map((i) => i.id);
    const pick = (id: string) => (fixture.componentInstance as unknown as { onMenu(id: string): void }).onMenu(id);
    return { fixture, el, q, rows, roles, menuIds, pick };
  }

  it('shows four members, then the rest on Show more without any request', () => {
    const { fixture, q, rows } = render();

    expect(rows()).toEqual(['pat', 'me', 'hr', 'sam']);
    expect(q('ticket-participants-more')!.textContent).toContain('Show 2 more');

    q('ticket-participants-more')!.click();
    fixture.detectChanges();
    expect(rows()).toEqual(['pat', 'me', 'hr', 'sam', 'lee', 'kim']);
    expect(q('ticket-participants-more')!.textContent).toContain('Show less');
    expect(api.searchPeople).not.toHaveBeenCalled();
  });

  it('puts the members in the shared people cache and uses its photo first', () => {
    const { el } = render();

    expect(directory.seed).toHaveBeenCalledWith(expect.arrayContaining([{ id: 'sam', name: 'Sam', avatarFileId: 'file-sam' }]));
    const pat = el.querySelector('[data-employee-id="pat"] img') as HTMLImageElement | null;
    expect(pat?.getAttribute('src')).toBe('cached://pat');
  });

  it('removes added members the caller may remove', async () => {
    const { q } = render();

    expect(q('ticket-participant-remove-pat')).toBeNull();
    q('ticket-participant-remove-sam')!.click();
    expect(store['removeParticipant']).toHaveBeenCalledWith('sam');
  });

  it('adds people from the + button, offering only people not already in', () => {
    const { fixture, el, q } = render();

    q('ticket-participants-add')!.click();
    fixture.detectChanges();
    expect(api.searchPeople).toHaveBeenCalledWith('');
    const picker = q('ticket-participants-picker')!;
    expect(picker.textContent).toContain('Nia');
    expect(picker.textContent).not.toContain('Sam');

    (fixture.componentInstance as unknown as { toggleCandidate(id: string): void }).toggleCandidate('new');
    fixture.detectChanges();
    q('ticket-participants-add-confirm')!.click();
    expect(store['addParticipants']).toHaveBeenCalledWith(['new']);
    expect(el).toBeTruthy();
  });

  it('shows nothing before the chat is open', () => {
    (store['conversationId'] as ReturnType<typeof signal<string | null>>).set(null);
    expect(render().q('ticket-participants')).toBeNull();
  });

  it('labels each member’s role, and the requester', () => {
    const { fixture, roles } = render('hr');
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();
    expect(roles()).toEqual(['Subject', 'Approver', 'Viewer', 'Added', 'Added', 'Added']);
    TestBed.resetTestingModule();
  });

  it('an added member may remove whom they added, and can leave after confirming', async () => {
    me = 'sam';
    const { fixture, q, menuIds, pick } = render();
    fixture.componentInstance['expanded'].set(true);
    fixture.detectChanges();

    expect(q('ticket-participant-remove-lee')).not.toBeNull();
    expect(q('ticket-participant-remove-kim')).toBeNull();
    expect(menuIds()).toEqual(['leave']);
    pick('leave');
    fixture.detectChanges();
    q('conversation-leave-confirm')!.click();
    expect(store['leave']).toHaveBeenCalled();
  });

  it('offers Export to deciders and viewers, not to the subject or an added member', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const decider = render();
    expect(decider.menuIds()).toEqual(['export']);
    decider.pick('export');
    expect(inboxApi.exportItem).toHaveBeenCalledWith({ source: 'monitoring', kind: 'exception_case', id: 'x1' });
    click.mockRestore();
    TestBed.resetTestingModule();

    me = 'pat';
    expect(render().menuIds()).toEqual([]);
  });

  it('says so when the server refuses the export', () => {
    inboxApi.exportItem.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    const { fixture, el, pick } = render();
    pick('export');
    fixture.detectChanges();
    expect(el.textContent).toContain('You cannot export this conversation.');
  });
});
