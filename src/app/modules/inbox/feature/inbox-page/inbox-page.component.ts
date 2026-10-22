import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ExceptionEvidenceResponse } from '../../../../shared/models/exception-evidence.model';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { InboxChatsApiService } from '../../data-access/inbox-chats-api.service';
import { InboxChatRowDto, chatRef, isPeopleChatSource } from '../../models/inbox-chat.dto';
import { InboxHistoryEntryDto, InboxItemDetailDto, InboxItemRef, InboxTargetDto, sameRef } from '../../models/inbox.dto';
import { parseExtra } from '../../renderers/inbox-detail-renderers';
import { ConversationStore } from '../../state/conversation.store';
import { InboxChatsStore } from '../../state/inbox-chats.store';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { InboxPersonCasesStore } from '../../state/inbox-person-cases.store';
import { InboxStore } from '../../state/inbox.store';
import { ApprovalDelegateModalComponent } from '../../ui/approval-delegate-modal/approval-delegate-modal.component';
import { CaseCardAction } from '../../ui/case-card/case-card.component';
import { InboxChatSidebarComponent } from '../../ui/chat-sidebar/inbox-chat-sidebar.component';
import { ConversationPanelComponent } from '../../ui/conversation-panel/conversation-panel.component';
import { InboxCardAction, InboxItemCardComponent } from '../../ui/inbox-item-card/inbox-item-card.component';
import { NewGroupChoice, NewGroupDialogComponent } from '../../ui/new-group-dialog/new-group-dialog.component';
import { ForwardDialogComponent, ForwardTargets } from '../../ui/forward-dialog/forward-dialog.component';
import { PersonCasesViewComponent } from '../../ui/person-cases/person-cases-view.component';
import { inboxTitle, isCaseClosed } from '../../utils/inbox-item.util';

/** Whether the details panel is collapsed - a per-viewer preference. */
const DETAILS_HIDDEN_KEY = 'inbox.detailsHidden';
const NARROW_QUERY = '(max-width: 1023px)';
const LEAVE_APPROVE = 'leave:approve';

