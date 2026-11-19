import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NavigationStateService } from '../../../../layouts/main-layout/nav/navigation-state.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { InboxChatRowDto } from '../../models/inbox-chat.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { chatTimeLabel } from '../chat-list/chat-list.component';
import { InboxChatSidebarComponent } from './inbox-chat-sidebar.component';

function row(id: string, extra: Partial<InboxChatRowDto> = {}): InboxChatRowDto {
  return {
    conversationId: id, source: 'direct', kind: 'direct', subjectId: `pair-${id}`, type: 'direct', title: `Person ${id}`,
    otherEmployeeId: `emp-${id}`, avatarFileId: null, memberCount: 2, preview: 'You: hi', lastMessageAt: '2026-10-20T08:00:00Z',
    unread: 0, pending: [], caseItem: null, ...extra
  };
}

describe('InboxChatSidebarComponent', () => {
  let router: { navigate: ReturnType<typeof vi.fn>; url: string; events: Subject<unknown> };
  let collapse: ReturnType<typeof vi.fn>;
  let searchPeople: ReturnType<typeof vi.fn>;
  let setFavorite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    router = { navigate: vi.fn(() => Promise.resolve(true)), url: '/inbox/direct/direct/pair-c1', events: new Subject() };
    collapse = vi.fn();
    setFavorite = vi.fn(() => of(undefined));
    searchPeople = vi.fn(() => of([{ employeeId: 'emp-new', name: 'Kiran New', avatarFileId: null }]));
    TestBed.configureTestingModule({
      imports: [InboxChatSidebarComponent],
      providers: [
        {
          provide: InboxChatsApiService, useValue: {
            list: vi.fn(() => of([
              row('c1', { unread: 2, lastMessageAt: '2026-10-19T08:00:00Z' }),
              row('c2', { title: 'Kiru', unread: 3, lastMessageAt: '2026-10-20T10:00:00Z', pending: [{ source: 'leave', kind: 'request', id: 'l1', title: 'Annual leave' }] }),
              row('g2', { source: 'group', kind: 'group', subjectId: 'g2', type: 'group', title: 'Ops huddle', otherEmployeeId: null, isFavorite: true }),
              row('g1', { source: 'group', kind: 'group', subjectId: 'g1', type: 'group', title: 'Payroll review', otherEmployeeId: null, lastMessageAt: '2026-10-20T11:00:00Z' }),
              row('k1', { source: 'monitoring', kind: 'exception_case', subjectId: 'x1', type: 'case', title: 'Face check - Priya', otherEmployeeId: null })
            ])),
            openDirect: vi.fn(() => of({ conversationId: 'c9', source: 'direct', kind: 'direct', subjectId: 'pair-c9' })),
            createGroup: vi.fn(),
            setFavorite
          }
        },
        { provide: ConversationsApiService, useValue: { searchPeople } },
        { provide: InboxRealtimeService, useValue: { inboxChanged$: new Subject(), messageCreated$: new Subject(), participantAdded$: new Subject(), reconnected$: new Subject() } },
        { provide: AuthStore, useValue: { employeeId: signal('me') } },
        { provide: Router, useValue: router },
        { provide: NavigationStateService, useValue: { collapseSubSidebar: collapse } },
        { provide: InboxKindsStore, useValue: { kinds: signal([]), ensureLoaded: vi.fn(() => Promise.resolve()) } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: PermissionService, useValue: { hasPermission: () => true } }
      ]
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(InboxChatSidebarComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement;
    const names = (list: string) => Array.from(q(list).querySelectorAll('[data-testid="chat-row"]')).map((r) => r.textContent!.trim());
    return { fixture, el, q, names };
  }

  it('lists groups and direct messages together, newest last message first, with a "+" menu for new chats', async () => {
    const { q, names } = await render();

    // Ops huddle is a favorite (pinned on top); the rest by last message.
    expect(names('chat-rows')).toEqual([expect.stringContaining('Ops huddle'), expect.stringContaining('Payroll review'),
      expect.stringContaining('Kiru'), expect.stringContaining('Face check - Priya'), expect.stringContaining('Person c1')]);
    expect(q('chat-new')).not.toBeNull();
  });

  it('marks the open chat and never shows it as unread', async () => {
    const { el } = await render();

    const active = el.querySelector('.cl__row--active')!;
    expect(active.textContent).toContain('Person c1');
    expect(active.querySelector('.cl__unread')).toBeNull();
  });

  it('a favorite moves to the top and is saved on the server', async () => {
    const { fixture, names } = await render();

    expect(names('chat-rows')[0]).toContain('Ops huddle');
    await TestBed.inject(InboxChatsStore).toggleFavorite('c2');
    fixture.detectChanges();

    expect(names('chat-rows').slice(0, 2)).toEqual([expect.stringContaining('Kiru'), expect.stringContaining('Ops huddle')]);
    expect(setFavorite).toHaveBeenCalledWith('c2', true);
  });

  it('a favorite that fails to save is put back', async () => {
    setFavorite.mockReturnValue(throwError(() => new Error('offline')));
    await render();

    await TestBed.inject(InboxChatsStore).toggleFavorite('c2');

    expect(TestBed.inject(InboxChatsStore).favorites().has('c2')).toBe(false);
  });

  it('Pending narrows to chats waiting on the user, with no selection checkboxes', async () => {
    const { fixture, q, names } = await render();

    (q('chat-filter-pending') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(names('chat-rows')).toEqual([expect.stringContaining('Kiru')]);
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('a chat badge counts its open cases plus its unread messages', async () => {
    const { fixture } = await render();

    const badge = fixture.nativeElement.querySelector('[data-testid="chat-row-count"]') as HTMLElement;
    expect(badge.textContent!.trim()).toBe('4');
    expect(badge.getAttribute('title')).toBe('1 waiting on you, 3 unread');
  });

  it('the search filters chats by name and offers people to start a chat with', async () => {
    const { fixture, q, names } = await render();

    (q('chat-search-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = q('chat-search') as HTMLInputElement;
    input.value = 'kir';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(names('chat-rows')).toEqual([expect.stringContaining('Kiru')]);
    expect(searchPeople).toHaveBeenCalledWith('kir');
    (q('chat-person') as HTMLButtonElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'direct', 'direct', 'pair-c9']);
  });

  it('opening a row navigates to its chat; the collapse button closes the sub-sidebar', async () => {
    const { el } = await render();

    (Array.from(el.querySelectorAll('[data-testid="chat-row"]')).find((r) => r.textContent!.includes('Payroll')) as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/inbox', 'group', 'group', 'g1']);

    (el.querySelector('[aria-label="Close sidebar"]') as HTMLButtonElement).click();
    expect(collapse).toHaveBeenCalled();
  });
});

describe('chatTimeLabel', () => {
  const now = new Date(2026, 9, 27, 18, 0);

  it('shows the time today, "Yesterday", then the date (with the year for other years)', () => {
    expect(chatTimeLabel(new Date(2026, 9, 27, 17, 28).toISOString(), now)).toBe('5:28 PM');
    expect(chatTimeLabel(new Date(2026, 9, 26, 9, 0).toISOString(), now)).toBe('Yesterday');
    expect(chatTimeLabel(new Date(2026, 9, 25, 9, 0).toISOString(), now)).toBe('Oct 25');
    expect(chatTimeLabel(new Date(2025, 9, 25, 9, 0).toISOString(), now)).toBe('Oct 25, 2025');
  });
});
