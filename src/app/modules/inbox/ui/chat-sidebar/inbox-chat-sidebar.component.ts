import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, map } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { NavigationStateService } from '../../../../layouts/main-layout/nav/navigation-state.service';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { InboxChatRowDto, chatRef } from '../../models/inbox-chat.dto';
import { ConversationPersonDto, sameRef } from '../../models/inbox.dto';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { ChatListComponent, pendingKindKey } from '../chat-list/chat-list.component';
import { NewGroupChoice, NewGroupDialogComponent } from '../new-group-dialog/new-group-dialog.component';
import { safeServerDetail } from '../../../../core/services/error-handler.service';

/** "/inbox/:source/:kind/:id" of the open chat (or case link), else null. */
function chatOfUrl(url: string): { source: string; kind: string; id: string } | null {
  const parts = url.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return parts[0] === 'inbox' && parts.length === 4 ? { source: parts[1], kind: parts[2], id: parts[3] } : null;
}

/**
 * The inbox's chat list in the app's sub-sidebar (next to the rail, like Organization's sub-navigation): a header whose
 * "+" menu (new message / new group) plus search and collapse buttons that show on hover, All / Pending (+ type), and one
 * list of groups and direct messages, newest last message first.
 * On phones (no sub-sidebar) the inbox page shows it full width instead ("embedded").
 */
