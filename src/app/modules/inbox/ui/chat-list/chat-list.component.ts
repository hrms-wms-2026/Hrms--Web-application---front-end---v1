import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatPendingItemDto, InboxChatRowDto } from '../../models/inbox-chat.dto';
import { ConversationPersonDto } from '../../models/inbox.dto';
import { EntityIconComponent } from '../../../../shared/ui/entity-icon/entity-icon.component';

export type ChatListFilter = 'all' | 'pending';

const STAR_ICON = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

/** "source:kind" of a pending item - what the type filter matches. */
export function pendingKindKey(item: { source: string; kind: string }): string {
  return `${item.source}:${item.kind}`;
}

/** The pending items of a row that pass the type filter (all of them when no type is picked). */
export function pendingMatching(row: InboxChatRowDto, kind: string | null): InboxChatPendingItemDto[] {
  return kind ? row.pending.filter((p) => pendingKindKey(p) === kind) : row.pending;
}

/** Favorites first (in their own order of activity), then the rest in the order given. */
export function withFavoritesFirst(rows: readonly InboxChatRowDto[], favorites: ReadonlySet<string>): InboxChatRowDto[] {
  return [...rows.filter((r) => favorites.has(r.conversationId)), ...rows.filter((r) => !favorites.has(r.conversationId))];
}

/** Newest last message first; chats with no message yet go last (stable, so the server's order breaks ties). */
export function byLastMessage(rows: readonly InboxChatRowDto[]): InboxChatRowDto[] {
  const at = (r: InboxChatRowDto) => (r.lastMessageAt ? Date.parse(r.lastMessageAt) : -Infinity);
  return [...rows].sort((a, b) => at(b) - at(a));
}

/** "5:28 PM" today, "Yesterday", else "Oct 25" (with the year when it is not this year). */
export function chatTimeLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * The inbox's chats in one list - groups, case groups and direct messages together - newest last message first, with
 * favorites pinned on top. Each row shows the last message and its time. A search term also finds anyone in the legal
 * entity to start a chat with. "Pending" narrows to chats with something waiting on the user (optionally of one type).
 */
