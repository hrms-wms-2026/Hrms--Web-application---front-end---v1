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
import { BulkAction, BulkActionBarComponent } from '../../../../shared/ui/bulk-action-bar/bulk-action-bar.component';
import { BulkActionResultModalComponent, BulkResultSummary } from '../../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';
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
import { pendingMatching } from '../../ui/chat-list/chat-list.component';
import { InboxChatSidebarComponent } from '../../ui/chat-sidebar/inbox-chat-sidebar.component';
import { ConversationPanelComponent } from '../../ui/conversation-panel/conversation-panel.component';
import { InboxOutcomeChoice, InboxOutcomeDialogComponent } from '../../ui/inbox-action-dialogs/inbox-outcome-dialog.component';
import { InboxCommentDialogComponent } from '../../ui/inbox-comment-dialog/inbox-comment-dialog.component';
import { InboxCardAction, InboxItemCardComponent } from '../../ui/inbox-item-card/inbox-item-card.component';
import { NewGroupChoice, NewGroupDialogComponent } from '../../ui/new-group-dialog/new-group-dialog.component';
import { ForwardDialogComponent, ForwardTargets } from '../../ui/forward-dialog/forward-dialog.component';
import { PersonCasesViewComponent } from '../../ui/person-cases/person-cases-view.component';
import { inboxTitle } from '../../utils/inbox-item.util';
import { InboxBulkActionChoice, bulkActionsFor } from '../../utils/inbox-page-state.util';

