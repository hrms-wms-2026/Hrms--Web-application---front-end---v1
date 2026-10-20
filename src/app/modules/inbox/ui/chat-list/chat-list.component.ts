import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxChatPendingItemDto, InboxChatRowDto } from '../../models/inbox-chat.dto';
import { ConversationPersonDto } from '../../models/inbox.dto';

export type ChatListFilter = 'all' | 'pending';

/** "source:kind" of a pending item - what the type filter matches. */
export function pendingKindKey(item: { source: string; kind: string }): string {
  return `${item.source}:${item.kind}`;
}

/** The pending items of a row that pass the type filter (all of them when no type is picked). */
export function pendingMatching(row: InboxChatRowDto, kind: string | null): InboxChatPendingItemDto[] {
  return kind ? row.pending.filter((p) => pendingKindKey(p) === kind) : row.pending;
}

/**
 * The inbox's left column: everyone the user chats with, groups, and case groups, newest first. The search finds both
 * existing chats and anyone in the legal entity to start a chat with. "Pending" narrows it to the chats with something
 * waiting on the user (optionally of one type), each with a checkbox for bulk approval.
 */
@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [AvatarComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cl" data-testid="chat-list">
      <div class="cl__tools">
        <label class="cl__search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="search" placeholder="Search people and chats…" aria-label="Search people and chats" data-testid="chat-search"
            [value]="search()" (input)="onSearch($any($event.target).value)" />
        </label>
        <button type="button" class="cl__new" data-testid="chat-new-group" title="New group" aria-label="New group" (click)="newGroup.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>
      <div class="cl__filters">
        <div class="cl__segment" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" class="cl__segment-btn" [class.cl__segment-btn--active]="filter() === 'all'"
            [attr.aria-checked]="filter() === 'all'" data-testid="chat-filter-all" (click)="filterChange.emit('all')">All</button>
          <button type="button" role="radio" class="cl__segment-btn" [class.cl__segment-btn--active]="filter() === 'pending'"
            [attr.aria-checked]="filter() === 'pending'" data-testid="chat-filter-pending" (click)="filterChange.emit('pending')">
            Pending @if (pendingCount() > 0) { <span class="cl__count">{{ pendingCount() }}</span> }
          </button>
        </div>
        @if (filter() === 'pending' && kindOptions().length > 1) {
          <app-select class="cl__kind" [options]="kindOptions()" [value]="kind() ?? ''" ariaLabel="Type" [searchable]="false"
            (valueChange)="kindChange.emit($event || null)" />
        }
      </div>

      <div class="cl__body scroll-fade">
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

        <ul class="cl__rows">
          @for (row of visibleRows(); track row.conversationId) {
            <li class="cl__row" [class.cl__row--active]="row.conversationId === activeId()">
              @if (filter() === 'pending') {
                <input type="checkbox" class="cl__check" [attr.aria-label]="'Select ' + row.title" [attr.data-testid]="'chat-check-' + row.conversationId"
                  [checked]="selectedIds().has(row.conversationId)" (change)="toggle(row.conversationId, $any($event.target).checked)" />
              }
              <button type="button" class="cl__open" data-testid="chat-row" (click)="openRow.emit(row)">
                @if (row.type === 'direct') {
                  <app-avatar [userName]="row.title" [avatarUrl]="avatarUrl(row.avatarFileId)" size="md" />
                } @else {
                  <span class="cl__group" [class.cl__group--case]="row.type === 'case'" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M16 20a4 4 0 0 0-8 0" /><circle cx="12" cy="11" r="3" /><path d="M21 19a3 3 0 0 0-4-2.8M3 19a3 3 0 0 1 4-2.8" /><circle cx="18" cy="9" r="2" /><circle cx="6" cy="9" r="2" /></svg>
                  </span>
                }
                <span class="cl__text">
                  <span class="cl__line">
                    <span class="cl__title" [class.cl__title--unread]="unreadOf(row) > 0">{{ row.title }}</span>
                    @if (row.lastMessageAt) { <time class="cl__time">{{ timeLabel(row.lastMessageAt) }}</time> }
                  </span>
                  <span class="cl__line">
                    <span class="cl__preview">{{ previewOf(row) }}</span>
                    @if (pendingMatching(row, kind()).length > 0) {
                      <span class="cl__pending" [attr.title]="pendingMatching(row, kind()).length + ' waiting on you'">{{ pendingMatching(row, kind()).length }} pending</span>
                    } @else if (unreadOf(row) > 0) {
                      <span class="cl__unread" [attr.aria-label]="unreadOf(row) + ' unread'">{{ unreadOf(row) }}</span>
                    }
                  </span>
                </span>
              </button>
            </li>
          }
        </ul>

        @if (search().trim() && people().length > 0) {
          <p class="cl__section">People</p>
          <ul class="cl__rows">
            @for (p of people(); track p.employeeId) {
              <li class="cl__row">
                <button type="button" class="cl__open" data-testid="chat-person" (click)="startWith(p)">
                  <app-avatar [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="md" />
                  <span class="cl__text"><span class="cl__title">{{ p.name }}</span><span class="cl__preview">Start a chat</span></span>
                </button>
              </li>
            }
          </ul>
        }

        @if (!loading() && visibleRows().length === 0 && !(search().trim() && people().length > 0)) {
          <p class="cl__state" data-testid="chat-empty">{{ emptyText() }}</p>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; min-height: 0; flex: 1; flex-direction: column; }
    .cl { display: flex; min-height: 0; flex: 1; flex-direction: column; }
    .cl__tools { display: flex; align-items: center; gap: 8px; padding: 12px 12px 6px; }
    .cl__search { display: flex; min-width: 0; flex: 1; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); }
    .cl__search:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .cl__search svg { width: 15px; height: 15px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; }
    .cl__search input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .cl__new { display: inline-flex; width: 34px; height: 34px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; }
    .cl__new:hover { border-color: var(--color-accent); color: var(--color-accent); }
    .cl__new svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    .cl__new:focus-visible, .cl__open:focus-visible, .cl__segment-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .cl__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 4px 12px 8px; }
    .cl__segment { display: inline-flex; box-sizing: border-box; height: 30px; align-items: center; padding: 2px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-secondary); }
    .cl__segment-btn { display: inline-flex; height: 24px; align-items: center; gap: 6px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .cl__segment-btn--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
    .cl__count { min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--color-accent); color: var(--color-accent-contrast, #fff); font-size: 11px; line-height: 18px; text-align: center; }
    .cl__kind { min-width: 160px; flex: 1; }
    .cl__body { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow-y: auto; padding: 0 6px 16px; }
    .cl__state { margin: 0; padding: 24px 10px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .cl__state--error { color: var(--color-danger); }
    .cl__select-all { display: flex; align-items: center; gap: 8px; padding: 4px 10px 8px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .cl__section { margin: 12px 10px 4px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .cl__rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .cl__row { display: flex; align-items: center; gap: 4px; border-radius: 10px; }
    .cl__row:hover { background: var(--color-surface-secondary); }
    .cl__row--active, .cl__row--active:hover { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
    .cl__check { flex: 0 0 auto; margin-left: 8px; }
    .cl__open { display: flex; min-width: 0; flex: 1; align-items: center; gap: 10px; padding: 9px 10px; border: 0; border-radius: 10px; background: none; color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .cl__open app-avatar { flex: 0 0 auto; }
    .cl__group { display: inline-flex; width: 40px; height: 40px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent); }
    .cl__group--case { background: color-mix(in srgb, var(--color-warning, #d97706) 14%, var(--color-surface)); color: var(--color-warning, #d97706); }
    .cl__group svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .cl__text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .cl__line { display: flex; min-width: 0; align-items: center; gap: 8px; }
    .cl__title { min-width: 0; flex: 1; overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .cl__title--unread { font-weight: 750; }
    .cl__time { flex: 0 0 auto; color: var(--color-text-secondary); font-size: 11px; }
    .cl__preview { min-width: 0; flex: 1; overflow: hidden; color: var(--color-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .cl__unread { min-width: 18px; flex: 0 0 auto; padding: 0 5px; border-radius: 999px; background: var(--color-accent); color: var(--color-accent-contrast, #fff); font-size: 11px; font-weight: 700; line-height: 18px; text-align: center; }
    .cl__pending { flex: 0 0 auto; padding: 1px 8px; border-radius: 999px; background: color-mix(in srgb, var(--color-warning, #d97706) 14%, transparent); color: var(--color-warning, #b45309); font-size: 11px; font-weight: 700; white-space: nowrap; }
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
  /** Labels for the type filter, by "source:kind". */
  kindLabels = input<ReadonlyMap<string, string>>(new Map());
  /** Ticked chats (Pending only). */
  selectedIds = input<ReadonlySet<string>>(new Set());

  openRow = output<InboxChatRowDto>();
  /** A person from the search with no chat yet: the host opens (creates) the 1-on-1 chat. */
  openPerson = output<ConversationPersonDto>();
  newGroup = output<void>();
  filterChange = output<ChatListFilter>();
  kindChange = output<string | null>();
  selectionChange = output<ReadonlySet<string>>();

  protected readonly search = signal('');
  protected readonly people = signal<ConversationPersonDto[]>([]);
  private readonly searches = new Subject<string>();
  protected readonly pendingMatching = pendingMatching;

  protected readonly pendingCount = computed(() => this.rows().reduce((n, r) => n + r.pending.length, 0));
  protected readonly kindOptions = computed<SelectOption[]>(() => {
    const keys = new Set(this.rows().flatMap((r) => r.pending.map(pendingKindKey)));
    return [{ value: '', label: 'All types' },
      ...[...keys].map((k) => ({ value: k, label: this.kindLabels().get(k) ?? k.split(':')[1].replace(/_/g, ' ') }))];
  });
  protected readonly visibleRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    let rows = this.rows();
    if (this.filter() === 'pending') rows = rows.filter((r) => pendingMatching(r, this.kind()).length > 0);
    return term ? rows.filter((r) => r.title.toLowerCase().includes(term)) : rows;
  });
  protected readonly allSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((r) => this.selectedIds().has(r.conversationId));
  });
  protected readonly emptyText = computed(() => {
    if (this.search().trim()) return 'No one matches that name.';
    return this.filter() === 'pending' ? 'Nothing is waiting on you.' : 'No chats yet. Search for someone to start one.';
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
  }

  protected onSearch(text: string): void {
    this.search.set(text);
    this.searches.next(text);
  }

  protected startWith(person: ConversationPersonDto): void {
    this.onSearch('');
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

  /** The open chat never shows unread: it is being read. */
  protected unreadOf(row: InboxChatRowDto): number {
    return row.conversationId === this.activeId() ? 0 : row.unread;
  }

  protected previewOf(row: InboxChatRowDto): string {
    return row.preview ?? (row.type === 'direct' ? 'Say hello' : '');
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Today: the time; this week: the weekday; older: the date. */
  protected timeLabel(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (now.getTime() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString(undefined, { weekday: 'short' });
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
