import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatPendingItemDto, InboxChatRowDto } from '../../models/inbox-chat.dto';
import { ConversationPersonDto } from '../../models/inbox.dto';

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

/** Favorites first (in their own order of activity), then the rest as the server sorted them. */
export function withFavoritesFirst(rows: readonly InboxChatRowDto[], favorites: ReadonlySet<string>): InboxChatRowDto[] {
  return [...rows.filter((r) => favorites.has(r.conversationId)), ...rows.filter((r) => !favorites.has(r.conversationId))];
}

/**
 * The inbox's chats in two sections, ClickUp-style: Groups (named groups and case groups) and Direct messages
 * (1-on-1 chats), each with an always-visible "+" and favorites pinned on top. A search term also finds anyone in the
 * legal entity to start a chat with. "Pending" narrows to chats with something waiting on the user (optionally of one
 * type), each with a checkbox for bulk approval.
 */
@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [AvatarComponent, DropdownMenuComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cl" data-testid="chat-list" [class.cl--roomy]="roomy()">
      @if (loading() && rows().length === 0) {
        <p class="cl__state" aria-live="polite">Loading your chats…</p>
      } @else if (error() && rows().length === 0) {
        <p class="cl__state cl__state--error" role="alert">{{ error() }}</p>
      }

      @if (filter() === 'pending' && visibleRows().length > 0) {
        <label class="cl__select-all">
          <input type="checkbox" data-testid="chat-select-all" [checked]="allSelected()" (change)="selectAll($any($event.target).checked)" />
          Select all
        </label>
      }

      <section class="cl__section" data-testid="chat-section-groups">
        <header class="cl__section-head">
          <span>Groups</span>
          <button type="button" class="cl__add" data-testid="chat-new-group" title="New group" aria-label="New group" (click)="newGroup.emit()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </header>
        <ul class="cl__rows">
          @for (row of groupRows(); track row.conversationId) {
            <ng-container [ngTemplateOutlet]="rowTpl" [ngTemplateOutletContext]="{ $implicit: row }" />
          } @empty {
            @if (!loading()) { <li class="cl__quiet">{{ search().trim() ? 'No group matches' : filter() === 'pending' ? 'Nothing waiting in groups' : 'No groups yet' }}</li> }
          }
        </ul>
      </section>

      <section class="cl__section" data-testid="chat-section-direct">
        <header class="cl__section-head">
          <span>Direct messages</span>
          <button type="button" class="cl__add" data-testid="chat-new-direct" title="New message" aria-label="New message" (click)="newDirect.emit()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </header>
        <ul class="cl__rows">
          @for (row of directRows(); track row.conversationId) {
            <ng-container [ngTemplateOutlet]="rowTpl" [ngTemplateOutletContext]="{ $implicit: row }" />
          } @empty {
            @if (!loading() && people().length === 0) {
              <li class="cl__quiet">{{ search().trim() ? 'No one matches that name' : filter() === 'pending' ? 'Nothing waiting on you' : 'No messages yet' }}</li>
            }
          }
          @if (search().trim()) {
            @for (p of people(); track p.employeeId) {
              <li class="cl__row">
                <button type="button" class="cl__open" data-testid="chat-person" [title]="'Start a chat with ' + p.name" (click)="startWith(p)">
                  <app-avatar [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="xs" />
                  <span class="cl__name">{{ p.name }}</span>
                  <span class="cl__hint">New</span>
                </button>
              </li>
            }
          }
        </ul>
      </section>
    </div>

    <ng-template #rowTpl let-row>
      <li class="cl__row" [class.cl__row--active]="row.conversationId === activeId()">
        @if (filter() === 'pending') {
          <input type="checkbox" class="cl__check" [attr.aria-label]="'Select ' + row.title" [attr.data-testid]="'chat-check-' + row.conversationId"
            [checked]="selectedIds().has(row.conversationId)" (change)="toggle(row.conversationId, $any($event.target).checked)" />
        }
        <button type="button" class="cl__open" data-testid="chat-row" [title]="row.preview ?? row.title" (click)="openRow.emit(row)">
          @if (row.type === 'direct') {
            <app-avatar [userName]="row.title" [avatarUrl]="avatarUrl(row.avatarFileId)" size="xs" />
          } @else {
            <span class="cl__group" [class.cl__group--case]="row.type === 'case'" aria-hidden="true">
              @if (row.type === 'case') {
                <svg viewBox="0 0 24 24"><path d="M9 4h6M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 12h6M9 16h4" /></svg>
              } @else {
                <svg viewBox="0 0 24 24"><path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18" /></svg>
              }
            </span>
          }
          <span class="cl__text">
            <span class="cl__name" [class.cl__name--unread]="unreadOf(row) > 0">{{ row.title }}</span>
            @if (roomy() && row.preview) { <span class="cl__preview">{{ row.preview }}</span> }
          </span>
          @if (favorites().has(row.conversationId)) {
            <svg class="cl__star" viewBox="0 0 24 24" aria-label="Favorite"><path [attr.d]="starIcon" /></svg>
          }
          @if (pendingMatching(row, kind()).length > 0) {
            <span class="cl__pending" [attr.title]="pendingMatching(row, kind()).length + ' waiting on you'">{{ pendingMatching(row, kind()).length }}</span>
          } @else if (unreadOf(row) > 0) {
            <span class="cl__unread" [attr.aria-label]="unreadOf(row) + ' unread'">{{ unreadOf(row) }}</span>
          }
        </button>
        <app-dropdown-menu class="cl__menu" [items]="menuFor(row)" ariaLabel="Chat options" (selected)="onMenu(row, $event)">
          <button menu-trigger type="button" class="cl__more" [attr.data-testid]="'chat-menu-' + row.conversationId" aria-label="Chat options">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
          </button>
        </app-dropdown-menu>
      </li>
    </ng-template>
  `,
  styles: [`
    :host { display: flex; min-height: 0; flex-direction: column; }
    .cl { display: flex; flex-direction: column; gap: 14px; }
    .cl__state { margin: 0; padding: 16px 8px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .cl__state--error { color: var(--color-danger); }
    .cl__select-all { display: flex; align-items: center; gap: 8px; padding: 0 8px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .cl__section { display: flex; flex-direction: column; gap: 2px; }
    .cl__section-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 4px 8px; color: var(--color-text-secondary);
      font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    /* The section's "+" is always shown (not only on hover). */
    .cl__add { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px;
      background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .cl__add:hover { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 6%); }
    .cl__add svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    .cl__rows { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
    .cl__quiet { padding: 4px 8px; color: var(--color-text-secondary); font-size: 12px; }
    .cl__row { position: relative; display: flex; align-items: center; gap: 2px; border-radius: 8px; }
    .cl__row:hover { background: var(--color-surface); }
    .cl__row--active, .cl__row--active:hover { background: var(--color-surface); box-shadow: 0 1px 2px rgb(0 0 0 / 5%); }
    .cl__row--active .cl__name { color: var(--color-accent); font-weight: 650; }
    .cl__check { flex: 0 0 auto; margin-left: 6px; }
    .cl__open { display: flex; min-width: 0; flex: 1; align-items: center; gap: 8px; padding: 6px 8px; border: 0; border-radius: 8px; background: none;
      color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .cl__open:focus-visible, .cl__add:focus-visible, .cl__more:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
    .cl__open app-avatar { flex: 0 0 auto; }
    .cl__group { display: inline-flex; width: 22px; height: 22px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 6px;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); }
    .cl__group--case { background: color-mix(in srgb, var(--color-warning, #d97706) 15%, var(--color-surface)); color: var(--color-warning, #b45309); }
    .cl__group svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cl__text { display: flex; min-width: 0; flex: 1; flex-direction: column; }
    .cl__name { overflow: hidden; color: var(--color-text-secondary); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .cl__name--unread { color: var(--color-text-primary); font-weight: 700; }
    .cl__preview { overflow: hidden; color: var(--color-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .cl__hint { flex: 0 0 auto; color: var(--color-accent); font-size: 11px; font-weight: 650; }
    .cl__star { width: 12px; height: 12px; flex: 0 0 auto; fill: var(--color-warning, #d97706); }
    .cl__unread, .cl__pending { min-width: 18px; flex: 0 0 auto; padding: 0 5px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
    .cl__unread { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .cl__pending { background: color-mix(in srgb, var(--color-warning, #d97706) 16%, transparent); color: var(--color-warning, #b45309); }
    /* The row's "⋯" shows on hover, over the badges. */
    .cl__menu { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); opacity: 0; pointer-events: none; }
    /* While its menu is open the holder stays shown and clickable, or clicks on the menu would fall through to the row below. */
    .cl__row:hover .cl__menu, .cl__menu:focus-within, .cl__menu:has([role="menuitem"]) { z-index: 5; opacity: 1; pointer-events: auto; }
    .cl__row:has(.cl__menu [role="menuitem"]) { background: var(--color-surface); }
    .cl__more { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px;
      background: var(--color-surface-secondary); color: var(--color-text-secondary); cursor: pointer; }
    .cl__more:hover { color: var(--color-text-primary); }
    .cl__more svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
    /* Full-width (phone) list: bigger rows with the last message. */
    .cl--roomy .cl__open { padding: 9px 8px; }
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
  /** Ticked chats (Pending only). */
  selectedIds = input<ReadonlySet<string>>(new Set());
  favorites = input<ReadonlySet<string>>(new Set());
  /** Narrows the chats by name and finds people to start a chat with. */
  search = input('');
  /** Bigger rows with the last message (the full-width phone list). */
  roomy = input(false);

  openRow = output<InboxChatRowDto>();
  /** A person from the search with no chat yet: the host opens (creates) the 1-on-1 chat. */
  openPerson = output<ConversationPersonDto>();
  newGroup = output<void>();
  newDirect = output<void>();
  selectionChange = output<ReadonlySet<string>>();
  toggleFavorite = output<string>();

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
  protected readonly groupRows = computed(() => withFavoritesFirst(this.visibleRows().filter((r) => r.type !== 'direct'), this.favorites()));
  protected readonly directRows = computed(() => withFavoritesFirst(this.visibleRows().filter((r) => r.type === 'direct'), this.favorites()));
  protected readonly allSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(r.conversationId));
  });

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

  protected startWith(person: ConversationPersonDto): void {
    this.openPerson.emit(person);
  }

  protected toggle(id: string, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectionChange.emit(next);
  }

  protected selectAll(checked: boolean): void {
    this.selectionChange.emit(checked ? new Set(this.visibleRows().map((r) => r.conversationId)) : new Set());
  }

  protected menuFor(row: InboxChatRowDto): MenuItem[] {
    return [{ id: 'favorite', label: this.favorites().has(row.conversationId) ? 'Remove from favorites' : 'Favorite', iconPath: STAR_ICON }];
  }

  protected onMenu(row: InboxChatRowDto, id: string): void {
    if (id === 'favorite') this.toggleFavorite.emit(row.conversationId);
  }

  /** The open chat never shows unread: it is being read. */
  protected unreadOf(row: InboxChatRowDto): number {
    return row.conversationId === this.activeId() ? 0 : row.unread;
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }
}