@Component({
  selector: 'app-inbox-chat-sidebar',
  standalone: true,
  imports: [ChatListComponent, DropdownMenuComponent, NewGroupDialogComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="ics" [class.ics--embedded]="embedded()" aria-label="Inbox chats" data-testid="inbox-chat-sidebar">
      <div class="ics__header">
        <h2 class="ics__heading">Inbox</h2>
        <div class="ics__tools">
          <button type="button" class="ics__tool" [class.ics__tool--on]="searchOpen()" data-testid="chat-search-toggle"
            title="Search people and chats" aria-label="Search people and chats" (click)="toggleSearch()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </button>
          @if (!embedded()) {
            <button type="button" class="ics__tool" title="Close sidebar (Ctrl+\\)" aria-label="Close sidebar" (click)="collapse()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></svg>
            </button>
          }
          <app-dropdown-menu [items]="newMenu" ariaLabel="New chat" (selected)="onNew($event)">
            <button menu-trigger type="button" class="ics__new" data-testid="chat-new" title="New chat" aria-label="New chat">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              <svg class="ics__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </app-dropdown-menu>
        </div>
      </div>

      @if (searchOpen()) {
        <label class="ics__search ui-field ui-field--sm">
          <span class="ui-field__addon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
          <input class="ui-field__control" #searchInput type="search" placeholder="Search people and chats…" aria-label="Search people and chats" data-testid="chat-search"
            [value]="search()" (input)="search.set($any($event.target).value)" (keydown.escape)="closeSearch()" />
        </label>
      }

      <div class="ics__filters">
        <div class="ics__segment" role="radiogroup" aria-label="Show">
          <button type="button" role="radio" class="ics__segment-btn" [class.ics__segment-btn--active]="store.filter() === 'all'"
            [attr.aria-checked]="store.filter() === 'all'" data-testid="chat-filter-all" (click)="store.setFilter('all')">All</button>
          <button type="button" role="radio" class="ics__segment-btn" [class.ics__segment-btn--active]="store.filter() === 'pending'"
            [attr.aria-checked]="store.filter() === 'pending'" data-testid="chat-filter-pending" (click)="store.setFilter('pending')">
            Pending @if (store.pendingCount() > 0) { <span class="ics__count">{{ store.pendingCount() }}</span> }
          </button>
        </div>
        @if (store.filter() === 'pending' && kindOptions().length > 1) {
          <app-select class="ics__kind" [options]="kindOptions()" [value]="store.kind() ?? ''" ariaLabel="Type" [searchable]="false"
            (valueChange)="store.setKind($event || null)" />
        }
      </div>

      <div class="ics__body scroll-fade">
        <app-chat-list
          [rows]="store.rows()"
          [loading]="store.loading()"
          [error]="store.error()"
          [activeId]="activeId()"
          [filter]="store.filter()"
          [kind]="store.kind()"
          [favorites]="store.favorites()"
          [search]="search()"
          [roomy]="embedded()"
          (openRow)="openRow($event)"
          (openPerson)="openPerson($event)"
        />
      </div>
    </nav>

    <app-new-group-dialog [open]="groupOpen()" [busy]="groupBusy()" [error]="groupError()"
      (created)="createGroup($event)" (closed)="groupOpen.set(false)" />
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    /* Same shell as the app's sub-sidebar, wider so each chat shows its last message and time. */
    .ics { box-sizing: border-box; display: flex; width: 21rem; height: calc(100% - .5rem); min-height: 0; flex-direction: column; gap: 10px;
      margin: 0 0 .5rem .25rem; padding: 1rem .625rem; border: 1px solid var(--color-border); border-right: none; border-radius: 0 0 0 14px;
      background: var(--color-surface-secondary); box-shadow: 0 1px 3px rgb(0 0 0 / 3%); }
    .ics--embedded { width: 100%; height: 100%; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
    .ics__header { display: flex; min-height: 24px; align-items: center; justify-content: space-between; margin: 0 .25rem 0 .5rem; }
    .ics__heading { margin: 0; color: var(--color-text-secondary); font-size: .75rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .ics__tools { display: flex; align-items: center; gap: 2px; }
    /* "+ v" (new message / new group) is always shown at the far right, like ClickUp's; search and collapse show on hover beside it. */
    .ics__new { display: inline-flex; height: 26px; align-items: center; gap: 2px; margin-left: 4px; padding: 0 6px; border: 1px solid var(--color-border);
      border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }
    .ics__new:hover { background: var(--color-surface-secondary); }
    .ics__new:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .ics__new svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .ics__new .ics__chevron { width: 12px; height: 12px; color: var(--color-text-secondary); }
    /* Search and collapse show when the sidebar is hovered (like the other sub-sidebars' collapse button). */
    .ics__tool { display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center; padding: 0; border: 1px solid transparent;
      border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; opacity: 0; pointer-events: none;
      transition: opacity 150ms ease, background-color 150ms ease, color 150ms ease; }
    .ics:hover .ics__tool, .ics__tool:focus-visible, .ics__tool--on, .ics--embedded .ics__tool { opacity: 1; pointer-events: auto; }
    .ics__tool:hover, .ics__tool--on { border-color: var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .ics__tool:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .ics__tool svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .ics__search { width: auto; margin: 0 .25rem; }
    .ics__filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0 .25rem; }
    .ics__segment { display: inline-flex; box-sizing: border-box; height: 28px; align-items: center; padding: 2px; border: 1px solid var(--color-border);
      border-radius: 8px; background: var(--color-surface); }
    .ics__segment-btn { display: inline-flex; height: 22px; align-items: center; gap: 5px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent;
      color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .ics__segment-btn--active { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .ics__segment-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .ics__count { min-width: 16px; padding: 0 4px; border-radius: 999px; background: var(--color-accent); color: var(--color-accent-contrast, #fff);
      font-size: 10px; line-height: 16px; text-align: center; }
    .ics__kind { min-width: 0; flex: 1 1 120px; }
    /* The list scrolls to the sidebar's right edge (the negative margin eats the shell's padding, which the list keeps as its own).
       "auto" turns off the standard thin scrollbar - in Chrome that one draws arrow buttons - so the global slim ::-webkit-scrollbar applies. */
    .ics__body { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow-y: auto; margin-right: -.625rem; padding-right: .5rem;
      scrollbar-width: auto; scrollbar-color: auto; }
  `]
})
export class InboxChatSidebarComponent implements OnInit {
  protected readonly store = inject(InboxChatsStore);
  private readonly kinds = inject(InboxKindsStore);
  private readonly api = inject(InboxChatsApiService);
  private readonly router = inject(Router);
  private readonly navState = inject(NavigationStateService);
  private readonly notifications = inject(NotificationService);

  /** Full width inside the inbox page (phones), instead of the app's sub-sidebar. */
  embedded = input(false);

  protected readonly searchOpen = signal(false);
  protected readonly search = signal('');
  protected readonly groupOpen = signal(false);
  protected readonly groupBusy = signal(false);
  protected readonly groupError = signal<string | null>(null);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  private readonly url = toSignal(
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url });
  /** The open chat's row: matched by the chat in the URL. */
  protected readonly activeId = computed(() => {
    const ref = chatOfUrl(this.url());
    if (!ref) return null;
    return this.store.rows().find((r) => sameRef(chatRef(r), ref))?.conversationId ?? this.store.started()?.conversationId ?? null;
  });
  protected readonly kindOptions = computed<SelectOption[]>(() => {
    const labels = new Map(this.kinds.kinds().map((k) => [`${k.source}:${k.kind}`, k.label]));
    const keys = new Set(this.store.rows().flatMap((r) => r.pending.map(pendingKindKey)));
    return [{ value: '', label: 'All types' },
      ...[...keys].map((k) => ({ value: k, label: labels.get(k) ?? k.split(':')[1].replace(/_/g, ' ') }))];
  });

  ngOnInit(): void {
    void this.kinds.ensureLoaded();
    if (!this.store.loaded()) void this.store.load();
  }

  protected toggleSearch(): void {
    if (this.searchOpen()) this.closeSearch();
    else this.openSearch();
  }

  private openSearch(): void {
    this.searchOpen.set(true);
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  protected closeSearch(): void {
    this.searchOpen.set(false);
    this.search.set('');
  }

  private readonly canDelegate = inject(PermissionService).hasPermission('leave:approve');
  /** New message / New group, then the inbox-wide History and (approvers) Delegate my approvals. */
  protected readonly newMenu: MenuItem[] = [
    { id: 'message', label: 'New message', iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { id: 'group', label: 'New group', iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' },
    { id: 'history', label: 'History', iconPath: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2', dividerBefore: true },
    ...(this.canDelegate
      ? [{ id: 'delegate', label: 'Delegate my approvals', iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 11l2 2 4-4' }]
      : [])
  ];

  /** "New message" opens the search (that is how a new 1-on-1 chat starts); "New group" opens the group dialog. */
  protected onNew(id: string): void {
    if (id === 'group') this.groupOpen.set(true);
    else if (id === 'history') this.openHistory();
    else if (id === 'delegate') this.store.setDelegateOpen(true);
    else this.openSearch();
  }

  /** History shows on the inbox page (in place of a chat). */
  private openHistory(): void {
    this.store.setHistory(true);
    if (!this.router.url.startsWith('/inbox')) void this.router.navigate(['/inbox']);
  }

  protected collapse(): void {
    this.navState.collapseSubSidebar();
  }

  protected openRow(row: InboxChatRowDto): void {
    this.store.setHistory(false);
    void this.router.navigate(['/inbox', row.source, row.kind, row.subjectId]);
  }

  protected async openPerson(person: ConversationPersonDto): Promise<void> {
    try {
      const chat = await firstValueFrom(this.api.openDirect(person.employeeId));
      this.store.setStarted({
        conversationId: chat.conversationId, source: chat.source, kind: chat.kind, subjectId: chat.subjectId, type: 'direct',
        title: person.name, otherEmployeeId: person.employeeId, avatarFileId: person.avatarFileId, memberCount: 2, preview: null,
        lastMessageAt: null, unread: 0, pending: [], caseItem: null
      });
      this.closeSearch();
      this.store.setHistory(false);
      void this.router.navigate(['/inbox', chat.source, chat.kind, chat.subjectId]);
    } catch {
      this.notifications.error(`Could not start a chat with ${person.name}.`);
    }
  }

  protected async createGroup(choice: NewGroupChoice): Promise<void> {
    this.groupBusy.set(true);
    this.groupError.set(null);
    try {
      const avatarFileId = choice.photo ? await firstValueFrom(this.api.uploadGroupPhoto(choice.photo)) : null;
      const chat = await firstValueFrom(this.api.createGroup(choice.name, choice.employeeIds, avatarFileId));
      this.groupOpen.set(false);
      await this.store.load();
      void this.router.navigate(['/inbox', chat.source, chat.kind, chat.subjectId]);
    } catch (err) {
      this.groupError.set(safeServerDetail(err) ?? 'The group could not be created.');
    } finally {
      this.groupBusy.set(false);
    }
  }
}