/** Whether the details panel is collapsed - a per-viewer preference. */
const DETAILS_HIDDEN_KEY = 'inbox.detailsHidden';
const NARROW_QUERY = '(max-width: 1023px)';
const LEAVE_APPROVE = 'leave:approve';
/** The pending items bulk approval can act on in one go (the server's bulk limit). */
const PENDING_PAGE = 100;

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
 * with anyone in the legal entity; Pending narrows to what waits on the user, for bulk approval). Middle: the open chat,
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
    DatePipe, BreadcrumbHeaderComponent, BulkActionBarComponent, BulkActionResultModalComponent, ApprovalDelegateModalComponent,
    InboxChatSidebarComponent, ConversationPanelComponent, InboxCommentDialogComponent, InboxItemCardComponent, InboxOutcomeDialogComponent,
    NewGroupDialogComponent, PersonCasesViewComponent, ForwardDialogComponent
  ],
  // The open chat: shared by the conversation panel and the details. The open person's history: the details panel.
  providers: [ConversationStore, InboxPersonCasesStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inbox">
      <header class="work-page-header inbox__page-header">
        <div class="inbox__header-row">
          <app-breadcrumb-header parentLabel="Inbox" [currentLabel]="history() ? 'History' : 'Chats'" icon="inbox" />
          <div class="inbox__header-tools">
            <button type="button" class="inbox__tool-btn" data-testid="inbox-history-toggle" [attr.aria-pressed]="history()"
              (click)="toggleHistory()">History</button>
            @if (canDelegate) {
              <button type="button" class="inbox__tool-btn" data-testid="inbox-delegate" (click)="delegateOpen.set(true)">Delegate my approvals</button>
            }
          </div>
        </div>
      </header>

      @if (chats.selectedIds().size > 0) {
        <app-bulk-action-bar class="inbox__bulk" [count]="selectedPending().length" noun="item" [actions]="bulkBarActions()"
          (action)="onBulkAction($event)" (cleared)="chats.setSelection(noChats)" />
      }

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
              (startCaseGroup)="openNewGroup($event)"
              (forwardCase)="forwarding.set($event)"
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
            @if (selectedCase()) {
              <div class="inbox__details-bar">
                @if (activeRow()?.type !== 'case') {
                  <button type="button" class="inbox__back" data-testid="inbox-details-back" (click)="selectCase(null)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18 9 12l6-6" /></svg>
                    {{ activeRow()?.type === 'direct' ? activeRow()!.title : 'Members' }}
                  </button>
                  <button type="button" class="inbox__chip" data-testid="inbox-start-case-group" (click)="openNewGroup(selectedCase())">Start a group</button>
                }
              </div>
              <app-inbox-item-card
                #card
                [detail]="store.detail()"
                [loading]="store.detailLoading()"
                [error]="store.detailError()"
                [busy]="store.busy()"
                [actionError]="store.actionError()"
                [actionErrorInline]="store.actionErrorInline()"
                [descriptor]="store.detail() ? kinds.descriptor(store.detail()!.item.source, store.detail()!.item.kind) : null"
                (hide)="toggleDetails()"
                (action)="onCardAction($event)"
                (openTarget)="openTarget($event)"
              />
            } @else if (activeRow()?.type === 'direct') {
              <app-person-cases-view [avatarFileId]="activeRow()!.avatarFileId" (open)="selectCase($event)" />
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
    <app-inbox-comment-dialog
      [open]="bulkPending()?.needsComment === true && bulkPending()?.key !== 'resolve'"
      [title]="(bulkPending()?.label ?? '') + ' ' + selectedPending().length + ' items?'"
      [confirmLabel]="bulkPending()?.label ?? ''"
      (confirmed)="runBulk(bulkPending()!.key, $event, null)"
      (closed)="bulkPending.set(null)"
    />
    <app-inbox-outcome-dialog
      [open]="bulkPending()?.key === 'resolve'"
      [title]="'Resolve ' + selectedPending().length + ' alerts'"
      [outcomes]="bulkPending()?.outcomes ?? []"
      (confirmed)="onBulkOutcome($event)"
      (closed)="bulkPending.set(null)"
    />
    <app-bulk-action-result-modal [result]="bulkResult()" [names]="bulkNames()" noun="item" [showApprovals]="false"
      (closed)="bulkResult.set(null)" />
    <app-approval-delegate-modal [open]="delegateOpen()" (closed)="delegateOpen.set(false)" />
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .inbox { display: flex; height: 100%; min-height: 0; flex-direction: column; gap: 12px; }
    /* Same sticky header as Work (global .work-page-header). */
    .inbox__page-header { margin-bottom: 0 !important; }
    .inbox__header-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 36px; }
    .inbox__header-row app-breadcrumb-header { display: inline-flex; flex-shrink: 0; align-items: center; }
    .inbox__header-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .inbox__tool-btn { height: 30px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .inbox__tool-btn:hover { border-color: var(--color-accent); }
    .inbox__tool-btn[aria-pressed="true"] { border-color: var(--color-accent); color: var(--color-accent); }
    .inbox__tool-btn:focus-visible, .inbox__chip:focus-visible, .inbox__back:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

    /* One surface split by lines, not three separate cards: chats | conversation | details. */
    .inbox__workspace { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(0, 1fr); background: var(--color-surface); }
    .inbox__workspace--details { grid-template-columns: minmax(360px, 62fr) minmax(320px, 38fr); }
    .inbox__list { border-right: 0; }
    .inbox__panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; background: var(--color-surface); }
    .inbox__details { border-left: 1px solid var(--color-border); }
    .inbox__details { display: none; }
    .inbox__workspace--details .inbox__details { display: flex; }
    .inbox__scrim { display: none; }
    .inbox__details-bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 0; }
    .inbox__details-bar:empty { display: none; }
    .inbox__back { display: inline-flex; min-width: 0; align-items: center; gap: 4px; padding: 4px 8px 4px 4px; border: 0; border-radius: 8px; background: none; color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .inbox__back:hover { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); }
    .inbox__back svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
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

  protected readonly canDelegate = inject(PermissionService).hasPermission(LEAVE_APPROVE);
  protected readonly chatRef = chatRef;
  protected readonly noChats: ReadonlySet<string> = new Set<string>();

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
  protected readonly bulkPending = signal<InboxBulkActionChoice | null>(null);
  /** The case being forwarded (the picker is open). */
  protected readonly forwarding = signal<(InboxItemRef & { title: string }) | null>(null);
  protected readonly forwardBusy = signal(false);
  protected readonly forwardError = signal<string | null>(null);
  protected readonly bulkResult = signal<BulkResultSummary | null>(null);
  protected readonly bulkNames = signal<ReadonlyMap<string, string>>(new Map());

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
  /** The pending items of the ticked chats that pass the type filter, as the inbox lists them (with their actions). */
  protected readonly selectedPending = computed(() => {
    const refs = this.chats.rows()
      .filter((r) => this.chats.selectedIds().has(r.conversationId))
      .flatMap((r) => pendingMatching(r, this.chats.kind()));
    return this.store.items().filter((i) => refs.some((p) => sameRef(p, i)));
  });
  private readonly bulkChoices = computed(() => bulkActionsFor(this.selectedPending(), (s, k) => this.kinds.descriptor(s, k)));
  protected readonly bulkBarActions = computed<BulkAction[]>(() => {
    const choices = this.bulkChoices();
    if (choices.length === 0)
      return [{ id: 'none', label: 'No common action', placement: 'primary', disabled: true, disabledReason: 'The selected items share no action.' }];
    return choices.map((c) => ({ id: c.key, label: c.label, placement: 'primary', danger: c.key === 'reject' }));
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

  /** Pending (in the sub-sidebar) turns bulk approval on: it needs the pending items with their actions, as the inbox
   *  lists them. */
  private readonly loadPending = effect(() => {
    if (this.chats.filter() === 'pending')
      untracked(() => void this.store.applyFilter({ status: ['pending'], direction: ['received'], page: 1, pageSize: PENDING_PAGE }));
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
    if (ref && this.narrow()) this.drawerOpen.set(true);
    if (ref && !this.narrow() && this.detailsHidden()) this.setDetailsHidden(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { case: ref ? caseParam(ref) : null }, queryParamsHandling: 'merge' });
  }

  /** "New group", or - with a case - the case's own group (from a 1-on-1 chat's "Add people" or the details). */
  protected openNewGroup(caseRef: InboxItemRef | null): void {
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

  /** WhatsApp-style forward: a copy of the case card goes into each picked chat. */
  protected async forward(targets: ForwardTargets): Promise<void> {
    const ref = this.forwarding();
    if (!ref) return;
    this.forwardBusy.set(true);
    this.forwardError.set(null);
    try {
      // People with no chat yet: their 1-on-1 chat is started first (the same as starting one from the search).
      const started = await Promise.all(targets.employeeIds.map((id) => firstValueFrom(this.chatsApi.openDirect(id))));
      const conversationIds = [...targets.conversationIds, ...started.map((c) => c.conversationId)];
      const count = await firstValueFrom(this.chatsApi.forward({ source: ref.source, kind: ref.kind, id: ref.id }, conversationIds));
      this.forwarding.set(null);
      this.notifications.success(count === 1 ? 'Forwarded' : `Forwarded to ${count} chats`);
      void this.chats.load();
    } catch (err) {
      this.forwardError.set((err as { error?: { detail?: string } })?.error?.detail ?? 'The case could not be forwarded.');
    } finally {
      this.forwardBusy.set(false);
    }
  }

  /** Hide/show the details: a remembered preference on wide screens, a drawer on narrow ones. */
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

  // ---- Bulk ----------------------------------------------------------------------------------------

  protected onBulkAction(key: string): void {
    const choice = this.bulkChoices().find((c) => c.key === key);
    if (!choice) return;
    if (choice.needsComment || choice.key === 'resolve') this.bulkPending.set(choice);
    else void this.runBulk(choice.key, null, null);
  }

  protected onBulkOutcome(choice: InboxOutcomeChoice): void {
    void this.runBulk('resolve', choice.comment, choice.outcome);
  }

  protected async runBulk(action: string, comment: string | null, outcome: string | null): Promise<void> {
    this.bulkPending.set(null);
    const items = this.selectedPending();
    const result = await this.store.runBulk({ action, items: items.map((i) => ({ source: i.source, kind: i.kind, id: i.id })), comment, outcome });
    if (!result) {
      this.notifications.error(this.store.actionError() ?? 'The bulk action failed.');
      return;
    }
    this.chats.setSelection(this.noChats);
    this.caseVersion.update((v) => v + 1);
    void this.chats.load();
    if (result.failed.length === 0) {
      this.notifications.success(`${result.succeeded.length} done`);
      return;
    }
    const id = (ref: InboxItemRef) => `${ref.source}:${ref.kind}:${ref.id}`;
    this.bulkNames.set(new Map(items.map((i) => [id(i), inboxTitle(i)])));
    this.bulkResult.set({
      items: [
        ...result.succeeded.map((ref) => ({ id: id(ref), outcome: 'succeeded' as const, reason: null })),
        ...result.failed.map((f) => ({ id: id(f.ref), outcome: 'failed' as const, reason: f.message }))
      ],
      succeeded: result.succeeded.length,
      pendingApproval: 0,
      failed: result.failed.length
    });
  }
}