@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [AvatarComponent, EntityIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cl" data-testid="chat-list" [class.cl--roomy]="roomy()">
      @if (loading() && rows().length === 0) {
        <p class="cl__state" aria-live="polite">Loading your chats…</p>
      } @else if (error() && rows().length === 0) {
        <p class="cl__state cl__state--error" role="alert">{{ error() }}</p>
      }

      <ul class="cl__rows" data-testid="chat-rows">
        @for (row of sortedRows(); track row.conversationId) {
          <li class="cl__row" [class.cl__row--active]="row.conversationId === activeId()">
            <button type="button" class="cl__open" data-testid="chat-row" [title]="row.preview ?? row.title" (click)="openRow.emit(row)">
              @if (row.type === 'direct' || row.avatarFileId) {
                <app-avatar [userName]="row.title" [avatarUrl]="avatarUrl(row.avatarFileId)" size="md" />
              } @else if (row.icon) {
                <app-entity-icon class="cl__icon" shape="circle" [icon]="row.icon" [color]="row.color" [name]="row.title" />
              } @else {
                <span class="cl__group" [class.cl__group--case]="row.type === 'case'" aria-hidden="true">
                  @if (row.type === 'case') {
                    <svg viewBox="0 0 24 24"><path d="M9 4h6M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 12h6M9 16h4" /></svg>
                  } @else {
                    <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  }
                </span>
              }
              <span class="cl__text">
                <span class="cl__line">
                  <span class="cl__name" [class.cl__name--unread]="unreadOf(row) > 0">{{ row.title }}</span>
                  @if (favorites().has(row.conversationId)) {
                    <svg class="cl__star" viewBox="0 0 24 24" aria-label="Favorite"><path [attr.d]="starIcon" /></svg>
                  }
                  @if (row.isMuted) {
                    <svg class="cl__muted" data-testid="chat-row-muted" viewBox="0 0 24 24" aria-label="Muted"><path d="M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17.9 17.9 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M2 2l20 20" /></svg>
                  }
                  @if (row.lastMessageAt) { <span class="cl__time">{{ timeLabel(row.lastMessageAt) }}</span> }
                </span>
                <span class="cl__line">
                  <span class="cl__preview">{{ row.preview ?? '' }}</span>
                  <!-- Open cases waiting on you (until decided) plus unread text messages (until the chat is read). -->
                  @let waiting = pendingMatching(row, kind()).length;
                  @if (waiting > 0) {
                    <span class="cl__pending" data-testid="chat-row-count"
                      [attr.title]="waiting + ' waiting on you' + (unreadOf(row) > 0 ? ', ' + unreadOf(row) + ' unread' : '')">{{ waiting + unreadOf(row) }}</span>
                  } @else if (unreadOf(row) > 0) {
                    <span class="cl__unread" [class.cl__unread--muted]="row.isMuted" [attr.aria-label]="unreadOf(row) + ' unread'">{{ unreadOf(row) }}</span>
                  }
                </span>
              </span>
            </button>
          </li>
        } @empty {
          @if (!loading() && people().length === 0) {
            <li class="cl__quiet">{{ search().trim() ? 'No chat or person matches' : filter() === 'pending' ? 'Nothing waiting on you' : 'No chats yet' }}</li>
          }
        }
        @if (search().trim()) {
          @for (p of people(); track p.employeeId) {
            <li class="cl__row">
              <button type="button" class="cl__open" data-testid="chat-person" [title]="'Start a chat with ' + p.name" (click)="startWith(p)">
                <app-avatar [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="md" />
                <span class="cl__text"><span class="cl__line"><span class="cl__name">{{ p.name }}</span><span class="cl__hint">New</span></span></span>
              </button>
            </li>
          }
        }
      </ul>
    </div>
  `,
  styles: [`
    :host { display: flex; min-height: 0; flex-direction: column; }
    .cl { display: flex; flex-direction: column; gap: 4px; }
    .cl__state { margin: 0; padding: 16px 8px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .cl__state--error { color: var(--color-danger); }
    .cl__rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .cl__quiet { padding: 8px; color: var(--color-text-secondary); font-size: 12px; }
    .cl__row { position: relative; display: flex; align-items: center; gap: 2px; border-radius: 10px; }
    .cl__row:hover { background: var(--color-surface); }
    .cl__row--active, .cl__row--active:hover { background: var(--color-surface); box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
    .cl__row--active .cl__name { color: var(--color-accent); }
    .cl__open { display: flex; min-width: 0; flex: 1; align-items: center; gap: 10px; padding: 8px; border: 0; border-radius: 10px; background: none;
      color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .cl__open:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
    .cl__open app-avatar { flex: 0 0 auto; }
    .cl__icon { --entity-icon-size: 36px; }
    .cl__group { display: inline-flex; width: 36px; height: 36px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 999px;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); }
    .cl__group--case { background: color-mix(in srgb, var(--color-warning, #d97706) 15%, var(--color-surface)); color: var(--color-warning, #b45309); }
    .cl__group svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cl__text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .cl__line { display: flex; min-width: 0; align-items: center; gap: 6px; }
    .cl__name { overflow: hidden; min-width: 0; flex: 1; color: var(--color-text-primary); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .cl__name--unread { font-weight: 700; }
    .cl__time { flex: 0 0 auto; color: var(--color-text-secondary); font-size: 11px; }
    .cl__preview { overflow: hidden; min-width: 0; flex: 1; color: var(--color-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .cl__hint { flex: 0 0 auto; color: var(--color-accent); font-size: 11px; font-weight: 650; }
    .cl__star { width: 12px; height: 12px; flex: 0 0 auto; fill: var(--color-warning, #d97706); }
    .cl__unread, .cl__pending { min-width: 18px; flex: 0 0 auto; padding: 0 5px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
    .cl__unread { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    /* A muted chat still shows how much is unread, in grey: it does not count towards the inbox badge. */
    .cl__unread--muted { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .cl__muted { width: 13px; height: 13px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cl__pending { background: color-mix(in srgb, var(--color-warning, #d97706) 16%, transparent); color: var(--color-warning, #b45309); }
    /* Full-width (phone) list: a little more room per row. */
    .cl--roomy .cl__open { padding: 10px 8px; }
  `]
})
export class ChatListComponent {
  private readonly conversations = inject(ConversationsApiService);

  rows = input<readonly InboxChatRowDto[]>([]);
  loading = input(false);
  error = input<string | null>(null);
  /** The open chat. */
  activeId = input<string | null>(null);
  filter = input<ChatListFilter>('all');
  /** Pending type filter ("source:kind"), null = every type. */
  kind = input<string | null>(null);
  favorites = input<ReadonlySet<string>>(new Set());
  /** Narrows the chats by name and finds people to start a chat with. */
  search = input('');
  /** Bigger rows with the last message (the full-width phone list). */
  roomy = input(false);

  openRow = output<InboxChatRowDto>();
  /** A person from the search with no chat yet: the host opens (creates) the 1-on-1 chat. */
  openPerson = output<ConversationPersonDto>();

  protected readonly people = signal<ConversationPersonDto[]>([]);
  protected readonly pendingMatching = pendingMatching;
  protected readonly starIcon = STAR_ICON;
  private readonly searches = new Subject<string>();

  protected readonly visibleRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    let rows = this.rows();
    if (this.filter() === 'pending') rows = rows.filter((r) => pendingMatching(r, this.kind()).length > 0);
    return term ? rows.filter((r) => r.title.toLowerCase().includes(term)) : rows;
  });
  protected readonly sortedRows = computed(() => withFavoritesFirst(byLastMessage(this.visibleRows()), this.favorites()));

  constructor() {
    // Anyone in the legal entity, minus people the user already has a 1-on-1 chat with (those show as chats).
    this.searches.pipe(
      debounceTime(250),
      switchMap((text) => (text.trim() ? this.conversations.searchPeople(text.trim()).pipe(catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(inject(DestroyRef))
    ).subscribe((found) => {
      const chatting = new Set(this.rows().filter((r) => r.type === 'direct').map((r) => r.otherEmployeeId));
      this.people.set(found.filter((p) => !chatting.has(p.employeeId)));
    });
    effect(() => {
      const term = this.search();
      untracked(() => {
        if (!term.trim()) this.people.set([]);
        this.searches.next(term);
      });
    });
  }

  protected timeLabel(iso: string): string {
    return chatTimeLabel(iso);
  }

  protected startWith(person: ConversationPersonDto): void {
    this.openPerson.emit(person);
  }

  /** The open chat never shows unread: it is being read. */
  protected unreadOf(row: InboxChatRowDto): number {
    return row.conversationId === this.activeId() ? 0 : row.unread;
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }
}
