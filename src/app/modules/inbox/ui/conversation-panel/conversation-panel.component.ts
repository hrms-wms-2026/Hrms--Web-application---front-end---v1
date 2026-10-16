import { DatePipe } from '@angular/common';
import {
  AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild
} from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { FileApiService, buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { CommentComposerComponent, ComposerUploader } from '../../../../shared/ui/comment-composer/comment-composer.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { HostSlashCommand, MentionCandidate } from '../../../../shared/ui/rich-text-editor/rich-text-editor.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import {
  ConversationMessageDto, ConversationParticipantDto, InboxActionDto, InboxItemDto, InboxItemRef, InboxKindDescriptorDto
} from '../../models/inbox.dto';
import { ConversationStore } from '../../state/conversation.store';
import { inboxReference, inboxStatusLabel, inboxStatusTone, inboxTitle, inboxTypeMeta } from '../../utils/inbox-item.util';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';

const ADD_COMMAND = 'add';
const CONVERSATION_ATTACHMENT = 'conversation_attachment';
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
/** What the server takes for conversation_attachment (UploadPurposeCatalog). */
const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.zip';
const TAG_LABELS: Record<string, string> = {
  info_request: 'Info requested', info_response: 'Info provided', justification: 'Justification'
};
const MENU_ICONS = {
  add: 'M15 20a6 6 0 0 0-12 0M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M16 11h6',
  members: 'M16 20a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19a3 3 0 0 0-3-3M3 19a3 3 0 0 1 3-3',
  export: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  leave: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11'
};

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Adds `mention--me` to the current user's mention chips so they stand out (the HTML is still rendered
 *  through Angular's sanitizer, which keeps the class). */
export function decorateMentions(html: string, me: string | null): string {
  if (!me || !html.includes('data-employee-id')) return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;
  let changed = false;
  root.querySelectorAll('span.mention[data-employee-id]').forEach((chip) => {
    if (chip.getAttribute('data-employee-id') === me) {
      chip.classList.add('mention--me');
      changed = true;
    }
  });
  return changed ? root.innerHTML : html;
}

interface DayGroup {
  key: string;
  label: string;
  messages: ConversationMessageDto[];
}

interface FailedSend {
  html: string;
  mentions: string[];
  attachmentFileIds: string[];
}

/** The chat of one ticket (inbox item), WhatsApp-style: a header with the ticket and a ⋯ menu (add member,
 *  members, export, leave), messages anchored to the bottom (latest first in view; scrolling up loads older
 *  ones), and a composer with @mentions, add-and-tag and the item's actions in its "/" menu. Each ticket keeps
 *  its own unsent draft. */
@Component({
  selector: 'app-conversation-panel',
  standalone: true,
  imports: [DatePipe, AvatarComponent, CommentComposerComponent, DropdownMenuComponent, InboxTypeIconComponent, PeoplePickerComponent],
  providers: [ConversationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="conv" data-testid="conversation-panel" aria-label="Conversation">
      <header class="conv__header">
        <button type="button" class="conv__icon-btn conv__back" data-testid="conversation-back" aria-label="Back to tickets" (click)="back.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        @if (item(); as it) {
          <app-inbox-type-icon class="conv__type" [icon]="meta().icon" [tone]="meta().tone" />
          <div class="conv__heading">
            <h2 class="conv__title" data-testid="conversation-title">{{ title() }}</h2>
            <span class="conv__ref" data-testid="conversation-ref">{{ reference() }}</span>
          </div>
          <span data-testid="conversation-status" [class]="'conv__pill conv__pill--' + statusTone()">{{ statusText() }}</span>
        } @else {
          <div class="conv__heading"><h2 class="conv__title">Conversation</h2></div>
        }
        <button type="button" class="conv__icon-btn conv__details-toggle" [class.conv__details-toggle--always]="!detailsVisible()"
          data-testid="conversation-toggle-details" [attr.aria-pressed]="detailsVisible()"
          [attr.aria-label]="detailsVisible() ? 'Hide ticket details' : 'Show ticket details'"
          [attr.title]="detailsVisible() ? 'Hide ticket details' : 'Show ticket details'" (click)="toggleDetails.emit()">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></svg>
        </button>
        <app-dropdown-menu [items]="menu()" ariaLabel="Conversation actions" (selected)="onMenu($event)">
          <button menu-trigger type="button" class="conv__icon-btn" data-testid="conversation-menu" aria-label="Conversation actions">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
          </button>
        </app-dropdown-menu>
      </header>

      @if (membersOpen()) {
        <div class="conv__panel" data-testid="conversation-people" role="list" aria-label="People in this conversation">
          <div class="conv__panel-head">
            <span>Members · {{ store.participants().length }}</span>
            <button type="button" class="conv__link" (click)="membersOpen.set(false)">Close</button>
          </div>
          @for (p of store.participants(); track p.employeeId) {
            <div class="conv__person" role="listitem" data-testid="conversation-participant" [attr.data-employee-id]="p.employeeId">
              <app-avatar [userName]="p.name" [avatarUrl]="avatarUrl(p.avatarFileId)" size="xs" />
              <span class="conv__person-name">{{ p.name }}{{ p.employeeId === me() ? ' (you)' : '' }}</span>
              <span class="conv__role" data-testid="participant-role">{{ role(p) }}</span>
              @if (canRemove(p)) {
                <button type="button" class="conv__link" [attr.data-testid]="'participant-remove-' + p.employeeId"
                  [attr.aria-label]="'Remove ' + p.name" (click)="remove(p.employeeId)">Remove</button>
              }
            </div>
          }
          @if (leaveConfirm()) {
            <div class="conv__person conv__person--confirm">
              <span>Leave this conversation? You will stop seeing it.</span>
              <button type="button" class="conv__link" (click)="leaveConfirm.set(false)">Cancel</button>
              <button type="button" class="conv__link conv__link--danger" data-testid="conversation-leave-confirm" (click)="leave()">Leave</button>
            </div>
          }
        </div>
      }

      @if (addOpen()) {
        <div class="conv__panel" data-testid="conversation-add-panel">
          <div class="conv__panel-head"><span>Add member</span></div>
          <app-people-picker
            [options]="candidateOptions()"
            [selectedIds]="chosen()"
            placeholder="Search people to add…"
            (searchChange)="searchPeople($event)"
            (toggled)="toggleCandidate($event)"
          />
          <div class="conv__panel-actions">
            <button type="button" class="conv__btn" (click)="toggleAdd()">Cancel</button>
            <button type="button" class="conv__btn conv__btn--primary" data-testid="conversation-add-confirm"
              [disabled]="chosen().length === 0" (click)="confirmAdd()">Add {{ chosen().length || '' }}</button>
          </div>
        </div>
      }
      @if (exportError()) { <p class="conv__error" role="alert">{{ exportError() }}</p> }

      <div #scroller class="conv__messages" data-testid="conversation-messages" (scroll)="onScroll()">
        <div class="conv__spacer"></div>
        @if (store.olderLoading()) {
          <p class="conv__muted" data-testid="conversation-older-loading" aria-live="polite">Loading older messages…</p>
        }
        @if (store.loading() && store.messages().length === 0) {
          <p class="conv__muted">Loading conversation…</p>
        } @else if (store.error()) {
          <p class="conv__error" role="alert">{{ store.error() }}</p>
        } @else if (store.messages().length === 0) {
          <p class="conv__muted">No messages yet. Start the conversation.</p>
        }
        @for (group of days(); track group.key) {
          <div class="conv__day" data-testid="conversation-day"><span>{{ group.label }}</span></div>
          @for (m of group.messages; track m.id) {
            @if (m.id === unreadFromId()) {
              <div class="conv__unread" data-testid="conversation-unread-divider"><span>New</span></div>
            }
            @if (m.kind === 'system') {
              <div class="msg msg--system" [attr.data-message-id]="m.id">
                <span [innerHTML]="m.bodyHtml"></span> · <time>{{ m.createdAt | date: 'h:mm a' }}</time>
              </div>
            } @else {
              @let own = m.authorEmployeeId === me();
              <div class="msg" [class.msg--own]="own" [class.msg--justification]="m.tag === 'justification' && !m.isDeleted"
                [attr.data-message-id]="m.id">
                <app-avatar class="msg__avatar" [userName]="own ? 'You' : m.authorName" [avatarUrl]="avatarUrl(m.authorAvatarFileId)" size="sm" />
                <div class="msg__content">
                  <div class="msg__meta">
                    <span class="msg__author">{{ own ? 'You' : m.authorName }}</span>
                    <time class="msg__time">{{ m.createdAt | date: 'h:mm a' }}@if (m.editedAt && !m.isDeleted) { <span> (edited)</span> }</time>
                    @if (own && !m.isDeleted && !store.removed() && editingId() !== m.id) {
                      <span class="msg__menu" data-testid="message-menu">
                        <button type="button" class="conv__link" [attr.data-testid]="'message-edit-' + m.id" aria-label="Edit message" (click)="editingId.set(m.id)">Edit</button>
                        <button type="button" class="conv__link conv__link--danger" [attr.data-testid]="'message-delete-' + m.id" aria-label="Delete message"
                          (click)="deleteMessage(m.id)">Delete</button>
                      </span>
                    }
                  </div>
                  <div class="msg__bubble">
                    @if (m.tag && !m.isDeleted) { <div class="msg__tag" data-testid="message-tag">{{ tagLabel(m.tag) }}</div> }
                    @if (m.isDeleted) {
                      <div class="msg__body msg__body--deleted">Message deleted</div>
                    } @else if (editingId() === m.id) {
                      <app-comment-composer
                        [attr.data-testid]="'message-editor-' + m.id"
                        [initialContent]="m.bodyHtml"
                        [attachments]="false"
                        [collapsible]="false"
                        [showCancel]="true"
                        submitLabel="Save"
                        [enterToSend]="true"
                        [mentionCandidates]="mentionCandidates()"
                        (submitted)="saveEdit(m.id, $event)"
                        (cancelled)="editingId.set(null)"
                      />
                    } @else {
                      <div class="msg__body" [innerHTML]="body(m)"></div>
                    }
                    @if (!m.isDeleted && m.attachments?.length) {
                      <div class="msg__files">
                        @for (a of m.attachments; track a.id) {
                          <button type="button" class="msg__file" [attr.data-testid]="'attachment-' + a.id" [attr.aria-label]="'Download ' + a.fileName"
                            (click)="download(a.id, a.fileName)">
                            <svg class="msg__file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
                            <span class="msg__file-text">
                              <span class="msg__file-name">{{ a.fileName }}</span>
                              <span class="msg__file-size">{{ size(a.sizeBytes) }}</span>
                            </span>
                            <svg class="msg__file-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
                          </button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          }
        }
      </div>

      <footer class="conv__footer">
        @if (store.sendError()) {
          <p class="conv__error" role="alert" data-testid="conversation-send-error">
            {{ store.sendError() }}
            @if (failed()) {
              <button type="button" class="conv__link" data-testid="conversation-retry" [disabled]="store.sending()" (click)="retry()">Retry</button>
            }
          </p>
        }
        @if (store.removed()) {
          <p class="conv__muted conv__removed" role="status" data-testid="conversation-removed">You were removed from this conversation.</p>
        } @else {
          @if (isSubject()) {
            <label class="conv__justify">
              <input type="checkbox" data-testid="conversation-justification" [checked]="justification()"
                (change)="justification.set($any($event.target).checked)" />
              Mark as justification
            </label>
          }
          <!-- Switching tickets empties the composer and loads that ticket's own draft, so text never leaks across. -->
          <app-comment-composer
            #composer
            class="conv__composer"
            variant="chat"
            [initialContent]="draftFor(refKey())"
            [collapsible]="false"
            [submitLabel]="store.sending() ? 'Sending…' : 'Send'"
            placeholder="Type a message…"
            [attachments]="true"
            [uploader]="uploader"
            [enterToSend]="true"
            [mentionCandidates]="mentionCandidates()"
            [allowAddAndTag]="true"
            [mentionSearch]="mentionSearch"
            [extraSlashCommands]="slashCommands()"
            (submitted)="send($event.content, $event.mentions, $event.attachmentFileIds)"
            (slashCommand)="onSlashCommand($event)"
            (addAndTag)="addAndTag($event)"
          />
        }
      </footer>
    </section>
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .conv { display: flex; height: 100%; min-height: 0; flex-direction: column; }
    .conv__header { display: flex; min-width: 0; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
    .conv__type { width: 36px; height: 36px; border-radius: 10px; }
    .conv__heading { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 1px; }
    .conv__title { margin: 0; overflow: hidden; color: var(--color-text-primary); font-size: 14px; font-weight: 650; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
    .conv__ref { overflow: hidden; color: var(--color-text-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .conv__pill { --tone: var(--color-accent); flex: 0 0 auto; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; }
    .conv__pill--neutral { --tone: var(--color-text-secondary); }
    .conv__icon-btn { display: inline-flex; width: 30px; height: 30px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .conv__icon-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .conv__icon-btn:focus-visible, .conv__link:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .conv__icon-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .conv__back { display: none; }
    .conv__details-toggle { display: none; }
    .conv__details-toggle--always { display: inline-flex; }
    .conv__panel { display: flex; flex-direction: column; gap: 6px; margin: 10px 16px 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); }
    .conv__panel-head { display: flex; align-items: center; justify-content: space-between; color: var(--color-text-secondary); font-size: 12px; font-weight: 650; }
    .conv__panel-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .conv__btn { display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .conv__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .conv__btn:disabled { opacity: .5; cursor: default; }
    .conv__person { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
    .conv__person--confirm { flex-wrap: wrap; color: var(--color-text-secondary); }
    .conv__person-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .conv__role { padding: 1px 8px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .conv__link { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .conv__link--danger { color: var(--color-danger); }
    .conv__messages { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 14px; overflow-y: auto; padding: 16px; }
    /* Pushes a short conversation to the bottom, like a messenger: the latest message sits above the composer. */
    .conv__spacer { flex: 1 0 0; }
    .conv__day, .conv__unread { display: flex; align-items: center; gap: 10px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .conv__day::before, .conv__day::after, .conv__unread::before, .conv__unread::after { content: ''; flex: 1; height: 1px; background: var(--color-border); }
    .conv__unread { color: var(--color-danger); }
    .conv__unread::before, .conv__unread::after { background: color-mix(in srgb, var(--color-danger) 40%, transparent); }
    .conv__muted { margin: 0; color: var(--color-text-secondary); font-size: 12px; text-align: center; }
    .conv__error { display: flex; align-items: center; gap: 8px; margin: 0; padding: 6px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .msg { position: relative; display: flex; max-width: 82%; align-items: flex-start; gap: 10px; }
    .msg--own { align-self: flex-end; flex-direction: row-reverse; }
    .msg--system { align-self: center; max-width: 100%; padding: 4px 12px; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; text-align: center; }
    .msg__avatar { flex: 0 0 auto; }
    .msg__content { display: flex; min-width: 0; flex-direction: column; gap: 4px; }
    .msg--own .msg__content { align-items: flex-end; }
    .msg__meta { display: flex; align-items: baseline; gap: 8px; }
    .msg__author { color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .msg__time { color: var(--color-text-secondary); font-size: 11px; }
    .msg__bubble { min-width: 0; padding: 9px 12px; border-radius: 4px 12px 12px 12px; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 13px; }
    .msg--own .msg__bubble { border-radius: 12px 4px 12px 12px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }
    .msg__body { overflow-wrap: anywhere; line-height: 1.5; }
    .msg__body ::ng-deep p, .msg__body ::ng-deep div { margin: 0; }
    .msg__body ::ng-deep .mention { padding: 0 3px; border-radius: 4px; background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-weight: 600; }
    .msg__body ::ng-deep .mention--me { background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .msg__body--deleted { color: var(--color-text-secondary); font-style: italic; }
    .msg__menu { display: inline-flex; gap: 8px; opacity: 0; transition: opacity .1s; }
    .msg:hover .msg__menu, .msg:focus-within .msg__menu { opacity: 1; }
    .msg__tag { margin-bottom: 2px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    .msg--justification .msg__bubble { border: 1px solid color-mix(in srgb, var(--color-warning, #d97706) 55%, transparent); background: color-mix(in srgb, var(--color-warning, #d97706) 10%, var(--color-surface)); }
    .msg--justification .msg__tag { color: var(--color-warning, #d97706); }
    .msg__files { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
    .msg__file { display: flex; min-width: 220px; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .msg__file:hover { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .msg__file-icon { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .msg__file-text { display: flex; min-width: 0; flex: 1; flex-direction: column; }
    .msg__file-name { overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .msg__file-size { color: var(--color-text-secondary); font-size: 11px; }
    .conv__footer { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--color-border); }
    .conv__removed { padding: 8px; border: 1px dashed var(--color-border); border-radius: 8px; }
    .conv__justify { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 12px; }
    /* Narrow screens: the chat is its own screen with a back button; the details open as a drawer. */
    @media (max-width: 1023px) {
      .conv__back, .conv__details-toggle { display: inline-flex; }
      .conv__type { display: none; }
      .conv__header { gap: 6px; padding: 10px 12px; }
      .msg { max-width: 92%; }
    }
  `]
})
export class ConversationPanelComponent implements AfterViewChecked {
  protected readonly store = inject(ConversationStore);
  private readonly auth = inject(AuthStore);
  private readonly conversations = inject(ConversationsApiService);

  /** The inbox item whose conversation this is. */
  itemRef = input.required<InboxItemRef>();
  /** The item itself, for the header (title, reference, status); null while it loads. */
  item = input<InboxItemDto | null>(null);
  /** The item's kind from the registry, for the type icon. */
  descriptor = input<InboxKindDescriptorDto | null>(null);
  /** Whether the ticket details panel is showing; the header offers to show it when it is not. */
  detailsVisible = input(true);
  /** The item's available actions, offered in the composer's "/" menu. */
  actions = input<readonly InboxActionDto[]>([]);
  /** A "/" action was picked: the host runs it exactly like its action-bar button. */
  action = output<string>();
  /** The item's requester (InboxItem.requestedBy), for the role badge. */
  requesterId = input<string | null>(null);
  toggleDetails = output<void>();
  /** Narrow screens: back to the ticket list. */
  back = output<void>();

  private readonly files = inject(FileApiService);
  private readonly inboxApi = inject(InboxApiService);

  /** Chat attachments upload as conversation_attachment: at most 5 per message, 25 MB each. */
  protected readonly uploader: ComposerUploader = {
    upload: (file: File) => this.files.upload(file, CONVERSATION_ATTACHMENT).pipe(
      map((f) => ({ fileId: f.fileId, originalFileName: f.originalFileName, fileSizeBytes: f.fileSizeBytes }))),
    maxFiles: MAX_ATTACHMENTS,
    maxBytes: MAX_ATTACHMENT_BYTES,
    accept: ATTACHMENT_ACCEPT
  };
  protected readonly membersOpen = signal(false);
  protected readonly leaveConfirm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly justification = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal<string | null>(null);
  /** The last message that failed to send, kept so it can be retried as it was. */
  protected readonly failed = signal<FailedSend | null>(null);

  private readonly myRow = computed(() => this.store.participants().find((p) => p.employeeId === this.me()) ?? null);
  protected readonly isSubject = computed(() => !!this.me() && this.me() === this.store.subjectEmployeeId());
  protected readonly canLeave = computed(() => this.myRow()?.joinReason === 'added');
  /** Deciders (base members who are neither the subject nor the requester) and viewers (e.g. HR after an escalation);
   *  the server checks again and refuses anyone else. */
  protected readonly canExport = computed(() => {
    const row = this.myRow();
    if (!row) return false;
    if (row.joinReason === 'viewer') return true;
    return row.joinReason === 'base' && row.employeeId !== this.store.subjectEmployeeId() && row.employeeId !== this.requesterId();
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<CommentComposerComponent>('composer');

  protected readonly me = computed(() => this.auth.employeeId() ?? null);
  protected readonly addOpen = signal(false);
  protected readonly chosen = signal<string[]>([]);
  protected readonly searchResults = signal<PeoplePickerOption[]>([]);
  protected readonly refKey = computed(() => { const r = this.itemRef(); return `${r.source}:${r.kind}:${r.id}`; });
  /** Unsent text per ticket. */
  private readonly drafts = new Map<string, string>();
  private openKey: string | null = null;
  private stickToBottom = true;
  private lastMessageCount = 0;
  private filling = false;

  protected readonly meta = computed(() => this.item()
    ? inboxTypeMeta(this.item()!, this.descriptor())
    : { label: '', tone: 'neutral' as const, icon: 'task' });
  protected readonly title = computed(() => this.item() ? inboxTitle(this.item()!) : '');
  protected readonly reference = computed(() => this.item() ? inboxReference(this.item()!) : '');
  protected readonly statusText = computed(() => this.item() ? inboxStatusLabel(this.item()!) : '');
  protected readonly statusTone = computed(() => this.item() ? inboxStatusTone(this.item()!) : 'neutral');
  protected readonly menu = computed<MenuItem[]>(() => [
    ...(this.store.removed() ? [] : [{ id: 'add', label: 'Add member', iconPath: MENU_ICONS.add }]),
    { id: 'members', label: `Members (${this.store.participants().length})`, iconPath: MENU_ICONS.members },
    ...(this.canExport() ? [{ id: 'export', label: this.exporting() ? 'Exporting…' : 'Export', iconPath: MENU_ICONS.export, disabled: this.exporting() }] : []),
    ...(this.canLeave() ? [{ id: 'leave', label: 'Leave conversation', iconPath: MENU_ICONS.leave, danger: true, dividerBefore: true }] : [])
  ]);

  protected readonly unreadFromId = computed(() => {
    const id = this.store.unreadFromId();
    const message = this.store.messages().find((m) => m.id === id);
    return message && message.authorEmployeeId !== this.me() ? id : null;
  });
  protected readonly mentionCandidates = computed<MentionCandidate[]>(() => this.store.participants()
    .filter((p) => p.employeeId !== this.me())
    .map((p) => ({ id: p.employeeId, name: p.name, avatarUrl: this.avatarUrl(p.avatarFileId) })));
  protected readonly slashCommands = computed<HostSlashCommand[]>(() => [
    ...this.actions().filter((a) => a.key !== 'open_target')
      .map((a) => ({ id: a.key, label: a.label, category: 'ACTIONS', icon: a.tone === 'danger' ? '✕' : '✓', description: 'Run on this item' })),
    { id: ADD_COMMAND, label: 'Add people', category: 'ACTIONS', icon: '+', description: 'Add someone to this conversation' }
  ]);
  protected readonly candidateOptions = computed(() => {
    const members = new Set(this.store.participantIds());
    return this.searchResults().filter((p) => !members.has(p.id));
  });

  protected readonly days = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const m of this.store.messages()) {
      const date = new Date(m.createdAt);
      const key = date.toDateString();
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: this.dayLabel(date), messages: [] };
        groups.push(group);
      }
      group.messages.push(m);
    }
    return groups;
  });

  /** For add-and-tag in the composer: any active colleague (the tenant-wide conversation lookup, not the
   *  permission-scoped People directory). A failed lookup just offers nobody. */
  protected readonly mentionSearch = (query: string): Observable<readonly MentionCandidate[]> =>
    this.conversations.searchPeople(query).pipe(
      map((people) => people.map((p) => ({ id: p.employeeId, name: p.name, avatarUrl: this.avatarUrl(p.avatarFileId) }))),
      catchError(() => of([])));

  constructor() {
    effect(() => {
      const ref = this.itemRef();
      const key = this.refKey();
      untracked(() => {
        // Keep what was typed for the ticket being left; its composer is swapped for the next ticket's.
        if (this.openKey && this.openKey !== key) {
          this.drafts.set(this.openKey, this.composer()?.editorHtml() ?? '');
          this.composer()?.clear();
        }
        this.openKey = key;
        this.stickToBottom = true;
        this.lastMessageCount = 0;
        this.failed.set(null);
        this.membersOpen.set(false);
        this.addOpen.set(false);
        this.leaveConfirm.set(false);
        this.editingId.set(null);
        void this.store.open(ref);
      });
    });
  }

  ngAfterViewChecked(): void {
    // A new ticket opens at its latest message; later, follow new messages only when the reader is at the bottom.
    const count = this.store.messages().length;
    if (count !== this.lastMessageCount) {
      const grewAtEnd = count > this.lastMessageCount;
      this.lastMessageCount = count;
      if (grewAtEnd && this.stickToBottom) this.scrollToBottom();
    }
    // Too few messages to scroll: fetch older ones until the view fills (there is no scroll to trigger it).
    const el = this.scroller()?.nativeElement;
    if (el && !this.filling && this.store.hasMore() && !this.store.loading() && !this.store.olderLoading()
      && el.scrollHeight <= el.clientHeight + 1) {
      this.filling = true;
      setTimeout(() => void this.loadOlder().finally(() => (this.filling = false)));
    }
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    this.stickToBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 40 && this.store.hasMore()) void this.loadOlder();
  }

  protected async loadOlder(): Promise<void> {
    if (this.store.olderLoading()) return;
    const el = this.scroller()?.nativeElement;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    this.stickToBottom = false;
    await this.store.loadOlder();
    // Keep the reader's place after older messages are prepended.
    queueMicrotask(() => { if (el) el.scrollTop = el.scrollHeight - before; });
  }

  protected draftFor(key: string): string {
    return this.drafts.get(key) ?? '';
  }

  protected body(message: ConversationMessageDto): string {
    return decorateMentions(message.bodyHtml, this.me());
  }

  protected avatarUrl(fileId: string | null | undefined): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected async send(html: string, mentions: string[], attachmentFileIds: string[] = []): Promise<void> {
    this.stickToBottom = true;
    const key = this.refKey();
    this.drafts.delete(key);
    const tag = this.isSubject() && this.justification() ? 'justification' : null;
    const ok = await this.store.send(html, mentions, attachmentFileIds, tag);
    // Only the ticket it was written in may keep (and retry) a failed message.
    if (this.refKey() !== key) return;
    if (ok) {
      this.justification.set(false);
      this.failed.set(null);
    } else {
      this.failed.set({ html, mentions, attachmentFileIds });
    }
  }

  protected retry(): void {
    const failed = this.failed();
    if (failed) void this.send(failed.html, failed.mentions, failed.attachmentFileIds);
  }

  protected role(p: ConversationParticipantDto): string {
    if (p.joinReason === 'viewer') return 'Viewer';
    if (p.joinReason === 'added') return 'Added';
    if (p.employeeId === this.store.subjectEmployeeId()) return 'Subject';
    if (p.employeeId === this.requesterId()) return 'Requester';
    return 'Approver';
  }

  /** Added members can be removed by any base member and by whoever added them. */
  protected canRemove(p: ConversationParticipantDto): boolean {
    if (p.joinReason !== 'added' || p.employeeId === this.me() || this.store.removed()) return false;
    return this.myRow()?.joinReason === 'base' || p.addedByEmployeeId === this.me();
  }

  protected async remove(employeeId: string): Promise<void> {
    await this.store.removeParticipant(employeeId);
  }

  protected async leave(): Promise<void> {
    this.leaveConfirm.set(false);
    if (await this.store.leave()) this.membersOpen.set(false);
  }

  protected onMenu(id: string): void {
    if (id === 'add') {
      if (!this.addOpen()) this.toggleAdd();
    } else if (id === 'members') {
      this.membersOpen.set(true);
      this.leaveConfirm.set(false);
    } else if (id === 'export') {
      this.exportBundle();
    } else if (id === 'leave') {
      this.membersOpen.set(true);
      this.leaveConfirm.set(true);
    }
  }

  protected tagLabel(tag: string): string {
    return TAG_LABELS[tag] ?? tag;
  }

  protected async saveEdit(messageId: string, event: { content: string; mentions: string[] }): Promise<void> {
    if (await this.store.editMessage(messageId, event.content, event.mentions)) this.editingId.set(null);
  }

  protected async deleteMessage(messageId: string): Promise<void> {
    await this.store.deleteMessage(messageId);
  }

  protected size(bytes: number): string {
    return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** Attachments download through the authenticated endpoint and are saved from a blob (never a raw URL). */
  protected download(attachmentId: string, fileName: string): void {
    const conversationId = this.store.conversationId();
    if (!conversationId) return;
    this.conversations.attachment(conversationId, attachmentId).subscribe({
      next: (blob) => saveBlob(blob, fileName),
      error: () => this.store.markSendError('You can no longer download this file.')
    });
  }

  protected exportBundle(): void {
    this.exporting.set(true);
    this.exportError.set(null);
    const ref = this.itemRef();
    this.inboxApi.exportItem(ref).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        saveBlob(blob, `inbox-${ref.source}-${ref.kind}-${ref.id}.html`);
      },
      error: () => {
        this.exporting.set(false);
        this.exportError.set('You cannot export this conversation.');
      }
    });
  }

  protected onSlashCommand(id: string): void {
    if (id === ADD_COMMAND) {
      if (!this.addOpen()) this.toggleAdd();
      return;
    }
    this.action.emit(id);
  }

  protected async addAndTag(person: MentionCandidate): Promise<void> {
    const added = await this.store.addParticipants([person.id]);
    if (added.length > 0) this.composer()?.insertMention(person);
  }

  protected toggleAdd(): void {
    this.addOpen.update((open) => !open);
    this.chosen.set([]);
    if (this.addOpen()) this.searchPeople('');
  }

  protected searchPeople(search: string): void {
    this.conversations.searchPeople(search).pipe(catchError(() => of([])))
      .subscribe((people) => this.searchResults.set(people.map((p) => ({ id: p.employeeId, name: p.name }))));
  }

  protected toggleCandidate(id: string): void {
    this.chosen.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected async confirmAdd(): Promise<void> {
    const ids = this.chosen();
    if (ids.length === 0) return;
    await this.store.addParticipants(ids);
    this.addOpen.set(false);
    this.chosen.set([]);
  }

  private scrollToBottom(): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private dayLabel(date: Date): string {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