function readDetailsHidden(): boolean {
  try {
    return localStorage.getItem(DETAILS_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** "source:kind:id" of the ?case= query parameter. */
function parseCaseParam(value: string | null): InboxItemRef | null {
  const parts = value?.split(':') ?? [];
  return parts.length === 3 && parts.every(Boolean) ? { source: parts[0], kind: parts[1], id: parts[2] } : null;
}

function caseParam(ref: InboxItemRef): string {
  return `${ref.source}:${ref.kind}:${ref.id}`;
}

/** The open case's face evidence, or null - only that case's own detail counts (never the previous one's). */
export function faceEvidenceFor(
  detail: InboxItemDetailDto | null, selected: InboxItemRef | null, rendererOf: (source: string, kind: string) => string | null
): ExceptionEvidenceResponse | null {
  if (!detail || !selected || !sameRef(detail.item, selected)) return null;
  if (rendererOf(detail.item.source, detail.item.kind) !== 'exception-evidence') return null;
  return parseExtra(detail.extraJson) as ExceptionEvidenceResponse | null;
}

/**
 * The Inbox as chats between people. Left: everyone the user chats with, groups and case groups (search starts a chat
 * with anyone in the legal entity; Pending narrows to what waits on the user). Middle: the open chat,
 * where requests and alerts arrive as case cards and are decided. Right: the other person's cases this month, or the
 * details of the case that was clicked.
 *
 * URLs: /inbox/direct/direct/:pairId and /inbox/group/group/:id open a chat; /inbox/:source/:kind/:id of a request or
 * alert (bell, links) opens the chat it is worked on in, with that case selected (?case=).
 */
@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [
    DatePipe, BreadcrumbHeaderComponent, DropdownMenuComponent, ApprovalDelegateModalComponent,
    InboxChatSidebarComponent, ConversationPanelComponent, InboxItemCardComponent,
    NewGroupDialogComponent, PersonCasesViewComponent, ForwardDialogComponent, TabsComponent
  ],
  // The open chat: shared by the conversation panel and the details. The open person's history: the details panel.
  providers: [ConversationStore, InboxPersonCasesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inbox">
      <header class="work-page-header inbox__page-header">
        <div class="inbox__header-row">
          <app-breadcrumb-header parentLabel="Inbox" [middleLabel]="crumbChat() ? 'Chats' : undefined"
            [currentLabel]="history() ? 'History' : (crumbChat() ?? 'Chats')" icon="inbox" />
          <!-- The open chat's tools (wide screens - phones keep them in the chat's own header), then History and
               delegation under the same "⋯". -->
          <div class="inbox__header-tools">
            @if (chatTools(); as panel) {
              @if (!panel.isDirect()) {
                <button type="button" class="inbox__icon-btn" data-testid="inbox-chat-add" aria-label="Add people" title="Add people"
                  [disabled]="conversation.removed()" (click)="panel.onSlashCommand('add')">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 20a6 6 0 0 0-12 0" /><circle cx="9" cy="8" r="4" /><path d="M19 8v6M16 11h6" /></svg>
                </button>
              }
            }
            <app-dropdown-menu [items]="headerMenu()" ariaLabel="Inbox options" (selected)="onHeaderMenu($event)">
              <button menu-trigger type="button" class="inbox__icon-btn" data-testid="inbox-menu" aria-label="Inbox options" title="More">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
              </button>
            </app-dropdown-menu>
            @if (chatTools()) {
              <button type="button" class="inbox__icon-btn" data-testid="inbox-toggle-details" [attr.aria-pressed]="detailsShown()"
                [attr.aria-label]="detailsShown() ? 'Hide details' : 'Show details'" [attr.title]="detailsShown() ? 'Hide details' : 'Show details'"
                (click)="toggleDetails()">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
              </button>
            }
          </div>
        </div>
      </header>

      <div class="inbox__workspace" data-testid="inbox-workspace"
        [class.inbox__workspace--open]="chatRefValue() !== null || history()"
        [class.inbox__workspace--details]="detailsShown()"
        [class.inbox__workspace--drawer]="narrow() && detailsShown()">
        <!-- The chat list lives in the app's sub-sidebar; phones have none, so it shows here until a chat opens. -->
        @if (narrow() && chatRefValue() === null && !history()) {
          <section class="inbox__panel inbox__list" aria-label="Chats">
            <app-inbox-chat-sidebar [embedded]="true" />
          </section>
        }

        <section class="inbox__panel inbox__chat" aria-label="Conversation">
          @if (history()) {
            <div class="inbox__history-body scroll-fade">
              @if (store.historyLoading() && store.history().length === 0) {
                <p class="inbox__state" aria-live="polite">Loading your history…</p>
              } @else if (store.historyError()) {
                <div class="inbox__state inbox__state--error" role="alert">
                  <span>{{ store.historyError() }}</span>
                  <button type="button" (click)="store.loadHistory()">Try again</button>
                </div>
              } @else if (store.history().length === 0) {
                <p class="inbox__state">Decisions you take show up here.</p>
              } @else {
                <ul class="inbox__history" data-testid="inbox-history">
                  @for (entry of store.history(); track entry.journalId) {
                    <li class="inbox__history-row" data-testid="inbox-history-row">
                      <button type="button" class="inbox__history-main" [disabled]="!entry.item" (click)="openItem({ source: entry.source, kind: entry.kind, id: entry.itemId })">
                        <span class="inbox__history-title">{{ entry.title }}</span>
                        <span class="inbox__secondary">Decided {{ entry.actionLabel }} · {{ entry.decidedAt | date: 'MMM d, y h:mm a' }}</span>
                        @if (entry.comment) { <span class="inbox__secondary">“{{ entry.comment }}”</span> }
                      </button>
                      @if (entry.isReverted) {
                        <span class="inbox__pill">Undone</span>
                      } @else if (canUndo(entry)) {
                        <button type="button" class="inbox__chip" data-testid="inbox-history-revert" [disabled]="store.busy()"
                          (click)="undoFromHistory(entry)">Undo · until {{ entry.revertableUntil | date: 'h:mm a' }}</button>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          } @else if (chatRefValue(); as ref) {
            <app-conversation-panel
              #panel
              [itemRef]="ref"
              [chat]="activeRow()"
              [detailsVisible]="detailsShown()"
              [selectedCase]="selectedCase()"
              [caseEditable]="card()?.canEdit() ?? false"
              [caseErrors]="card()?.editErrors() ?? {}"
              [caseBusy]="store.busy()"
              [caseVersion]="caseVersion()"
              (openCase)="selectCase($event)"
              (caseAction)="onCaseAction($event)"
              (caseEdits)="card()?.setEdits($event)"
              [groupedCases]="caseGroupKeys()"
              (startCaseGroup)="openNewGroup($event)"
              (forwardCase)="forwarding.set({ type: 'case', ...$event })"
              (forwardMessage)="forwarding.set({ type: 'message', messageId: $event.messageId, title: $event.preview })"
              (openChat)="openChat($event)"
              (renamed)="chats.load()"
              (toggleDetails)="toggleDetails()"
              (back)="closeChat()"
            />
          } @else {
            <div class="inbox__chat-empty" data-testid="inbox-chat-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" /></svg>
              @if (resolveError()) {
                <p class="inbox__chat-empty-title">{{ resolveError() }}</p>
              } @else {
                <p class="inbox__chat-empty-title">Select a chat</p>
                <p>Requests and alerts arrive in the chat with the person they are about.</p>
              }
            </div>
          }
        </section>

        @if (chatRefValue() !== null) {
          <div class="inbox__scrim" aria-hidden="true" (click)="toggleDetails()"></div>
          <aside class="inbox__panel inbox__details" aria-label="Details">
            @if (activeRow()?.type === 'direct') {
              <div class="inbox__detail-tabs">
                <app-tabs class="inbox__detail-tablist" data-testid="inbox-detail-tabs" ariaLabel="Details view"
                  [tabs]="detailTabs()" [value]="detailTab()" (valueChange)="setDetailTab($event)" />
                @if (caseGroupAction(); as label) {
                  @if (detailTab() === 'ticket') {
                    <button type="button" class="inbox__chip" [attr.data-testid]="selectedCaseGroup() ? 'inbox-open-case-group' : 'inbox-start-case-group'"
                      (click)="openNewGroup(selectedCase())">{{ label }}</button>
                  }
                }
              </div>
            }
            @if (selectedCase() && (activeRow()?.type !== 'direct' || detailTab() === 'ticket')) {
              <app-inbox-item-card
                #card
                [detail]="store.detail()"
                [loading]="store.detailLoading()"
                [error]="store.detailError()"
                [busy]="store.busy()"
                [actionError]="store.actionError()"
                [actionErrorInline]="store.actionErrorInline()"
                [descriptor]="store.detail() ? kinds.descriptor(store.detail()!.item.source, store.detail()!.item.kind) : null"
                [showHeading]="activeRow()?.type !== 'direct'"
                (action)="onCardAction($event)"
                (openTarget)="openTarget($event)"
              >
                <!-- One block around one element: only then does it land in the card's header slot. -->
                @if (activeRow()?.type === 'group' && caseGroupAction()) {
                  <button cardHeaderAction type="button" class="inbox__chip"
                    [attr.data-testid]="selectedCaseGroup() ? 'inbox-open-case-group' : 'inbox-start-case-group'"
                    (click)="openNewGroup(selectedCase())">{{ caseGroupAction() }}</button>
                }
              </app-inbox-item-card>
            } @else if (activeRow()?.type === 'direct') {
              @if (detailTab() === 'month') {
                <app-person-cases-view [avatarFileId]="activeRow()!.avatarFileId" (open)="selectCase($event)" />
              } @else {
                <p class="inbox__detail-empty" data-testid="inbox-detail-empty">Pick a case in the chat or from the month to see its details.</p>
              }
            } @else {
              <section class="inbox__members" data-testid="inbox-members">
                <h3>Members · {{ conversation.participants().length }}</h3>
                <ul>
                  @for (p of conversation.participants(); track p.employeeId) {
                    <li>{{ p.employeeId === myEmployeeId() ? 'You' : p.name }}
                      @if (p.joinReason === 'viewer') { <span class="inbox__secondary">· escalation</span> }
                    </li>
                  }
                </ul>
              </section>
            }
          </aside>
        }
      </div>
    </div>

    <!-- Overlays sit outside the flex column so they add no gap below the workspace. -->
    <app-new-group-dialog
      [open]="groupDialog() !== null"
      [caseTitle]="groupDialog()?.caseTitle ?? null"
      [initialPeople]="groupDialog()?.people ?? []"
      [busy]="groupBusy()"
      [error]="groupError()"
      (created)="createGroup($event)"
      (closed)="groupDialog.set(null)"
    />
    <app-forward-dialog
      [open]="forwarding() !== null"
      [caseTitle]="forwarding()?.title ?? ''"
      [fromConversationId]="activeRow()?.conversationId ?? null"
      [busy]="forwardBusy()"
      [error]="forwardError()"
      (send)="forward($event)"
      (closed)="forwarding.set(null)"
    />
    <app-approval-delegate-modal [open]="delegateOpen()" (closed)="delegateOpen.set(false)" />
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .inbox { display: flex; height: 100%; min-height: 0; flex-direction: column; }
    /* Same sticky header as Work (global .work-page-header). */
    .inbox__page-header { margin-bottom: 0 !important; }
    .inbox__header-row { display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 36px; }
    .inbox__header-row app-breadcrumb-header { display: inline-flex; min-width: 0; flex-shrink: 1; align-items: center; overflow: hidden; }
    .inbox__header-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .inbox__icon-btn { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 8px;
      background: none; color: var(--color-text-secondary); cursor: pointer; }
    .inbox__icon-btn:hover:not(:disabled), .inbox__icon-btn[aria-pressed="true"] { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); color: var(--color-text-primary); }
    .inbox__icon-btn:disabled { opacity: .45; cursor: default; }
    .inbox__icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    /* The tabs and the group button share one row; the row draws the line under both. */
    .inbox__detail-tabs { display: flex; align-items: flex-end; gap: 8px; margin: 8px 12px 0; border-bottom: 1px solid var(--color-border); }
    .inbox__detail-tabs > .inbox__chip { margin-bottom: 5px; }
    .inbox__detail-tablist { flex: 1; min-width: 0; }
    .inbox__detail-tablist ::ng-deep [role='tablist'] { border-bottom: 0; }
    .inbox__detail-empty { margin: 0; padding: 24px 16px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .inbox__icon-btn:focus-visible, .inbox__chip:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

    /* One surface split by lines, not three separate cards: chats | conversation | details. */
    .inbox__workspace { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(0, 1fr); background: var(--color-surface); }
    .inbox__workspace--details { grid-template-columns: minmax(360px, 62fr) minmax(320px, 38fr); }
    /* Wide screens: the workspace runs to the page's right and bottom edges, so the details panel is a full-height
       column under the header line (the chat keeps the page's left gutter). */
    @media (min-width: 1024px) {
      .inbox__workspace { margin: 0 -2rem -1.75rem 0; }
      .inbox__chat { padding-bottom: 12px; }
    }
    .inbox__list { border-right: 0; }
    .inbox__panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: var(--color-surface); }
    .inbox__details { border-left: 1px solid var(--color-border); }
    .inbox__details { display: none; }
    .inbox__workspace--details .inbox__details { display: flex; }
    .inbox__scrim { display: none; }
    .inbox__members { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
    .inbox__members h3 { margin: 0; font-size: 13px; font-weight: 650; }
    .inbox__members ul { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13px; }

    .inbox__state { display: flex; align-items: center; gap: 8px; margin: 0; padding: 24px 8px; color: var(--color-text-secondary); font-size: 13px; }
    .inbox__state--error { color: var(--color-danger); }
    .inbox__state button { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
    .inbox__secondary { color: var(--color-text-secondary); font-size: 12px; }
    .inbox__pill { padding: 3px 10px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .inbox__chip { flex: 0 0 auto; padding: 4px 10px; border: 1px solid var(--color-accent); border-radius: 999px; background: var(--color-surface); color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .inbox__chip:disabled { opacity: .55; cursor: default; }
    .inbox__history-body { display: flex; min-height: 0; flex: 1; flex-direction: column; overflow-y: auto; padding: 12px; }
    .inbox__history { display: flex; flex-direction: column; margin: 0; padding: 0; border: 1px solid var(--color-border); border-radius: 12px; list-style: none; }
    .inbox__history-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--color-border); }
    .inbox__history-row:last-child { border-bottom: 0; }
    .inbox__history-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; padding: 0; border: 0; background: none; color: var(--color-text-primary); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .inbox__history-main:disabled { cursor: default; }
    .inbox__history-title { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }

    .inbox__chat-empty { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 24px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .inbox__chat-empty svg { width: 36px; height: 36px; margin-bottom: 6px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .inbox__chat-empty p { margin: 0; }
    .inbox__chat-empty-title { color: var(--color-text-primary); font-size: 14px; font-weight: 650; }

    /* Narrow screens, messenger-style: the list, then the chat (with a back button), then the details as a drawer. */
    @media (max-width: 1023px) {
      .inbox__workspace, .inbox__workspace--details { grid-template-columns: minmax(0, 1fr); }
      .inbox__chat { display: none; }
      .inbox__workspace--open .inbox__chat { display: flex; }
      .inbox__workspace--details .inbox__details { display: none; }
      .inbox__workspace--drawer .inbox__scrim { position: fixed; inset: 0; z-index: 1000; display: block; background: color-mix(in srgb, var(--color-text-primary) 35%, transparent); }
      .inbox__workspace--drawer .inbox__details { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1001; display: flex; width: min(420px, 100vw); border-radius: 0; }
    }
  `]
})
export class InboxPageComponent implements OnInit {
  protected readonly store = inject(InboxStore);
  protected readonly chats = inject(InboxChatsStore);
  protected readonly conversation = inject(ConversationStore);
  protected readonly kinds = inject(InboxKindsStore);
  private readonly personCases = inject(InboxPersonCasesStore);
  private readonly chatsApi = inject(InboxChatsApiService);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly card = viewChild<InboxItemCardComponent>('card');
  private readonly panel = viewChild<ConversationPanelComponent>('panel');

  protected readonly canDelegate = inject(PermissionService).hasPermission(LEAVE_APPROVE);
  protected readonly chatRef = chatRef;

  /** The open chat's subject (from the URL). */
  protected readonly chatRefValue = signal<InboxItemRef | null>(null);
  /** The case shown in the details panel (?case=, or a case group's own case). */
  protected readonly selectedCase = signal<InboxItemRef | null>(null);
  /** A link to a case the user has no chat for. */
  protected readonly resolveError = signal<string | null>(null);
  /** A 1-on-1 chat just started from the search: shown in the header until the list has it. */
  protected readonly history = signal(false);
  protected readonly caseVersion = signal(0);
  protected readonly delegateOpen = signal(false);
  protected readonly groupDialog = signal<{ caseRef: InboxItemRef | null; caseTitle: string | null; people: PeoplePickerOption[] } | null>(null);
  protected readonly groupBusy = signal(false);
  protected readonly groupError = signal<string | null>(null);
  /** The case card or chat message being forwarded (the picker is open). */
  protected readonly forwarding = signal<
    ({ type: 'case'; title: string } & InboxItemRef) | { type: 'message'; messageId: string; title: string } | null>(null);
  protected readonly forwardBusy = signal(false);
  protected readonly forwardError = signal<string | null>(null);

  private readonly media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null;
  /** Below 1024px the workspace is one screen at a time (list, chat, details drawer). */
  protected readonly narrow = signal(this.media?.matches ?? false);
  protected readonly detailsHidden = signal(readDetailsHidden());
  protected readonly drawerOpen = signal(false);
  protected readonly detailsShown = computed(() =>
    this.chatRefValue() !== null && (this.narrow() ? this.drawerOpen() : !this.detailsHidden()));
  protected readonly myEmployeeId = computed(() => this.auth.employeeId() ?? null);

  /** The open chat's row in the list (or the chat just started from the search). */
  protected readonly activeRow = computed<InboxChatRowDto | null>(() => {
    const ref = this.chatRefValue();
    if (!ref) return null;
    return this.chats.rows().find((r) => sameRef(chatRef(r), ref))
      ?? (this.chats.started() && sameRef(chatRef(this.chats.started()!), ref) ? this.chats.started() : null);
  });
  /** A 1-on-1 chat's details panel: the open ticket, or the person's month of requests and alerts. */
  protected readonly detailTab = signal<'ticket' | 'month'>('month');
  /** The month tab is named after the month it shows ("October 2026"). */
  protected readonly detailTabs = computed<TabOption[]>(() => {
    const year = this.personCases.year();
    const month = this.personCases.month();
    const label = year && month
      ? new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
      : 'This month';
    return [{ value: 'ticket', label: 'Ticket details' }, { value: 'month', label }];
  });
  /** Opening a case shows its ticket; with none open the panel shows the month. */
  private readonly syncDetailTab = effect(() => {
    const open = this.selectedCase() !== null;
    untracked(() => this.detailTab.set(open ? 'ticket' : 'month'));
  });
  /** The details' group button: "Open group" when the case has one; "Start a group" only while it is still open. */
  protected readonly caseGroupAction = computed<string | null>(() => {
    const ref = this.selectedCase();
    if (!ref) return null;
    if (this.selectedCaseGroup()) return 'Open group';
    const detail = this.store.detail();
    return detail && sameRef(detail.item, ref) && isCaseClosed(detail.item.status) ? null : 'Start a group';
  });
  /** The case groups in the viewer's chat list, by case. */
  protected readonly caseGroupKeys = computed<ReadonlySet<string>>(() => new Set(this.chats.rows()
    .filter((r) => r.type === 'case' && r.caseItem)
    .map((r) => `${r.caseItem!.source}:${r.caseItem!.kind}:${r.caseItem!.id}`)));
  /** The open case's group when one exists: "Open group" instead of starting another. */
  protected readonly selectedCaseGroup = computed<InboxChatRowDto | null>(() => {
    const ref = this.selectedCase();
    return ref ? this.chats.rows().find((r) => r.type === 'case' && !!r.caseItem && sameRef(r.caseItem, ref)) ?? null : null;
  });
  /** The open chat's name, as the breadcrumb's last level. */
  protected readonly crumbChat = computed(() =>
    this.history() || this.chatRefValue() === null ? null : this.activeRow()?.title ?? (this.conversation.title() || null));
  /** The open chat, whose tools sit in the header row on wide screens (phones show them in the chat's own header). */
  protected readonly chatTools = computed(() => (this.history() || this.narrow() ? null : this.panel() ?? null));
  protected readonly headerMenu = computed<MenuItem[]>(() => {
    const chatItems = this.chatTools()?.menuItems() ?? [];
    const items: MenuItem[] = [...chatItems, { id: 'history', label: this.history() ? 'Back to chats' : 'History', dividerBefore: chatItems.length > 0 }];
    if (this.canDelegate) items.push({ id: 'delegate', label: 'Delegate my approvals' });
    return items;
  });
  /** The details panel's person: the other person of a 1-on-1 chat. */
  private readonly loadPerson = effect(() => {
    const row = this.activeRow();
    const person = row?.type === 'direct' ? row.otherEmployeeId : null;
    const name = row?.title ?? '';
    untracked(() => {
      if (person !== this.personCases.personId()) void this.personCases.load(person, name, this.auth.employeeId() ?? null);
    });
  });

  /** A case group's details show its case. */
  private readonly caseGroupCase = effect(() => {
    const row = this.activeRow();
    if (row?.type === 'case' && row.caseItem && !this.selectedCase())
      untracked(() => this.selectCase({ source: row.caseItem!.source, kind: row.caseItem!.kind, id: row.caseItem!.id }));
  });

  /** The open chat was read: its badge clears without waiting for a reload. */
  private readonly markRead = effect(() => {
    const id = this.conversation.conversationId();
    if (id && !this.conversation.loading()) untracked(() => this.chats.markRead(id));
  });

  ngOnInit(): void {
    void this.kinds.ensureLoaded();
    void this.store.loadCounts();
    if (!this.chats.loaded()) void this.chats.load();
    const onMedia = (event: MediaQueryListEvent) => this.narrow.set(event.matches);
    this.media?.addEventListener?.('change', onMedia);
    this.destroyRef.onDestroy(() => this.media?.removeEventListener?.('change', onMedia));

    // The URL is the source of truth for the open chat and case, so back/forward and deep links work.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const source = params.get('source');
      const kind = params.get('kind');
      const id = params.get('id');
      void this.follow(source && kind && id ? { source, kind, id } : null);
    });
    this.route.queryParamMap?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((map) => {
      const ref = parseCaseParam(map.get('case'));
      if (ref ? !sameRef(ref, this.selectedCase()) : this.selectedCase() !== null && this.activeRow()?.type !== 'case')
        void this.showCase(ref);
    });
  }

  /** A chat's URL opens it; a request's or alert's URL finds the chat it is worked on in. */
  private async follow(ref: InboxItemRef | null): Promise<void> {
    this.resolveError.set(null);
    if (!ref) {
      this.chatRefValue.set(null);
      void this.showCase(null);
      return;
    }
    if (isPeopleChatSource(ref.source)) {
      if (!sameRef(ref, this.chatRefValue())) {
        this.chatRefValue.set(ref);
        if (!parseCaseParam(this.route.snapshot?.queryParamMap.get('case') ?? null)) void this.showCase(null);
      }
      return;
    }
    // A case group is addressed by its case; any other case link is resolved to the chat that carries its card.
    try {
      const row = await firstValueFrom(this.chatsApi.forItem(ref));
      if (row.type === 'case') {
        this.chatRefValue.set(chatRef(row));
        void this.showCase(ref);
      } else {
        void this.router.navigate(['/inbox', row.source, row.kind, row.subjectId], { queryParams: { case: caseParam(ref) }, replaceUrl: true });
      }
    } catch {
      this.chatRefValue.set(null);
      this.resolveError.set('This request or alert is not in any of your chats.');
    }
  }

  private async showCase(ref: InboxItemRef | null): Promise<void> {
    this.selectedCase.set(ref);
    await this.store.select(ref);
  }

  protected openChat(ref: InboxItemRef): void {
    this.drawerOpen.set(false);
    void this.router.navigate(['/inbox', ref.source, ref.kind, ref.id]);
  }

  /** History and links: open the chat that carries the item. */
  protected openItem(ref: InboxItemRef): void {
    this.history.set(false);
    void this.router.navigate(['/inbox', ref.source, ref.kind, ref.id]);
  }

  protected closeChat(): void {
    this.drawerOpen.set(false);
    void this.router.navigate(['/inbox']);
  }

  /** A case card or a row of the person's month was clicked: its details open on the right. */
  protected selectCase(ref: InboxItemRef | null): void {
    // The same case again (e.g. from the month tab) still has to bring its details forward.
    if (ref) this.detailTab.set('ticket');
    if (ref && this.narrow()) this.drawerOpen.set(true);
    if (ref && !this.narrow() && this.detailsHidden()) this.setDetailsHidden(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { case: ref ? caseParam(ref) : null }, queryParamsHandling: 'merge' });
  }

  protected setDetailTab(tab: string): void {
    this.detailTab.set(tab === 'ticket' ? 'ticket' : 'month');
  }

  /** "New group", or - with a case - the case's own group (from a 1-on-1 chat's "Add people" or the details). */
  protected openNewGroup(caseRef: InboxItemRef | null): void {
    // The case already has its group: open it rather than starting another.
    const existing = caseRef ? this.chats.rows().find((r) => r.type === 'case' && !!r.caseItem && sameRef(r.caseItem, caseRef)) : null;
    if (existing) {
      this.openChat(chatRef(existing));
      return;
    }
    const row = this.activeRow();
    const detail = this.store.detail();
    const caseTitle = caseRef ? (detail && sameRef(detail.item, caseRef) ? inboxTitle(detail.item) : 'This case') : null;
    // From a 1-on-1 chat, a plain group starts with its other person already picked.
    const people = !caseRef && row?.type === 'direct' && row.otherEmployeeId ? [{ id: row.otherEmployeeId, name: row.title }] : [];
    this.groupError.set(null);
    this.groupDialog.set({ caseRef, caseTitle, people });
  }

  protected async createGroup(choice: NewGroupChoice): Promise<void> {
    const dialog = this.groupDialog();
    if (!dialog) return;
    this.groupBusy.set(true);
    this.groupError.set(null);
    try {
      const chat = dialog.caseRef
        ? await firstValueFrom(this.chatsApi.startCaseGroup(dialog.caseRef, choice.employeeIds))
        : await firstValueFrom(this.chatsApi.createGroup(choice.name, choice.employeeIds));
      this.groupDialog.set(null);
      await this.chats.load();
      this.openChat(chatRef(chat));
    } catch (err) {
      this.groupError.set((err as { error?: { detail?: string } })?.error?.detail ?? 'The group could not be created.');
    } finally {
      this.groupBusy.set(false);
    }
  }

  /** WhatsApp-style forward: a copy of the case card or message goes into each picked chat. */
  protected async forward(targets: ForwardTargets): Promise<void> {
    const what = this.forwarding();
    if (!what) return;
    this.forwardBusy.set(true);
    this.forwardError.set(null);
    try {
      // People with no chat yet: their 1-on-1 chat is started first (the same as starting one from the search).
      const started = await Promise.all(targets.employeeIds.map((id) => firstValueFrom(this.chatsApi.openDirect(id))));
      const conversationIds = [...targets.conversationIds, ...started.map((c) => c.conversationId)];
      const count = await firstValueFrom(what.type === 'case'
        ? this.chatsApi.forward({ source: what.source, kind: what.kind, id: what.id }, conversationIds)
        : this.chatsApi.forwardMessage(what.messageId, conversationIds));
      this.forwarding.set(null);
      this.notifications.success(count === 1 ? 'Forwarded' : `Forwarded to ${count} chats`);
      void this.chats.load();
    } catch (err) {
      this.forwardError.set((err as { error?: { detail?: string } })?.error?.detail ?? (what.type === 'case' ? 'The case could not be forwarded.' : 'The message could not be forwarded.'));
    } finally {
      this.forwardBusy.set(false);
    }
  }

  /** Hide/show the details: a remembered preference on wide screens, a drawer on narrow ones. */
  protected onHeaderMenu(id: string): void {
    if (id === 'history') this.toggleHistory();
    else if (id === 'delegate') this.delegateOpen.set(true);
    else this.panel()?.onSlashCommand(id);
  }

  protected toggleDetails(): void {
    if (this.narrow()) {
      this.drawerOpen.update((open) => !open);
      return;
    }
    this.setDetailsHidden(!this.detailsHidden());
  }

  private setDetailsHidden(hidden: boolean): void {
    this.detailsHidden.set(hidden);
    try {
      localStorage.setItem(DETAILS_HIDDEN_KEY, hidden ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the panel still toggles for this visit.
    }
  }

  protected toggleHistory(): void {
    const next = !this.history();
    this.history.set(next);
    if (next) {
      this.drawerOpen.set(false);
      void this.store.loadHistory({});
    }
  }

  // ---- Case actions ----------------------------------------------------------------------------------

  /** A card's button runs exactly like the details panel's: the case opens there (dialogs, edits) and runs. */
  protected async onCaseAction(event: CaseCardAction): Promise<void> {
    if (!sameRef(event.ref, this.selectedCase()) || !sameRef(this.store.detail()?.item, event.ref)) {
      this.selectCase(event.ref);
      await this.showCase(event.ref);
    }
    if (this.narrow()) this.drawerOpen.set(true);
    else if (this.detailsHidden()) this.setDetailsHidden(false);
    // The card renders once the details panel has the case.
    setTimeout(() => this.card()?.runAction(event.key));
  }

  protected onCardAction(event: InboxCardAction): void {
    const ref = this.selectedCase();
    if (ref) void this.runAction(ref, event.key, event.body);
  }

  private async runAction(ref: InboxItemRef, key: string, body: InboxCardAction['body']): Promise<void> {
    const ok = await this.store.runAction(ref, key, body);
    if (ok) {
      this.notifications.success('Done');
      this.caseVersion.update((v) => v + 1);
      void this.chats.load();
    } else {
      this.notifications.error(this.store.actionError() ?? 'The action failed.');
    }
  }

  protected openTarget(target: InboxTargetDto): void {
    void this.router.navigate(target.route, { queryParams: target.queryParams ?? undefined });
  }

  // ---- History -----------------------------------------------------------------------------------------

  protected canUndo(entry: InboxHistoryEntryDto): boolean {
    return entry.canRevert && !!entry.revertableUntil && new Date(entry.revertableUntil).getTime() > Date.now();
  }

  protected async undoFromHistory(entry: InboxHistoryEntryDto): Promise<void> {
    if (await this.store.revertFromHistory(entry)) this.notifications.success('Undone');
    else this.notifications.error(this.store.actionError() ?? 'The decision could not be undone.');
  }
}
